//! 应用组装入口（Tauri Builder）。
//!
//! 本模块负责：
//! - 组装 Tauri `Builder`（托盘、窗口事件、command 注册等）
//! - 注册 `app://` 自定义 scheme（用于安全地加载本地插件静态资源）
//!
//! 约定：
//! - 注释统一使用中文，便于团队维护与交接。
//! - 日志输出统一使用英文，便于跨端检索与与上游/第三方日志对齐。

use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::Context;
use tauri::{
    Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tracing_subscriber::prelude::*;

pub mod log_commands;

use crate::features::network::usecases::tcp_usecases::TcpRegistryService;
use crate::features::plugins::data::plugin_store;
use crate::features::settings::data::config_store::{Config, config_file_path};
use crate::features::settings::data::config_store_port_adapter::ConfigStorePortAdapter;
use crate::features::settings::domain::settings_schema::SettingsImportEnvelopeV1;
use crate::features::tray::di::commands::{TrayUnreadState, start_hover_timer};
use crate::features::tray::domain::tray_i18n::tray_labels;
use crate::shared::close_to_tray_state::CloseToTrayState;
use crate::shared::temp_file::TempFileManager;
use crate::shared::window_bounds::{self, WindowBounds};

/// Wraps the `tracing_appender::WorkerGuard` for managed-state storage
/// so it is dropped on Tauri shutdown, flushing buffered logs to disk.
#[allow(dead_code)]
struct LogFlushGuard(std::sync::Mutex<Option<tracing_appender::non_blocking::WorkerGuard>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// 启动 Tauri 应用。
///
/// # 返回值
/// 当 Builder 组装或初始化失败时返回错误。
pub fn run() -> anyhow::Result<()> {
    // 设置 panic hook，在 panic 时记录到 tracing
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let payload = info
            .payload()
            .downcast_ref::<&str>()
            .copied()
            .unwrap_or_else(|| {
                info.payload()
                    .downcast_ref::<String>()
                    .map(|s| s.as_str())
                    .unwrap_or("<non-string>")
            });
        tracing::error!(
            action = "app_rust_panic",
            payload = %payload,
            location = ?info.location(),
        );
        default_hook(info);
    }));

    // Tauri Builder 组装
    tauri::Builder::default()
        // 注册自定义 scheme 处理器，安全地加载本地插件静态资源（如 JS/CSS），避免直接暴露文件系统路径。
        .register_uri_scheme_protocol("app", |_, req| handle_app_scheme(req).unwrap_or_else(|e| {
            tracing::warn!(action = "app_scheme_handler_failed", error = %e);
            build_http_response(500, None, Vec::new())
        }))
        // 初始化应用（托盘、全局事件等）
        .setup(|app| {
            // 初始化 TCP 注册表服务（用于命令层注入）。
            app.manage(TcpRegistryService::new());
            // 获取默认窗口图标，作为托盘图标使用（确保应用资源中已设置默认图标）
            let tray_icon = app
                .default_window_icon()
                .cloned()
                .context("Default window icon is missing")?;

            // 初始化托盘未读闪烁状态（to_owned 将 App 借用的图片转为 'static）。
            app.manage(TrayUnreadState::new(tray_icon.clone().to_owned()));

            // 初始化临时文件管理器
            // 注意：setup() 已运行在 tokio 运行时上下文中，不能在当前线程 block_on。
            // 需要在独立 OS 线程中创建新的 tokio 运行时来执行异步初始化。
            let app_data_dir = app.path().app_data_dir().context("Failed to get app data dir")?;
            crate::shared::app_data_dir::init_app_data_dir(app_data_dir.clone())?;

            // 初始化文件日志
            let log_dir = app_data_dir.join("logs");
            std::fs::create_dir_all(&log_dir).ok();
            let file_appender = tracing_appender::rolling::daily(&log_dir, "app.log");
            let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
            let file_layer = tracing_subscriber::fmt::layer()
                .with_writer(non_blocking)
                .with_ansi(false);
            // 尝试添加 file_layer 到全局 subscriber
            if let Err(e) = tracing_subscriber::registry()
                .with(tracing_subscriber::EnvFilter::from_default_env())
                .with(file_layer)
                .try_init()
            {
                // 如果 subscriber 已经设定，file_layer 会失败 — 用 warn 记录（会写入现有 subscriber）
                tracing::warn!(action = "app_file_logger_already_set", error = %e);
            }
            // Store the log guard as Tauri managed state so it lives for
            // the app's lifetime and properly flushes buffered logs on drop.
            app.manage(LogFlushGuard(std::sync::Mutex::new(Some(guard))));

            let metadata_db_path = app_data_dir.join("temp_files").join("metadata.db");
            let temp_file_manager = std::thread::spawn({
                let app_data_dir = app_data_dir.clone();
                let metadata_db_path = metadata_db_path.clone();
                move || {
                    let rt = tokio::runtime::Runtime::new()
                        .context("Failed to create tokio runtime")?;
                    rt.block_on(TempFileManager::new(app_data_dir, metadata_db_path))
                }
            })
            .join()
            .map_err(|e| anyhow::anyhow!("Failed to join TempFileManager init thread: {e:?}"))
            .context("TempFileManager init thread panicked")??;

            app.manage(temp_file_manager);

            // 恢复主窗口位置/尺寸：读取上次保存的 bounds 并应用，
            // 然后显示窗口以避免出现默认尺寸闪烁。
            if let Some(window) = app.get_webview_window("main") {
                if let Some(bounds) = window_bounds::load() {
                    if is_bounds_within_monitors(app.handle(), &bounds) {
                        let _ = window.set_size(tauri::PhysicalSize::new(bounds.width, bounds.height));
                        let _ = window.set_position(tauri::PhysicalPosition::new(bounds.x, bounds.y));
                        tracing::info!(
                            action = "window_bounds_restore_applied",
                            width = bounds.width,
                            height = bounds.height,
                            x = bounds.x,
                            y = bounds.y
                        );
                    } else {
                        tracing::warn!(
                            action = "window_bounds_restore_out_of_range",
                            width = bounds.width,
                            height = bounds.height,
                            x = bounds.x,
                            y = bounds.y
                        );
                    }
                } else {
                    tracing::info!(action = "window_bounds_restore_none");
                }
                let _ = window.show();
            } else {
                tracing::warn!(action = "window_bounds_main_window_missing");
            }

            // 同步读取 close_to_tray 设置，缓存到托管状态供窗口关闭事件使用。
            // 优先解析信封格式（迁移后），回退到旧版 Config 格式。
            let config_path = config_file_path();
            let close_to_tray = std::fs::read_to_string(&config_path)
                .ok()
                .and_then(|raw| {
                    serde_json::from_str::<SettingsImportEnvelopeV1>(&raw)
                        .map(|e| e.backend.close_to_tray)
                        .or_else(|_| {
                            serde_json::from_str::<Config>(&raw).map(|c| c.close_to_tray)
                        })
                        .ok()
                })
                .unwrap_or(true); // 默认启用关闭到托盘（聊天应用标准行为）。
            tracing::info!(action = "app_close_to_tray_init", close_to_tray = close_to_tray);
            app.manage(CloseToTrayState(AtomicBool::new(close_to_tray)));
            // 初始化 ConfigStorePortAdapter 的 AppHandle 引用，
            // 使 close_to_tray 缓存同步在 data 层完成，无需 di/commands 感知。
            ConfigStorePortAdapter::init_app_handle(app.handle());

            // 启动时清理过期临时文件（后台执行，不需要阻塞 setup）
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<TempFileManager>();
                if let Err(e) = state.cleanup(None, 24).await {
                    tracing::warn!(action = "app_temp_file_startup_cleanup_failed", error = %e);
                }
                // 重启后默认不续传：清理未完成的下载 .part 与记录
                if let Err(e) = state.prune_incomplete_downloads().await {
                    tracing::warn!(action = "app_temp_file_prune_failed", error = %e);
                }
            });

            // 定义托盘菜单行为（默认中文，前端启动后根据 locale 同步更新）
            let labels = tray_labels("zh_cn");
            let show_i = MenuItem::with_id(app, labels[0].0, labels[0].1.clone(), true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, labels[1].0, labels[1].1.clone(), true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sep, &quit_i])?;

            // 定义托盘图标行为
            let _tray = TrayIconBuilder::with_id("main")
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_window" => {
                        tracing::info!(action = "app_tray_menu_clicked", item_id = "show_window");
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        } else {
                            tracing::warn!(action = "app_tray_menu_main_window_missing");
                        }
                    }
                    "quit" => {
                        tracing::info!(action = "app_tray_menu_clicked", item_id = "quit");
                        app.exit(0);
                    }
                    _ => {
                        tracing::warn!(action = "app_tray_menu_unhandled", item_id = ?event.id);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if let Err(err) = window.unminimize() {
                                    tracing::warn!(action = "app_tray_click_unminimize_failed", error = %err);
                                }
                                if let Err(err) = window.show() {
                                    tracing::warn!(action = "app_tray_click_show_failed", error = %err);
                                }
                                if let Err(err) = window.set_focus() {
                                    tracing::warn!(action = "app_tray_click_focus_failed", error = %err);
                                }
                            } else {
                                tracing::warn!(action = "app_tray_click_main_window_missing");
                            }
                        }
                        TrayIconEvent::Enter { rect, .. } => {
                            let app = tray.app_handle();
                            let state: tauri::State<'_, TrayUnreadState> = app.state();
                            state.is_hovering.store(true, std::sync::atomic::Ordering::SeqCst);
                            let (px, py) = match rect.position {
                                tauri::Position::Physical(p) => (p.x as f64, p.y as f64),
                                tauri::Position::Logical(p) => (p.x, p.y),
                            };
                            let (pw, _ph) = match rect.size {
                                tauri::Size::Physical(s) => (s.width as f64, s.height as f64),
                                tauri::Size::Logical(s) => (s.width, s.height),
                            };
                            let x = px + pw;
                            let y = py;
                            start_hover_timer(app.clone(), &state, x, y);
                        }
                        TrayIconEvent::Leave { .. } => {
                            let app = tray.app_handle();
                            let state: tauri::State<'_, TrayUnreadState> = app.state();
                            state.is_hovering.store(false, std::sync::atomic::Ordering::SeqCst);
                            state.popover_open.store(false, std::sync::atomic::Ordering::SeqCst);
                            if let Some(win) = app.get_webview_window("tray-notification-popover")
                                && let Err(err) = win.close() {
                                    tracing::warn!(action = "app_tray_leave_close_popover_failed", error = %err);
                                }
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            let label = window.label();
            // 子窗口失焦自动关闭。
            if (label == "user-info-popover" || label == "tray-notification-popover")
                && matches!(event, &tauri::WindowEvent::Focused(false))
            {
                let _ = window.close();
            }
            // 主窗口 resize/move 时持久化当前 bounds。
            if label == "main" {
                match event {
                    tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
                        if let Some(bounds) = current_main_bounds(window) {
                            window_bounds::save_async(bounds);
                        }
                    }
                    _ => {}
                }
            }
            // 主窗口关闭时，若 close_to_tray 为 true，则阻止关闭并隐藏到托盘。
            if label == "main"
                && let tauri::WindowEvent::CloseRequested { api, .. } = event
                    && let Some(state) = window.app_handle().try_state::<CloseToTrayState>()
                        && state.0.load(Ordering::SeqCst) {
                            // 关闭到托盘前最后一次持久化当前 bounds。
                            if let Some(bounds) = current_main_bounds(window) {
                                window_bounds::save(bounds);
                            }
                            api.prevent_close();
                            let _ = window.hide();
                            tracing::info!(action = "app_main_window_hide_to_tray");
                        }
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(crate::features::voice_call::di::commands::VoiceCallService::new())
        .manage(crate::features::voice_message::di::commands::VoiceRecorderState(
            std::sync::Mutex::new(None),
        ))
        // 注册对外暴露的事件钩子
        .invoke_handler(tauri::generate_handler![
            // tray
            crate::features::tray::di::commands::set_tray_unread_flashing,
            crate::features::tray::di::commands::set_tray_locale,
            // windows
            crate::features::windows::di::commands::to_chat_window_size,
            crate::features::windows::di::commands::open_popover_window,
            crate::features::windows::di::commands::open_info_window,
            crate::features::windows::di::commands::close_tray_notification_popover,
            // network
            crate::features::network::di::commands::send_tcp_service,
            crate::features::network::di::commands::add_tcp_service,
            crate::features::network::di::commands::remove_tcp_service,
            crate::features::network::di::commands::api_request_json,
            crate::features::network::di::commands::download_file,
            // link_preview
            crate::features::network::link_preview::fetch_link_preview,
            // temp_file
            crate::shared::temp_file::commands::cleanup_temp_files,
            crate::shared::temp_file::commands::remove_temp_file,
            crate::shared::temp_file::commands::save_temp_file,
            crate::shared::temp_file::commands::open_temp_file,
            // db
            crate::shared::db::commands::db_init,
            crate::shared::db::commands::db_execute,
            crate::shared::db::commands::db_query,
            crate::shared::db::commands::db_transaction,
            crate::shared::db::commands::db_path,
            crate::shared::db::commands::db_close,
            crate::shared::db::commands::db_remove,
            crate::shared::chat_cache::commands::chat_cache_get,
            crate::shared::chat_cache::commands::chat_cache_load_all,
            crate::shared::chat_cache::commands::chat_cache_clear_all,
            crate::shared::chat_cache::commands::chat_cache_put,
            crate::shared::chat_cache::commands::chat_cache_remove,
            crate::shared::chat_cache::commands::chat_cache_remove_many,
            // logs
            crate::app::log_commands::write_app_log,
            crate::app::log_commands::read_app_log_lines,
            crate::shared::log::log_info,
            crate::shared::log::log_error,
            crate::shared::log::log_warning,
            crate::shared::log::log_debug,
            // settings/config
            crate::features::settings::di::commands::get_config,
            crate::features::settings::di::commands::export_settings,
            crate::features::settings::di::commands::import_settings,
            crate::features::settings::di::commands::reset_settings,
            crate::features::settings::di::commands::get_config_bool,
            crate::features::settings::di::commands::get_config_u32,
            crate::features::settings::di::commands::get_config_u64,
            crate::features::settings::di::commands::get_config_string,
            crate::features::settings::di::commands::get_server_config_string,
            crate::features::settings::di::commands::get_server_config_u32,
            crate::features::settings::di::commands::get_server_config_u64,
            crate::features::settings::di::commands::get_server_config_bool,
            crate::features::settings::di::commands::update_config_bool,
            crate::features::settings::di::commands::update_config_u32,
            crate::features::settings::di::commands::update_config_string,
            // plugins legacy debug commands
            crate::features::plugins::di::commands::load_plugin,
            crate::features::plugins::di::commands::list_plugins,
            // plugins
            crate::features::plugins::di::commands::plugins_list_installed,
            crate::features::plugins::di::commands::plugins_get_installed_state,
            crate::features::plugins::di::commands::plugins_get_runtime_entry,
            crate::features::plugins::di::commands::plugins_get_runtime_entry_for_version,
            crate::features::plugins::di::commands::plugins_install_from_server_catalog,
            crate::features::plugins::di::commands::plugins_install_from_url,
            crate::features::plugins::di::commands::plugins_enable,
            crate::features::plugins::di::commands::plugins_disable,
            crate::features::plugins::di::commands::plugins_switch_version,
            crate::features::plugins::di::commands::plugins_uninstall,
            crate::features::plugins::di::commands::plugins_set_failed,
            crate::features::plugins::di::commands::plugins_clear_error,
            crate::features::plugins::di::commands::plugins_storage_get,
            crate::features::plugins::di::commands::plugins_storage_set,
            crate::features::plugins::di::commands::plugins_network_fetch,
            // voice_message
            crate::features::voice_message::di::commands::start_voice_recording,
            crate::features::voice_message::di::commands::stop_voice_recording,
            crate::features::voice_message::di::commands::read_file_base64,
            crate::features::voice_message::di::commands::read_file_base64_chunk,
            // emoji
            crate::features::emoji::di::commands::list_custom_emojis,
            crate::features::emoji::di::commands::save_emoji,
            crate::features::emoji::di::commands::delete_emoji,
            crate::features::emoji::di::commands::copy_emoji,
            crate::features::emoji::di::commands::write_temp_emoji_file,
            crate::features::emoji::di::commands::get_emoji_image_path,
            // screenshot
            crate::features::screenshot::di::commands::start_screenshot,
            crate::features::screenshot::di::commands::get_screenshot_data,
            crate::features::screenshot::di::commands::finish_screenshot,
            crate::features::screenshot::di::commands::cancel_screenshot,
            // voice_call
            crate::features::voice_call::di::commands::connect_signaling,
            crate::features::voice_call::di::commands::start_direct_call,
            crate::features::voice_call::di::commands::start_conference,
            crate::features::voice_call::di::commands::accept_call,
            crate::features::voice_call::di::commands::reject_call,
            crate::features::voice_call::di::commands::hangup_call,
            crate::features::voice_call::di::commands::toggle_mute,
            crate::features::voice_call::di::commands::toggle_noise_suppression,
            crate::features::voice_call::di::commands::enumerate_input_devices,
            crate::features::voice_call::di::commands::enumerate_output_devices,
            crate::features::voice_call::di::commands::enumerate_audio_devices,
            crate::features::voice_call::di::commands::select_input_device,
            crate::features::voice_call::di::commands::select_output_device,
            crate::features::voice_call::di::commands::join_conference,
            crate::features::voice_call::di::commands::leave_conference,
            crate::features::voice_call::di::commands::send_video_signaling,
        ])
        .run(tauri::generate_context!())
        .context("error while running tauri application")?;
    Ok(())
}

