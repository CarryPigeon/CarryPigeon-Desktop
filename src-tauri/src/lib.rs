/*
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
 */
pub mod config;
pub mod dao;
pub mod error;
pub mod service;
pub mod windows;
pub mod log;

use config::get_config;
use service::tcp::{add_tcp_service, listen_tcp_service, send_tcp_service};
use windows::to_chat_window_size;
use dao::{channel::*,message::*};
use log::{log_info, log_error, log_warning};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            to_chat_window_size,
            get_config,
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
            log_info,
            log_error,
            log_warning,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}
