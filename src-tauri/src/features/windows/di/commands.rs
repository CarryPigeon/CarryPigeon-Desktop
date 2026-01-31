use tauri::{AppHandle, LogicalSize, Manager};

use crate::features::windows::di::{info_window, popover_window};

#[tauri::command]
pub fn to_chat_window_size(app: AppHandle) {
    let window = app.get_webview_window("main").unwrap();
    window.set_size(LogicalSize::new(1211, 702)).unwrap()
}

#[tauri::command]
pub async fn open_popover_window(
    app: AppHandle,
    query: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    popover_window::open_popover_window_impl(app, query, x, y, width, height).await
}

#[tauri::command]
pub async fn open_info_window(
    app: AppHandle,
    label: String,
    title: String,
    query: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    info_window::open_info_window_impl(app, label, title, query, width, height).await
}
