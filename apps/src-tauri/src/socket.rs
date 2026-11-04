//! WebSocket connections opened on the Rust side, optionally through a proxy
//! (HTTP CONNECT or SOCKS5). Used for accounts that have a proxy: the webview's
//! own WebSocket cannot use a per-account proxy. The JS side speaks
//! Engine.IO 3 / Socket.IO 2 over it (src/lib/rustSocket.ts); this side only
//! moves text frames.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use percent_encoding::percent_decode_str;
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio_socks::tcp::Socks5Stream;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{client_async_tls_with_config, Connector};
use url::Url;

/// TCP + proxy + TLS + WebSocket handshake must finish within this.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// Longest proxy reply to CONNECT that is read before giving up.
const MAX_PROXY_REPLY: usize = 8 * 1024;

/// Sent to JS over the channel given to `ws_open`.
#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WsEvent {
    Open,
    Message {
        data: String,
    },
    /// Last event of a connection: closed by `ws_close`, the server or an error.
    Closed {
        reason: String,
    },
}

enum Command {
    Send(String),
    Close,
}

#[derive(Default)]
pub struct Sockets {
    next: AtomicU32,
    open: Mutex<HashMap<u32, mpsc::UnboundedSender<Command>>>,
}

/// A proxy URL the JS side normalized: http://, socks5:// or socks5h://, with a port.
pub fn parse_proxy(text: &str) -> Result<Url, String> {
    let url = Url::parse(text.trim()).map_err(|e| format!("Proxy không hợp lệ: {e}"))?;
    if !matches!(url.scheme(), "http" | "socks5" | "socks5h") {
        return Err(format!(
            "Không hỗ trợ proxy {}:// (chỉ http, socks5)",
            url.scheme()
        ));
    }
    if url.host_str().is_none() || url.port().is_none() {
        return Err("Proxy thiếu host hoặc cổng".into());
    }
    Ok(url)
}

/// Opens `url` (ws:// or wss://), through `proxy` when given. Returns the id for
/// `ws_send` / `ws_close`; events arrive on `on_event`, ending with `closed`.
#[tauri::command]
pub fn ws_open(
    sockets: State<'_, Arc<Sockets>>,
    url: String,
    proxy: Option<String>,
    on_event: Channel<WsEvent>,
) -> Result<u32, String> {
    let target = Url::parse(&url).map_err(|e| format!("URL socket không hợp lệ: {e}"))?;
    if !matches!(target.scheme(), "ws" | "wss") || target.host_str().is_none() {
        return Err("URL socket phải là ws:// hoặc wss://".into());
    }
    let proxy = proxy
        .filter(|p| !p.trim().is_empty())
        .map(|p| parse_proxy(&p))
        .transpose()?;
    let id = sockets.next.fetch_add(1, Ordering::Relaxed) + 1;
    let (tx, rx) = mpsc::unbounded_channel();
    sockets.open.lock().unwrap().insert(id, tx);
    let registry = Arc::clone(&sockets);
    tauri::async_runtime::spawn(async move {
        let emit = |event| {
            let _ = on_event.send(event);
        };
        let reason = match run(target, proxy, rx, emit).await {
            Ok(()) => "closed".to_string(),
            Err(e) => e,
        };
        registry.open.lock().unwrap().remove(&id);
        let _ = on_event.send(WsEvent::Closed { reason });
    });
    Ok(id)
}

#[tauri::command]
pub fn ws_send(sockets: State<'_, Arc<Sockets>>, id: u32, data: String) -> Result<(), String> {
    let open = sockets.open.lock().unwrap();
    let tx = open.get(&id).ok_or("Socket đã đóng")?;
    tx.send(Command::Send(data))
        .map_err(|_| "Socket đã đóng".to_string())
}

#[tauri::command]
pub fn ws_close(sockets: State<'_, Arc<Sockets>>, id: u32) {
    if let Some(tx) = sockets.open.lock().unwrap().remove(&id) {
        let _ = tx.send(Command::Close);
    }
}

