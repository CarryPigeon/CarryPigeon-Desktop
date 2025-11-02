/*
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
 */
pub mod config;
pub mod error;
pub mod service;
pub mod windows;

use config::get_config;
use service::tcp::{add_tcp_service, listen_tcp_service, send_tcp_service};
use windows::to_chat_window_size;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            to_chat_window_size,
            get_config,
            send_tcp_service,
            listen_tcp_service,
            add_tcp_service
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}
