use anyhow::Context;
use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::features::network::init_tcp_service;
use crate::features::plugins::data::plugin_store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    tauri::Builder::default()
        .register_uri_scheme_protocol("app", |_, req| match handle_app_scheme(req) {
            Ok(res) => res,
            Err(e) => {
                tracing::warn!("app:// scheme handler failed: {}", e);
                tauri::http::Response::builder()
                    .status(500)
                    .body(Vec::new())
                    .unwrap()
            }
        })
        .setup(|app| {
            init_tcp_service();

            // 定义托盘菜单行为
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i])?;

            // 定义托盘图标行为
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        println!("quit menu item was clicked");
                        app.exit(0);
                    }
                    _ => {
                        tracing::warn!("menu item {:?} not handled", event.id);
                    }
                })
                .on_tray_icon_event(|tray, event| match event {
                    // 设置鼠标左键单击行为
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        position: _,
                        id: _,
                        rect: _,
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "user-info-popover" {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = window.close();
                }
            }
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // windows
            crate::features::windows::di::commands::to_chat_window_size,
            crate::features::windows::di::commands::open_popover_window,
            crate::features::windows::di::commands::open_info_window,
            // network
            crate::features::network::di::commands::send_tcp_service,
            crate::features::network::di::commands::listen_tcp_service,
            crate::features::network::di::commands::add_tcp_service,
            crate::features::network::di::commands::api_request_json,
            // db
            crate::shared::db::commands::db_init,
            crate::shared::db::commands::db_execute,
            crate::shared::db::commands::db_query,
            crate::shared::db::commands::db_transaction,
            crate::shared::db::commands::db_close,
            crate::shared::db::commands::db_remove,
            crate::shared::db::commands::db_path,
            // logs
            crate::shared::log::log_info,
            crate::shared::log::log_error,
            crate::shared::log::log_warning,
            crate::shared::log::log_debug,
            // settings/config
            crate::features::settings::di::commands::get_config,
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
            crate::features::settings::di::commands::update_config_u64,
            crate::features::settings::di::commands::update_config_string,
            // plugins
            crate::features::plugins::di::commands::load_plugin,
            crate::features::plugins::di::commands::list_plugins,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}

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

fn percent_decode(input: &str) -> String {
    // Minimal percent decoder: enough for URL segments used by plugin_id/version/path.
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

fn handle_app_scheme(
    req: tauri::http::Request<Vec<u8>>,
) -> Result<tauri::http::Response<Vec<u8>>, anyhow::Error> {
    let uri = req.uri().to_string();
    // We only handle plugin assets: `app://plugins/<server_id>/<plugin_id>/<version>/<path>`
    if !uri.starts_with("app://plugins/") {
        return Ok(tauri::http::Response::builder()
            .status(404)
            .body(Vec::new())
            .unwrap());
    }
    let rest = &uri["app://plugins/".len()..];
    let path_only = rest.split('?').next().unwrap_or(rest).split('#').next().unwrap_or(rest);
    let segs: Vec<&str> = path_only.split('/').filter(|s| !s.is_empty()).collect();
    if segs.len() < 4 {
        return Ok(tauri::http::Response::builder()
            .status(400)
            .body(Vec::new())
            .unwrap());
    }

    let server_id = percent_decode(segs[0]);
    let plugin_id = percent_decode(segs[1]);
    let version = percent_decode(segs[2]);
    let rel_path = segs[3..]
        .iter()
        .map(|s| percent_decode(s))
        .collect::<Vec<String>>()
        .join("/");

    let file_path = plugin_store::resolve_app_plugins_path(&server_id, &plugin_id, &version, &rel_path)?;
    let bytes = std::fs::read(&file_path)
        .with_context(|| format!("Failed to read plugin file: {}", file_path.display()))?;

    Ok(tauri::http::Response::builder()
        .status(200)
        .header("Content-Type", mime_by_path(&rel_path))
        .body(bytes)
        .unwrap())
}