async fn run(
    target: Url,
    proxy: Option<Url>,
    mut commands: mpsc::UnboundedReceiver<Command>,
    emit: impl Fn(WsEvent),
) -> Result<(), String> {
    let host = target.host_str().unwrap_or_default().to_string();
    let port = target.port_or_known_default().unwrap_or(443);
    let connect = async {
        let tcp = match &proxy {
            None => TcpStream::connect((host.as_str(), port))
                .await
                .map_err(|e| format!("Không kết nối được {host}:{port}: {e}"))?,
            Some(proxy) => through_proxy(proxy, &host, port).await?,
        };
        let _ = tcp.set_nodelay(true);
        let (ws, _) = client_async_tls_with_config(target.as_str(), tcp, None, Some(tls()))
            .await
            .map_err(|e| format!("Bắt tay WebSocket lỗi: {e}"))?;
        Ok::<_, String>(ws)
    };
    let ws = tokio::time::timeout(CONNECT_TIMEOUT, connect)
        .await
        .map_err(|_| "Hết thời gian kết nối".to_string())??;
    emit(WsEvent::Open);

    let (mut sink, mut source) = ws.split();
    loop {
        tokio::select! {
            frame = source.next() => match frame {
                Some(Ok(Message::Text(text))) => {
                    emit(WsEvent::Message { data: text.as_str().to_owned() });
                }
                Some(Ok(Message::Close(frame))) => {
                    let reason = frame.map(|f| f.reason.as_str().to_owned()).unwrap_or_default();
                    return Err(if reason.is_empty() { "Server đóng kết nối".into() } else { reason });
                }
                Some(Ok(_)) => {}
                Some(Err(e)) => return Err(format!("Mất kết nối: {e}")),
                None => return Err("Mất kết nối".into()),
            },
            command = commands.recv() => match command {
                Some(Command::Send(text)) => sink
                    .send(Message::text(text))
                    .await
                    .map_err(|e| format!("Gửi lỗi: {e}"))?,
                Some(Command::Close) | None => {
                    let _ = sink.send(Message::Close(None)).await;
                    return Ok(());
                }
            },
        }
    }
}

/// A TCP stream to `host:port` tunnelled through `proxy`.
async fn through_proxy(proxy: &Url, host: &str, port: u16) -> Result<TcpStream, String> {
    let proxy_host = proxy.host_str().unwrap_or_default();
    let proxy_port = proxy.port().unwrap_or_default();
    let decode = |s: &str| percent_decode_str(s).decode_utf8_lossy().into_owned();
    let user = decode(proxy.username());
    let password = decode(proxy.password().unwrap_or_default());
    let tcp = TcpStream::connect((proxy_host, proxy_port))
        .await
        .map_err(|e| format!("Không kết nối được proxy {proxy_host}:{proxy_port}: {e}"))?;
    if proxy.scheme() == "http" {
        let auth = (!user.is_empty()).then_some((user.as_str(), password.as_str()));
        return http_connect(tcp, host, port, auth).await;
    }
    let stream = if user.is_empty() {
        Socks5Stream::connect_with_socket(tcp, (host, port)).await
    } else {
        Socks5Stream::connect_with_password_and_socket(tcp, (host, port), &user, &password).await
    };
    Ok(stream
        .map_err(|e| format!("Proxy SOCKS5 lỗi: {e}"))?
        .into_inner())
}

async fn http_connect(
    mut tcp: TcpStream,
    host: &str,
    port: u16,
    auth: Option<(&str, &str)>,
) -> Result<TcpStream, String> {
    let request = connect_request(host, port, auth);
    tcp.write_all(request.as_bytes())
        .await
        .map_err(|e| format!("Proxy lỗi: {e}"))?;
    let mut reply = Vec::new();
    let mut byte = [0u8; 1];
    while !reply.ends_with(b"\r\n\r\n") {
        if reply.len() > MAX_PROXY_REPLY {
            return Err("Proxy trả lời CONNECT không hợp lệ".into());
        }
        let n = tcp
            .read(&mut byte)
            .await
            .map_err(|e| format!("Proxy lỗi: {e}"))?;
        if n == 0 {
            return Err("Proxy đóng kết nối".into());
        }
        reply.push(byte[0]);
    }
    let head = String::from_utf8_lossy(&reply);
    match head.split_whitespace().nth(1) {
        Some("200") => Ok(tcp),
        Some("407") => Err("Proxy yêu cầu đăng nhập (sai user/pass proxy)".into()),
        _ => Err(format!(
            "Proxy từ chối kết nối: {}",
            head.lines().next().unwrap_or_default()
        )),
    }
}

