/*
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
 */
pub mod config;
pub mod dao;
pub mod error;
pub mod log;
pub mod service;
pub mod windows;

use config::{
    get_config_bool, get_config_string, get_config_u32, get_config_u64, get_server_config_bool,
    get_server_config_string, get_server_config_u32, get_server_config_u64, update_config_bool,
    update_config_string, update_config_u32, update_config_u64, get_config,
};
use dao::{channel::*, message::*};
use log::{log_error, log_info, log_warning};
use service::tcp::{add_tcp_service, listen_tcp_service, send_tcp_service};
use windows::to_chat_window_size;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // window commands
            to_chat_window_size,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}
