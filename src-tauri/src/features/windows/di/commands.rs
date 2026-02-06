//! windows｜DI/命令入口：commands。
//!
//! 约定：注释中文，日志英文（tracing）。
use tauri::{AppHandle, LogicalSize, Manager};

use crate::features::windows::di::{info_window, popover_window};

/// 将主窗口调整为聊天视图的推荐尺寸。
///
/// # 参数
/// - `app`：Tauri 应用句柄，用于查找并操作窗口。
///
/// # 返回值
/// 无返回值。
///
/// # 说明
/// - 该命令面向前端触发（`#[tauri::command]`）。
/// - 当前实现对 `main` 窗口使用 `unwrap()`：若窗口不存在会 panic（保持与既有行为一致）。
#[tauri::command]
pub fn to_chat_window_size(app: AppHandle) {
    let window = app.get_webview_window("main").unwrap();
    window.set_size(LogicalSize::new(1211, 702)).unwrap()
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
) -> Result<(), String> {
    popover_window::open_popover_window_impl(app, query, x, y, width, height).await
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
) -> Result<(), String> {
    info_window::open_info_window_impl(app, label, title, query, width, height).await
}
