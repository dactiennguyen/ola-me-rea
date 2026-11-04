// Ola Desktop, Rust side.
//
// Almost all logic lives in the TypeScript frontend (reusing the Ola client in
// scripts/nodejs/src). Rust only:
//   - registers the plugins: http (Ola API requests without webview CORS) and
//     store (JSON files in the app data dir: accounts, settings, message cache);
//   - exposes two small commands for the JSON files that hold passwords;
//   - owns the tray icon and the close button (tray.rs);
//   - opens WebSockets through a proxy (socket.rs);
//   - keeps the log of sent 1-1 messages in SQLite (sentlog.rs).

mod sentlog;
mod socket;
mod tray;

use std::path::PathBuf;

use tauri::Manager;

/// JSON files the frontend may ask about. Fixed names only, so a command
/// argument can never point outside the app data dir.
const DATA_FILES: &[&str] = &["accounts.json", "settings.json"];

fn data_file(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    if !DATA_FILES.contains(&name) {
        return Err(format!("unknown data file: {name}"));
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

/// Folder holding accounts.json, settings.json and the message cache.
#[tauri::command]
fn data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Makes a data file readable by the current user only (chmod 600).
/// accounts.json stores passwords as plain JSON by design; this limits who can read it.
#[tauri::command]
fn restrict_data_file(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let path = data_file(&app, &name)?;
    if !path.exists() {
        return Ok(());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Export file names: `ola-accounts-YYYYMMDD-HHMMSS.json` (account list) or
/// `ola-users-YYYYMMDD-HHMMSS.json|.csv` (collected users). Returns the extension.
fn export_extension(name: &str) -> Option<&'static str> {
    let (rest, allowed): (&str, &[&'static str]) =
        if let Some(rest) = name.strip_prefix("ola-accounts-") {
            (rest, &[".json"])
        } else if let Some(rest) = name.strip_prefix("ola-users-") {
            (rest, &[".json", ".csv"])
        } else {
            return None;
        };
    let ext = allowed.iter().copied().find(|ext| rest.ends_with(ext))?;
    let stamp = &rest[..rest.len() - ext.len()];
    let valid = stamp.len() == 15
        && stamp.bytes().enumerate().all(|(i, b)| {
            if i == 8 {
                b == b'-'
            } else {
                b.is_ascii_digit()
            }
        });
    valid.then_some(ext)
}

/// Writes an export (account list with passwords, or collected users) to the
/// Downloads folder and returns its path. Never overwrites: a taken name gets -2, -3….
#[tauri::command]
fn export_accounts_file(
    app: tauri::AppHandle,
    name: String,
    content: String,
) -> Result<String, String> {
    let Some(ext) = export_extension(&name) else {
        return Err(format!("invalid export file name: {name}"));
    };
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let stem = &name[..name.len() - ext.len()];
    for n in 1..=20 {
        let path = if n == 1 {
            dir.join(&name)
        } else {
            dir.join(format!("{stem}-{n}{ext}"))
        };
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&path) {
            Ok(mut file) => {
                use std::io::Write;
                file.write_all(content.as_bytes())
                    .map_err(|e| e.to_string())?;
                return Ok(path.to_string_lossy().into_owned());
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
    Err("too many exports with the same name in Downloads".into())
}

/// The app's name in its window title and tray: Ola Desktop DEV under `yarn app:dev`.
pub fn app_name() -> &'static str {
    if tauri::is_dev() {
        "Ola Desktop DEV"
    } else {
        "Ola Desktop"
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(tray::CloseAction::default())
        .manage(std::sync::Arc::new(socket::Sockets::default()))
        .manage(sentlog::SentLog::default())
        .setup(|app| {
            // tauri.dev.conf.json renames the dev app but cannot change the window
            // title without repeating the whole window, so the title is set here.
            if tauri::is_dev() {
                if let Some(window) = app.get_webview_window("main") {
                    window.set_title(app_name())?;
                }
            }
            tray::setup(app.handle());
            Ok(())
        })
        .on_window_event(tray::on_window_event)
        .invoke_handler(tauri::generate_handler![
            data_dir,
            restrict_data_file,
            export_accounts_file,
            tray::set_close_action,
            tray::close_window,
            socket::ws_open,
            socket::ws_send,
            socket::ws_close,
            sentlog::sent_log_add,
            sentlog::sent_log_recent,
            sentlog::sent_log_contacts
        ])
        .build(tauri::generate_context!())
        .expect("error while building Ola Desktop")
        .run(|_app, _event| {
            // The Dock icon clicked while the window is in the tray.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows: false,
                ..
            } = _event
            {
                tray::show(_app);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::export_extension;

    fn is_export_name(name: &str) -> bool {
        export_extension(name).is_some()
    }

    #[test]
    fn export_names() {
        assert_eq!(
            export_extension("ola-accounts-20261104-090807.json"),
            Some(".json")
        );
        assert_eq!(
            export_extension("ola-users-20261104-090807.json"),
            Some(".json")
        );
        assert_eq!(
            export_extension("ola-users-20261104-090807.csv"),
            Some(".csv")
        );
        for bad in [
            "ola-accounts-20261104-090807.txt",
            "ola-accounts-20261104-090807.csv",
            "ola-users-20261104-090807.txt",
            "ola-other-20261104-090807.json",
            "ola-accounts-2026110-4090807.json",
            "ola-accounts-20261104-09080.json",
            "../ola-accounts-20261104-090807.json",
            "ola-accounts-20261104-090807.json/../x",
            "accounts.json",
        ] {
            assert!(!is_export_name(bad), "{bad}");
        }
    }
}
