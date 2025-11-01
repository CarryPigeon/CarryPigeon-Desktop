/*
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
 */
pub mod config;
pub mod error;
pub mod service;
pub mod windows;

use windows::to_chat_window_size;
use config::get_config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![to_chat_window_size, get_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}

