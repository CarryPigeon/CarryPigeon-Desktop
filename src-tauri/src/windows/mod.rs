mod user_popover_window;

use tauri::{AppHandle, LogicalSize, Manager};

pub use user_popover_window::open_user_popover_window;

#[tauri::command]
pub fn to_chat_window_size(app: AppHandle) {
    let window = app.get_webview_window("main").unwrap();
    window.set_size(LogicalSize::new(1211, 702)).unwrap()
}
