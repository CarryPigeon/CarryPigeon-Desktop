//! screenshot｜Tauri commands
//!
//! 约定：注释中文，日志英文（tracing）。
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use super::capture::{capture_all_screens, ScreenCapture};
use crate::shared::error::{command_error, CommandResult};

/// 截图数据缓存状态：从 `start_screenshot` 暂存，供遮罩窗口 `get_screenshot_data` 取用。
pub struct ScreenshotCaptureState(pub Mutex<Option<Vec<ScreenCapture>>>);

/// 开始截图：隐藏主窗口 → 截取所有显示器 → 打开遮罩窗口。
#[tauri::command]
pub async fn start_screenshot(app: AppHandle) -> CommandResult<()> {
    tracing::info!(action = "screenshot_start");

    // 1. 隐藏主窗口
    if let Some(main_window) = app.get_webview_window("main") {
        main_window
            .hide()
            .map_err(|e| command_error("SCREENSHOT_HIDE_WINDOW_FAIL", &e.to_string()))?;
    }

    // 2. 等窗口完全隐藏
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    // 3. 截取所有显示器
    let captures = capture_all_screens()?;

    // 4. 缓存到托管状态
    app.manage(ScreenshotCaptureState(Mutex::new(Some(captures))));

    // 5. 打开遮罩窗口
    let url = WebviewUrl::App("index.html?window=screenshot-overlay".into());
    let window = WebviewWindowBuilder::new(&app, "screenshot-overlay", url)
        .decorations(false)
        .resizable(false)
        .fullscreen(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .title("")
        .build()
        .map_err(|e| command_error("SCREENSHOT_OVERLAY_FAIL", &e.to_string()))?;

    let _ = window.set_focus();

    tracing::info!(action = "screenshot_overlay_opened");
    Ok(())
}

/// 遮罩窗口调用：获取截图数据（取走后缓存即清除）。
#[tauri::command]
pub async fn get_screenshot_data(
    app: AppHandle,
) -> CommandResult<Vec<ScreenCapture>> {
    if let Some(state) = app.try_state::<ScreenshotCaptureState>() {
        let mut guard = state
            .0
            .lock()
            .map_err(|e| command_error("SCREENSHOT_LOCK_FAIL", &e.to_string()))?;
        if let Some(data) = guard.take() {
            return Ok(data);
        }
    }
    Err(command_error("SCREENSHOT_NO_DATA", ""))
}

/// 完成截图：保存图片 → 通知主窗口 → 关闭遮罩 → 显示主窗口。
#[tauri::command]
pub async fn finish_screenshot(app: AppHandle, data: Vec<u8>) -> CommandResult<String> {
    tracing::info!(action = "screenshot_finish", size = data.len());

    // 1. 保存到临时目录
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| command_error("SCREENSHOT_APP_DATA_FAIL", &e.to_string()))?;
    let screenshot_dir = app_data.join("screenshots");
    std::fs::create_dir_all(&screenshot_dir)
        .map_err(|e| command_error("SCREENSHOT_DIR_FAIL", &e.to_string()))?;

    let filename = format!("{}.png", uuid::Uuid::new_v4());
    let file_path = screenshot_dir.join(&filename);
    std::fs::write(&file_path, &data)
        .map_err(|e| command_error("SCREENSHOT_SAVE_FAIL", &e.to_string()))?;

    let path_str = file_path.to_string_lossy().to_string();

    // 2. 关闭遮罩窗口
    if let Some(overlay) = app.get_webview_window("screenshot-overlay") {
        let _ = overlay.close();
    }

    // 3. 显示主窗口
    if let Some(main_window) = app.get_webview_window("main") {
        main_window
            .show()
            .map_err(|e| command_error("SCREENSHOT_SHOW_WINDOW_FAIL", &e.to_string()))?;
        let _ = main_window.set_focus();
    }

    // 4. 向主窗口发送完成事件
    app.emit("screenshot-completed", &path_str)
        .map_err(|e| command_error("SCREENSHOT_EVENT_FAIL", &e.to_string()))?;

    tracing::info!(action = "screenshot_saved", path = %path_str);
    Ok(path_str)
}

/// 取消截图：关闭遮罩 → 显示主窗口。
#[tauri::command]
pub async fn cancel_screenshot(app: AppHandle) -> CommandResult<()> {
    tracing::info!(action = "screenshot_cancel");

    if let Some(overlay) = app.get_webview_window("screenshot-overlay") {
        let _ = overlay.close();
    }

    if let Some(main_window) = app.get_webview_window("main") {
        main_window
            .show()
            .map_err(|e| command_error("SCREENSHOT_SHOW_WINDOW_FAIL", &e.to_string()))?;
        let _ = main_window.set_focus();
    }

    Ok(())
}