/// 构建 HTTP 响应（用于自定义 scheme handler）。
///
/// # 参数
/// - `status`：HTTP 状态码。
/// - `content_type`：可选的 Content-Type。
/// - `body`：响应体字节。
fn build_http_response(
    status: u16,
    content_type: Option<&str>,
    body: Vec<u8>,
) -> tauri::http::Response<Vec<u8>> {
    let mut builder = tauri::http::Response::builder().status(status);
    if let Some(content_type) = content_type {
        builder = builder.header("Content-Type", content_type);
    }

    match builder.body(body) {
        Ok(response) => response,
        Err(err) => {
            tracing::error!(
                action = "app_scheme_response_build_failed",
                status,
                error = %err
            );
            tauri::http::Response::new(Vec::new())
        }
    }
}

/// 根据文件后缀推导 MIME 类型。
///
/// # 参数
/// - `path`: 文件路径（通常为 URL 的相对路径）。
///
/// # 返回值
/// MIME 字符串（默认 `application/octet-stream`）。
fn mime_by_path(path: &str) -> &'static str {
    let p = path.to_lowercase();
    if p.ends_with(".js") || p.ends_with(".mjs") {
        return "text/javascript; charset=utf-8";
    }
    if p.ends_with(".css") {
        return "text/css; charset=utf-8";
    }
    if p.ends_with(".json") {
        return "application/json; charset=utf-8";
    }
    if p.ends_with(".svg") {
        return "image/svg+xml";
    }
    if p.ends_with(".png") {
        return "image/png";
    }
    if p.ends_with(".jpg") || p.ends_with(".jpeg") {
        return "image/jpeg";
    }
    if p.ends_with(".webp") {
        return "image/webp";
    }
    if p.ends_with(".woff") {
        return "font/woff";
    }
    if p.ends_with(".woff2") {
        return "font/woff2";
    }
    if p.ends_with(".ttf") {
        return "font/ttf";
    }
    "application/octet-stream"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mime_by_path_js() {
        assert_eq!(mime_by_path("bundle.js"), "text/javascript; charset=utf-8");
    }

    #[test]
    fn mime_by_path_css() {
        assert_eq!(mime_by_path("style.css"), "text/css; charset=utf-8");
    }

    #[test]
    fn mime_by_path_json() {
        assert_eq!(mime_by_path("data.json"), "application/json; charset=utf-8");
    }

    #[test]
    fn mime_by_path_png() {
        assert_eq!(mime_by_path("icon.png"), "image/png");
    }

    #[test]
    fn mime_by_path_jpg() {
        assert_eq!(mime_by_path("photo.jpg"), "image/jpeg");
        assert_eq!(mime_by_path("photo.jpeg"), "image/jpeg");
    }

    #[test]
    fn mime_by_path_svg() {
        assert_eq!(mime_by_path("logo.svg"), "image/svg+xml");
    }

    #[test]
    fn mime_by_path_webp() {
        assert_eq!(mime_by_path("img.webp"), "image/webp");
    }

    #[test]
    fn mime_by_path_woff() {
        assert_eq!(mime_by_path("font.woff"), "font/woff");
    }

    #[test]
    fn mime_by_path_woff2() {
        assert_eq!(mime_by_path("font.woff2"), "font/woff2");
    }

    #[test]
    fn mime_by_path_ttf() {
        assert_eq!(mime_by_path("font.ttf"), "font/ttf");
    }

    #[test]
    fn mime_by_path_case_insensitive() {
        assert_eq!(mime_by_path("IMAGE.PNG"), "image/png");
    }

    #[test]
    fn mime_by_path_unknown() {
        assert_eq!(mime_by_path("file.xyz"), "application/octet-stream");
    }

    #[test]
    fn mime_by_path_no_extension() {
        assert_eq!(mime_by_path("README"), "application/octet-stream");
    }

    #[test]
    fn percent_decode_no_encoding() {
        assert_eq!(percent_decode("hello"), "hello");
    }

    #[test]
    fn percent_decode_single_char() {
        assert_eq!(percent_decode("hello%20world"), "hello world");
    }

    #[test]
    fn percent_decode_multiple() {
        assert_eq!(percent_decode("%48%65%6c%6c%6f"), "Hello");
    }

    #[test]
    fn percent_decode_mixed_case() {
        assert_eq!(percent_decode("%2f%2F"), "//");
    }

    #[test]
    fn percent_decode_invalid_sequence_kept() {
        let result = percent_decode("hello%XXworld");
        assert!(result.contains("hello"));
        assert!(result.contains("world"));
    }

    #[test]
    fn percent_decode_empty() {
        assert_eq!(percent_decode(""), "");
    }
}

