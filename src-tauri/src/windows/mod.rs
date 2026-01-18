mod popover_window;

use tauri::{AppHandle, LogicalSize, Manager};

pub use popover_window::open_popover_window;

#[tauri::command]
pub fn to_chat_window_size(app: AppHandle) {
    let window = app.get_webview_window("main").unwrap();
    window.set_size(LogicalSize::new(1211, 702)).unwrap()
}

pub fn keep_one_popover_window(app: &AppHandle) {
    if let Some(existing) = app
        .get_webview_window("popover")
        .or(app.get_webview_window("channel-info-popover"))
    {
        let _ = existing.close();
    }
}
