//! windows｜DI/命令入口：commands。
//!
//! 约定：注释中文，日志英文（tracing）。
use tauri::{AppHandle, LogicalSize, Manager};

use crate::features::windows::di::{info_window, popover_window};
use crate::shared::error::{CommandResult, command_error, to_command_error};

/// 将主窗口调整为聊天视图的推荐尺寸。
///
/// # 参数
/// - `app`：Tauri 应用句柄，用于查找并操作窗口。
///
/// # 返回值
/// - `Ok(())`：调整成功。
/// - `Err(String)`：窗口不存在或调整失败原因。
///
/// # 说明
/// - 该命令面向前端触发（`#[tauri::command]`）。
#[tauri::command]
pub fn to_chat_window_size(app: AppHandle) -> CommandResult<()> {
    let window = app.get_webview_window("main").ok_or_else(|| {
        tracing::warn!(action = "windows_chat_window_size_main_window_missing");
        command_error("WINDOW_MAIN_NOT_FOUND", "Main window not found")
    })?;

    window.set_size(LogicalSize::new(1211, 702)).map_err(|err| {
        tracing::warn!(action = "windows_chat_window_size_failed", error = %err);
        to_command_error("WINDOW_RESIZE_FAILED", err)
    })
}

/// 打开用户信息弹窗（Popover）窗口。
///
/// # 参数
/// - `app`：Tauri 应用句柄。
/// - `query`：用于在新窗口内加载页面/路由的 query 字符串（由前端构造）。
/// - `x`/`y`：弹窗显示坐标（逻辑像素）。
/// - `width`/`height`：弹窗尺寸（逻辑像素）。
///
/// # 返回值
/// - `Ok(())`：打开成功。
/// - `Err(String)`：打开失败原因（用于前端提示或上报）。
///
/// # 说明
/// 实际窗口创建与复用逻辑由 `popover_window::open_popover_window_impl` 实现。
#[tauri::command]
pub async fn open_popover_window(
    app: AppHandle,
    query: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> CommandResult<()> {
    popover_window::open_popover_window_impl(app, query, x, y, width, height)
        .await
        .map_err(|err| to_command_error("WINDOW_POPOVER_OPEN_FAILED", err))
}

/// 打开信息展示窗口（Info window）。
///
/// # 参数
/// - `app`：Tauri 应用句柄。
/// - `label`：窗口 label（用于唯一标识/复用）。
/// - `title`：窗口标题。
/// - `query`：用于在新窗口内加载页面/路由的 query 字符串（由前端构造）。
/// - `width`/`height`：窗口尺寸（逻辑像素）。
///
/// # 返回值
/// - `Ok(())`：打开成功。
/// - `Err(String)`：打开失败原因。
///
/// # 说明
/// 实际窗口创建与复用逻辑由 `info_window::open_info_window_impl` 实现。
#[tauri::command]
pub async fn open_info_window(
    app: AppHandle,
    label: String,
    title: String,
    query: String,
    width: f64,
    height: f64,
) -> CommandResult<()> {
    info_window::open_info_window_impl(app, label, title, query, width, height)
        .await
        .map_err(|err| to_command_error("WINDOW_INFO_OPEN_FAILED", err))
}
