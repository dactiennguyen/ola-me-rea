// Tự cập nhật (apps/docs/05-phat-hanh.md#tự-cập-nhật): tauri-plugin-updater reads latest.json of the latest GitHub
// release once as the app opens, and again whenever the user presses Kiểm tra cập nhật (UpdateCorner.tsx, bottom right).
// Nothing is forced: a newer version is only shown; it is downloaded, its minisign signature checked against the public
// key of tauri.conf.json, installed and the app opened again when the user presses Cập nhật. A check that fails (no
// network, GitHub down) blocks nothing. The UI hears of each change with the "update" event.
// Only an installed app updates itself: `tauri dev` and the portable Windows exe carry no bundle type.
use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_updater::{Update, UpdaterExt};

/// Least time between two "update" events while downloading.
const PROGRESS: Duration = Duration::from_millis(250);

/// Where the update stands, as the UI shows it (UpdateView in ../src/lib/update.ts).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "state",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum UpdateState {
    /// This copy does not update itself, and why.
    Off {
        reason: String,
    },
    /// Not checked yet.
    Idle,
    Checking,
    /// The last check found nothing newer, at `checked_at` (ms since 1970).
    Latest {
        checked_at: u64,
    },
    /// A newer version, waiting for the user to press Cập nhật.
    Available {
        version: String,
        notes: String,
    },
    Downloading {
        version: String,
        notes: String,
        got: u64,
        total: Option<u64>,
    },
    /// Downloaded and verified; installing, then the app opens again.
    Installing {
        version: String,
    },
    Failed {
        message: String,
        checked_at: u64,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateView {
    /// The version running.
    pub current: String,
    #[serde(flatten)]
    pub state: UpdateState,
}

#[derive(Default)]
struct Inner {
    state: Option<UpdateState>,
    /// The newer version the last check found, until it is installed.
    available: Option<Update>,
}

/// Managed by the app (lib.rs); the commands and the startup check share it.
#[derive(Default)]
pub struct Updates(Mutex<Inner>);

impl Updates {
    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
    fn state(&self) -> UpdateState {
        self.lock().state.clone().unwrap_or(UpdateState::Idle)
    }
}

fn epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn view<R: Runtime>(app: &AppHandle<R>) -> UpdateView {
    UpdateView {
        current: app.package_info().version.to_string(),
        state: app.state::<Updates>().state(),
    }
}

fn set<R: Runtime>(app: &AppHandle<R>, state: UpdateState) {
    app.state::<Updates>().lock().state = Some(state);
    let _ = app.emit("update", view(app));
}

/// Turns updates off for a copy that cannot update itself, else checks once in the background.
pub fn start<R: Runtime>(app: &AppHandle<R>) {
    if tauri::utils::platform::bundle_type().is_none() {
        app.state::<Updates>().lock().state = Some(UpdateState::Off {
            reason: "bản chạy từ mã nguồn hay bản portable, không phải bản cài".into(),
        });
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move { check(&app).await });
}

/// Checks for a newer version, and only shows it. Does nothing while off, checking, downloading or installing.
pub async fn check<R: Runtime>(app: &AppHandle<R>) {
    {
        let updates = app.state::<Updates>();
        let mut inner = updates.lock();
        match inner.state {
            None
            | Some(
                UpdateState::Idle
                | UpdateState::Latest { .. }
                | UpdateState::Available { .. }
                | UpdateState::Failed { .. },
            ) => inner.state = Some(UpdateState::Checking),
            _ => return,
        }
    }
    let _ = app.emit("update", view(app));
    let found = match app.updater() {
        Ok(updater) => updater.check().await,
        Err(e) => Err(e),
    };
    match found {
        Ok(None) => {
            app.state::<Updates>().lock().available = None;
            set(
                app,
                UpdateState::Latest {
                    checked_at: epoch_ms(),
                },
            )
        }
        Ok(Some(update)) => {
            let state = UpdateState::Available {
                version: update.version.clone(),
                notes: update.body.clone().unwrap_or_default(),
            };
            app.state::<Updates>().lock().available = Some(update);
            set(app, state)
        }
        Err(e) => fail(app, &e),
    }
}

/// Cập nhật: downloads the version found, checks its signature, installs it and opens the app again. On Windows the
/// installer takes over (the app exits and the installer opens it again).
pub async fn install<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let update = {
        let updates = app.state::<Updates>();
        let mut inner = updates.lock();
        if !matches!(inner.state, Some(UpdateState::Available { .. })) {
            return Err("Chưa có bản mới nào để cập nhật".into());
        }
        inner
            .available
            .take()
            .ok_or("Chưa có bản mới nào để cập nhật")?
    };
    let (version, notes) = (
        update.version.clone(),
        update.body.clone().unwrap_or_default(),
    );
    let downloading = |got, total| UpdateState::Downloading {
        version: version.clone(),
        notes: notes.clone(),
        got,
        total,
    };
    set(app, downloading(0, None));
    let (mut got, mut told) = (0u64, Instant::now());
    let bytes = update
        .download(
            |chunk, total| {
                got += chunk as u64;
                if told.elapsed() >= PROGRESS {
                    told = Instant::now();
                    set(app, downloading(got, total));
                }
            },
            || {},
        )
        .await;
    let bytes = match bytes {
        Ok(bytes) => bytes,
        Err(e) => {
            fail(app, &e);
            return Err(message(&e));
        }
    };
    set(
        app,
        UpdateState::Installing {
            version: version.clone(),
        },
    );
    // Off the async workers: macOS may ask for an admin password.
    let result = tauri::async_runtime::spawn_blocking(move || update.install(&bytes))
        .await
        .map_err(|e| e.to_string())?;
    match result {
        Ok(()) => app.restart(),
        Err(e) => {
            let text = format!("không cài được bản {version}: {}", message(&e));
            set(
                app,
                UpdateState::Failed {
                    message: text.clone(),
                    checked_at: epoch_ms(),
                },
            );
            Err(text)
        }
    }
}