fn connect_request(host: &str, port: u16, auth: Option<(&str, &str)>) -> String {
    let mut request = format!("CONNECT {host}:{port} HTTP/1.1\r\nHost: {host}:{port}\r\n");
    if let Some((user, password)) = auth {
        let token = BASE64.encode(format!("{user}:{password}"));
        request.push_str(&format!("Proxy-Authorization: Basic {token}\r\n"));
    }
    request.push_str("\r\n");
    request
}

fn tls() -> Connector {
    let mut roots = rustls::RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let config = rustls::ClientConfig::builder_with_provider(Arc::new(
        rustls::crypto::ring::default_provider(),
    ))
    .with_safe_default_protocol_versions()
    .expect("rustls ring provider supports the default TLS versions")
    .with_root_certificates(roots)
    .with_no_client_auth();
    Connector::Rustls(Arc::new(config))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proxy_urls() {
        assert!(parse_proxy("http://u:p@1.2.3.4:8080").is_ok());
        assert!(parse_proxy("socks5://1.2.3.4:1080").is_ok());
        assert!(parse_proxy("socks5h://user:pa%40ss@proxy.example:1080").is_ok());
        assert!(parse_proxy("https://1.2.3.4:8080").is_err());
        assert!(parse_proxy("http://1.2.3.4").is_err());
        assert!(parse_proxy("1.2.3.4:8080").is_err());
    }

    #[test]
    fn connect_request_with_auth() {
        let request = connect_request("sgdev.vip", 3001, Some(("user", "pa:ss")));
        assert_eq!(
            request,
            "CONNECT sgdev.vip:3001 HTTP/1.1\r\nHost: sgdev.vip:3001\r\nProxy-Authorization: Basic dXNlcjpwYTpzcw==\r\n\r\n"
        );
        assert!(!connect_request("sgdev.vip", 3001, None).contains("Authorization"));
    }

    /// Connects to the real Ola socket server (broadcast room, no sign-in, nothing
    /// sent) and waits for the Engine.IO open and Socket.IO connect packets.
    /// Set OLA_TEST_PROXY to go through a proxy. Run with:
    /// cargo test -- --ignored live_handshake
    #[test]
    #[ignore = "network: connects to wss://sgdev.vip:3001"]
    fn live_handshake() {
        let proxy = std::env::var("OLA_TEST_PROXY")
            .ok()
            .map(|p| parse_proxy(&p).unwrap());
        let target = Url::parse(
            "wss://sgdev.vip:3001/socket.io/?key=6Q5AY7RZVR06LFAA07TC&roomNo=Olame&EIO=3&transport=websocket",
        )
        .unwrap();
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let seen = Mutex::new(Vec::<String>::new());
        let (tx, rx) = mpsc::unbounded_channel();
        let result = runtime.block_on(async {
            let emit = |event| {
                if let WsEvent::Message { data } = event {
                    seen.lock().unwrap().push(data);
                }
            };
            // Close once Socket.IO says connected ("40"), or after 10 s.
            let watcher = async {
                for _ in 0..100 {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    if seen.lock().unwrap().iter().any(|m| m == "40") {
                        break;
                    }
                }
                let _ = tx.send(Command::Close);
            };
            tokio::join!(run(target, proxy, rx, emit), watcher).0
        });
        let seen = seen.into_inner().unwrap();
        println!("received: {seen:?}");
        assert!(result.is_ok(), "{result:?}");
        assert!(
            seen.first().is_some_and(|m| m.starts_with("0{")),
            "no Engine.IO open"
        );
        assert!(seen.iter().any(|m| m == "40"), "no Socket.IO connect");
    }
}
