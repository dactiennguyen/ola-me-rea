// Thu nhỏ vào khay: the tray icon (menu bar on macOS) with Mở cửa sổ and Thoát,
// and what the close button of the window does.
//
// The choice lives in settings.json (`onClose`, owned by the frontend). The
// frontend mirrors it here with `set_close_action` once settings are loaded;
// until then the close button quits, so a window whose frontend never loaded
// can still be closed. Hidden in the tray, the webview keeps running: the
// signed-in account and its realtime socket stay connected.

use std::sync::Mutex;

use serde::Deserialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Window, WindowEvent};

/// The label of the window in tauri.conf.json.
const MAIN: &str = "main";
/// Told to the frontend when the close button is pressed and the setting is Ask.
const CLOSE_ASKED: &str = "close-asked";

/// `onClose` of settings.json.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OnClose {
    Ask,
    Tray,
    Quit,
}

/// The close action the frontend last reported; None until it has loaded.
#[derive(Default)]
pub struct CloseAction(Mutex<Option<OnClose>>);

impl CloseAction {
    fn get(&self) -> Option<OnClose> {
        *self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Whether the tray icon exists. Without it (e.g. Linux with no AppIndicator),
/// a hidden window could never be shown again, so Tray only minimizes.
pub struct TrayReady(bool);

/// Creates the tray icon; a failure is logged and the app runs without it.
pub fn setup(app: &AppHandle) {
    let ready = match create(app) {
        Ok(()) => true,
        Err(e) => {
            eprintln!("Tray icon unavailable, closing to tray will minimize instead: {e}");
            false
        }
    };
    app.manage(TrayReady(ready));
}

/// The tray icon: a left click shows the window, the menu has Mở cửa sổ and Thoát.
fn create(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Mở cửa sổ", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
    let mut tray = TrayIconBuilder::with_id(MAIN)
        .tooltip(crate::app_name())
        .menu(&Menu::with_items(app, &[&open, &quit])?)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

/// The window back from the tray, the Dock or the taskbar, in front.
pub fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn act(app: &AppHandle, action: OnClose) {
    match action {
        OnClose::Ask => {}
        OnClose::Tray => {
            if let Some(window) = app.get_webview_window(MAIN) {
                let tray = app.try_state::<TrayReady>().is_some_and(|t| t.0);
                let _ = if tray {
                    window.hide()
                } else {
                    window.minimize()
                };
            }
        }
        OnClose::Quit => app.exit(0),
    }
}

/// The close button: hidden in the tray, the frontend asked, or quit.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    if window.label() != MAIN {
        return;
    }
    let action = window
        .try_state::<CloseAction>()
        .and_then(|state| state.get())
        .unwrap_or(OnClose::Quit);
    api.prevent_close();
    match action {
        OnClose::Ask => {
            let _ = window.emit(CLOSE_ASKED, ());
        }
        action => act(window.app_handle(), action),
    }
}

/// The frontend reports `onClose` after loading settings and after each save.
#[tauri::command]
pub fn set_close_action(state: tauri::State<'_, CloseAction>, action: OnClose) {
    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(action);
}

/// A choice of the Đóng cửa sổ dialog: Tray hides the window, Quit ends the app.
#[tauri::command]
pub fn close_window(app: AppHandle, action: OnClose) {
    act(&app, action);
}
