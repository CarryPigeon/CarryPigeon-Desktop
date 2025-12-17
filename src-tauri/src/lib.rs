/*
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
 */
pub mod config;
pub mod dao;
pub mod error;
pub mod filemanager;
pub mod log;
pub mod plugin;
pub mod service;
pub mod windows;

use config::{
    get_config, get_config_bool, get_config_string, get_config_u32, get_config_u64,
    get_server_config_bool, get_server_config_string, get_server_config_u32, get_server_config_u64,
    update_config_bool, update_config_string, update_config_u32, update_config_u64,
};
use dao::{channel::*, message::*};
use log::{log_error, log_info, log_warning};
use plugin::plugin_manager::{list_plugins, load_plugin};
use service::tcp::{add_tcp_service, listen_tcp_service, send_tcp_service};
use tauri::{
    Manager,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use windows::{open_user_popover_window, to_chat_window_size};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    tauri::Builder::default()
        .setup(|app| {
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
            if window.label() == "user-popover" {
                if let tauri::WindowEvent::Focused(false) = event {
                    let _ = window.close();
                }
            }
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // window commands
            to_chat_window_size,
            open_user_popover_window,
            //tcp service commands
            send_tcp_service,
            listen_tcp_service,
            add_tcp_service,
            get_all_channels,
            get_all_channels_by_server_socket,
            get_channel_by_id,
            get_channel_by_name,
            get_channel_by_owner_id,
            get_channel_by_admin_ids,
            create_message,
            update_message,
            delete_message,
            get_message_by_message_id,
            get_messages_by_channel_id,
            get_messages_by_keyword,
            get_messages_by_user_id,
            get_messages_by_time_range,
            get_latest_local_message_date,
            //log commands
            log_info,
            log_error,
            log_warning,
            //config commands
            get_config,
            get_config_bool,
            get_config_u32,
            get_config_u64,
            get_config_string,
            get_server_config_string,
            get_server_config_u32,
            get_server_config_u64,
            get_server_config_bool,
            update_config_bool,
            update_config_u32,
            update_config_u64,
            update_config_string,
            //plugin commands
            load_plugin,
            list_plugins,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}
