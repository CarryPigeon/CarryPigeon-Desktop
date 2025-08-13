use tauri::{AppHandle, LogicalSize, Manager};

#[tauri::command]
pub fn to_chat_window_size(app: AppHandle) {
    let window = app.get_webview_window("main").unwrap();
    window.set_size(LogicalSize::new(1211, 702)).unwrap()
}
