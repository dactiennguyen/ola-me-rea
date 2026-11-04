// Ola Desktop, Rust side.
//
// Almost all logic lives in the TypeScript frontend (reusing the Ola client in
// scripts/nodejs/src). Rust only:
//   - registers the plugins: http (Ola API requests without webview CORS) and
//     store (JSON files in the app data dir: accounts, settings, message cache);
//   - exposes two small commands for the JSON files that hold passwords;
//   - owns the tray icon and the close button (tray.rs).

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
            tray::set_close_action,
            tray::close_window
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
