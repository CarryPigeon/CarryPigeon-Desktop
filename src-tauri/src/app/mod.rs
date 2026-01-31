use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use crate::features::network::init_tcp_service;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    tauri::Builder::default()
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}