fn fail<R: Runtime>(app: &AppHandle<R>, e: &tauri_plugin_updater::Error) {
    eprintln!("Tự cập nhật: {e}");
    set(
        app,
        UpdateState::Failed {
            message: message(e),
            checked_at: epoch_ms(),
        },
    );
}

/// What the UI says of an error of the updater.
fn message(e: &tauri_plugin_updater::Error) -> String {
    use tauri_plugin_updater::Error as E;
    match e {
        E::ReleaseNotFound => "chưa có bản nào trên GitHub Releases có latest.json".into(),
        E::Reqwest(_) | E::Network(_) => format!("không tải được từ GitHub ({e})"),
        E::Minisign(_)
        | E::Base64(_)
        | E::SignatureUtf8(_)
        | E::SignedVersionMismatch { .. }
        | E::MissingSignedVersion => {
            format!("chữ ký của bản tải về không khớp, không cài ({e})")
        }
        E::TargetNotFound(_) | E::TargetsNotFound(_) => {
            format!("bản mới chưa có cho máy này ({e})")
        }
        _ => e.to_string(),
    }
}

/// The update now (the UI reads it once; the "update" event brings every change after).
#[tauri::command]
pub fn update_status(app: AppHandle) -> UpdateView {
    view(&app)
}

/// Kiểm tra cập nhật: checks now; the "update" event tells what it found.
#[tauri::command]
pub async fn check_update(app: AppHandle) {
    check(&app).await;
}

/// Cập nhật: downloads, installs and opens the new version.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    install(&app).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_view_is_flat_camel_case_with_the_state_as_its_tag() {
        let view = |state| {
            serde_json::to_value(UpdateView {
                current: "0.8.0".into(),
                state,
            })
            .unwrap()
        };
        assert_eq!(
            view(UpdateState::Downloading {
                version: "0.9.0".into(),
                notes: "Tự cập nhật".into(),
                got: 1024,
                total: Some(4096),
            }),
            serde_json::json!({ "current": "0.8.0", "state": "downloading", "version": "0.9.0",
                "notes": "Tự cập nhật", "got": 1024, "total": 4096 })
        );
        assert_eq!(
            view(UpdateState::Available {
                version: "0.9.0".into(),
                notes: "".into()
            }),
            serde_json::json!({ "current": "0.8.0", "state": "available", "version": "0.9.0", "notes": "" })
        );
        assert_eq!(
            view(UpdateState::Failed {
                message: "x".into(),
                checked_at: 5
            }),
            serde_json::json!({ "current": "0.8.0", "state": "failed", "message": "x", "checkedAt": 5 })
        );
        assert_eq!(
            view(UpdateState::Idle),
            serde_json::json!({ "current": "0.8.0", "state": "idle" })
        );
    }
}
