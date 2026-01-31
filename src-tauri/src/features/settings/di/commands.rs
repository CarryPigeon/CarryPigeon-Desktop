use crate::features::settings::usecases::config_usecases;

#[tauri::command]
pub async fn get_config() -> String {
    config_usecases::get_config().await
}

#[tauri::command]
pub async fn get_config_bool(key: String) -> bool {
    config_usecases::get_config_bool(key).await
}

#[tauri::command]
pub async fn get_config_u32(key: String) -> u32 {
    config_usecases::get_config_u32(key).await
}

#[tauri::command]
pub async fn get_config_u64(key: String) -> u64 {
    config_usecases::get_config_u64(key).await
}

#[tauri::command]
pub async fn get_config_string(key: String) -> String {
    config_usecases::get_config_string(key).await
}

#[tauri::command]
pub async fn get_server_config_string(server_socket: String) -> String {
    config_usecases::get_server_config_string(server_socket).await
}

#[tauri::command]
pub async fn get_server_config_u32(server_socket: String) -> u32 {
    config_usecases::get_server_config_u32(server_socket).await
}

#[tauri::command]
pub async fn get_server_config_u64(server_socket: String) -> u64 {
    config_usecases::get_server_config_u64(server_socket).await
}

#[tauri::command]
pub async fn get_server_config_bool(server_socket: String) -> bool {
    config_usecases::get_server_config_bool(server_socket).await
}

#[tauri::command]
pub async fn update_config_bool(key: String, value: bool) {
    config_usecases::update_config_bool(key, value).await;
}

#[tauri::command]
pub async fn update_config_u32(key: String, value: u32) {
    config_usecases::update_config_u32(key, value).await;
}

#[tauri::command]
pub async fn update_config_u64(key: String, value: u64) {
    config_usecases::update_config_u64(key, value).await;
}

#[tauri::command]
pub async fn update_config_string(key: String, value: String) {
    config_usecases::update_config_string(key, value).await;
}