/// 最小化 percent 解码器。
///
/// 说明：只覆盖本项目 scheme 中会出现的 URL path segment（server_id/plugin_id/version/path）。
///
/// # 参数
/// - `input`: URL path segment（可能包含 `%xx`）。
///
/// # 返回值
/// 解码后的字符串（对非法输入做 best-effort 处理）。
fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0usize;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let a = bytes[i + 1];
            let b = bytes[i + 2];
            let hex = |c: u8| -> Option<u8> {
                match c {
                    b'0'..=b'9' => Some(c - b'0'),
                    b'a'..=b'f' => Some(c - b'a' + 10),
                    b'A'..=b'F' => Some(c - b'A' + 10),
                    _ => None,
                }
            };
            if let (Some(ha), Some(hb)) = (hex(a), hex(b)) {
                out.push((ha << 4) | hb);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

/// 处理 `app://` scheme 请求。
///
/// 当前仅支持插件静态资源：
/// `app://plugins/<server_id>/<plugin_id>/<version>/<path>`
///
/// # 参数
/// - `req`: Tauri scheme 请求。
///
/// # 返回值
/// HTTP 响应（200/400/404）。
fn handle_app_scheme(
    req: tauri::http::Request<Vec<u8>>,
) -> Result<tauri::http::Response<Vec<u8>>, anyhow::Error> {
    let uri = req.uri().to_string();
    // 只处理插件静态资源请求：`app://plugins/<server_id>/<plugin_id>/<version>/<path>`
    if !uri.starts_with("app://plugins/") {
        return Ok(build_http_response(404, None, Vec::new()));
    }
    let rest = &uri["app://plugins/".len()..];
    let path_only = rest
        .split('?')
        .next()
        .unwrap_or(rest)
        .split('#')
        .next()
        .unwrap_or(rest);
    let segs: Vec<&str> = path_only.split('/').filter(|s| !s.is_empty()).collect();
    if segs.len() < 4 {
        return Ok(build_http_response(400, None, Vec::new()));
    }

    let server_id = percent_decode(segs[0]);
    let plugin_id = percent_decode(segs[1]);
    let version = percent_decode(segs[2]);
    let rel_path = segs[3..]
        .iter()
        .map(|s| percent_decode(s))
        .collect::<Vec<String>>()
        .join("/");

    let file_path = plugin_store::resolve_app_plugins_canonical_file_path(
        &server_id, &plugin_id, &version, &rel_path,
    )?;
    let bytes = std::fs::read(&file_path)
        .with_context(|| format!("Failed to read plugin file: {}", file_path.display()))?;

    Ok(build_http_response(
        200,
        Some(mime_by_path(&rel_path)),
        bytes,
    ))
}

/// 读取主窗口当前的物理 bounds。
///
/// 当窗口最小化或不可见时 outer_size 可能为 0，跳过保存以避免坏值。
fn current_main_bounds(window: &tauri::Window) -> Option<WindowBounds> {
    if !window.is_visible().unwrap_or(false) {
        return None;
    }
    let size = window.outer_size().ok()?;
    let pos = window.outer_position().ok()?;
    let scale = window.scale_factor().unwrap_or(1.0);
    let width = (f64::from(size.width) / scale).round().max(1.0) as u32;
    let height = (f64::from(size.height) / scale).round().max(1.0) as u32;
    let x = (f64::from(pos.x) / scale).round() as i32;
    let y = (f64::from(pos.y) / scale).round() as i32;
    Some(WindowBounds {
        width,
        height,
        x,
        y,
    })
}

/// 校验 bounds 是否落在任意可用显示器的工作区内（防止越界）。
///
/// 允许较小偏差（窗口标题栏等可能略出屏）。
fn is_bounds_within_monitors<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    b: &WindowBounds,
) -> bool {
    let Ok(monitors) = app.available_monitors() else {
        // 拿不到显示器列表时不做校验，默认通过。
        return true;
    };
    if monitors.is_empty() {
        return true;
    }
    for m in monitors {
        let mpos = m.position();
        let msize = m.size();
        let mx0 = mpos.x;
        let my0 = mpos.y;
        let mx1 = mpos.x + msize.width as i32;
        let my1 = mpos.y + msize.height as i32;
        let wx1 = b.x + b.width as i32;
        let wy1 = b.y + b.height as i32;
        // 至少 64x64 像素落在某显示器工作区内。
        let overlap_w = (wx1.min(mx1) - b.x.max(mx0)).max(0);
        let overlap_h = (wy1.min(my1) - b.y.max(my0)).max(0);
        if overlap_w >= 64 && overlap_h >= 64 {
            return true;
        }
    }
    false
}
pub mod commands;
