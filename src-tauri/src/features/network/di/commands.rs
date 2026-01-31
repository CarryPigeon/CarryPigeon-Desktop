use tauri::AppHandle;

use crate::features::network::usecases::tcp_usecases;

pub fn init_tcp_service() {
    tcp_usecases::init_tcp_service();
}

#[tauri::command]
pub async fn add_tcp_service(
    app: AppHandle,
    server_socket: String,
    socket: String,
) -> Result<(), String> {
    tcp_usecases::add_tcp_service(app, server_socket, socket).await
}

#[tauri::command]
pub async fn send_tcp_service(server_socket: String, data: Vec<u8>) -> Result<(), String> {
    tcp_usecases::send_tcp_service(server_socket, data).await
}

#[tauri::command]
pub async fn listen_tcp_service(server_socket: String, app: AppHandle) {
    let _ = tcp_usecases::listen_tcp_service(server_socket, app).await;
}
