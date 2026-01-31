use tauri::{AppHandle, Manager};

pub fn keep_one_popover_window(app: &AppHandle) {
    if let Some(existing) = app
        .get_webview_window("user-info-popover")
        .or(app.get_webview_window("popover"))
        .or(app.get_webview_window("channel-info-popover"))
    {
        let _ = existing.close();
    }
}
