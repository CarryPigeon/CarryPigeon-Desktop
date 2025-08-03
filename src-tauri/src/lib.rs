pub mod config;
pub mod controller;
pub mod dao;
pub mod mapper;
pub mod model;
pub mod service;
pub mod windows;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use windows::to_chat_window_size;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> anyhow::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![to_chat_window_size])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    Ok(())
}
