use tauri::AppHandle;

use crate::features::network::usecases::tcp_usecases;
use crate::features::network::usecases::api_usecases;

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

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequestJsonArgs {
    pub server_socket: String,
    pub method: String,
    /// Must start with `/api/`.
    pub path: String,
    pub headers: Option<std::collections::BTreeMap<String, String>>,
    pub body: Option<serde_json::Value>,
    pub tls_policy: Option<String>,
    pub tls_fingerprint: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequestJsonResult {
    pub ok: bool,
    pub status: u16,
    pub body: Option<serde_json::Value>,
    pub error: Option<serde_json::Value>,
}

/// Perform an `/api/*` JSON request using Rust reqwest (TLS policy aware).
///
/// This exists because WebView fetch/WebSocket cannot bypass certificate checks
/// for self-signed servers. The desktop host can.
#[tauri::command]
pub async fn api_request_json(args: ApiRequestJsonArgs) -> Result<ApiRequestJsonResult, String> {
    api_usecases::api_request_json(args)
        .await
        .map_err(|e| e.to_string())
}
