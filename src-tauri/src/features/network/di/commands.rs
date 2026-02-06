//! network｜DI/命令入口：commands。
//!
//! 约定：注释中文，日志英文（tracing）。

use tauri::AppHandle;

use crate::features::network::usecases::api_usecases;
use crate::features::network::usecases::tcp_usecases;

/// 初始化全局 TCP service（best-effort）。
pub fn init_tcp_service() {
    tcp_usecases::init_tcp_service();
}

#[tauri::command]
/// 注册并启动一个 TCP service（real 或 mock）。
///
/// # 参数
/// - `app`：Tauri 应用句柄（用于 emit 收包事件）。
/// - `server_socket`：逻辑 server_socket（作为 registry key）。
/// - `socket`：实际连接地址（可能为 `mock://...`、`tcp://...` 等）。
///
/// # 返回值
/// - `Ok(())`：创建成功。
/// - `Err(String)`：创建失败原因。
pub async fn add_tcp_service(
    app: AppHandle,
    server_socket: String,
    socket: String,
) -> Result<(), String> {
    tcp_usecases::add_tcp_service(app, server_socket, socket).await
}

#[tauri::command]
/// 向指定 server_socket 的 TCP service 发送 bytes。
///
/// # 参数
/// - `server_socket`：逻辑 server_socket。
/// - `data`：要发送的 bytes。
///
/// # 返回值
/// - `Ok(())`：发送成功。
/// - `Err(String)`：发送失败原因。
pub async fn send_tcp_service(server_socket: String, data: Vec<u8>) -> Result<(), String> {
    tcp_usecases::send_tcp_service(server_socket, data).await
}

#[tauri::command]
/// 启动（或重启）指定 server_socket 的 TCP service 监听（best-effort）。
///
/// # 参数
/// - `server_socket`：逻辑 server_socket。
/// - `app`：Tauri 应用句柄。
///
/// # 返回值
/// 无返回值。
///
/// # 说明
/// 该命令会忽略内部错误（保持前端调用方简单），详细错误会由下层日志输出。
pub async fn listen_tcp_service(server_socket: String, app: AppHandle) {
    let _ = tcp_usecases::listen_tcp_service(server_socket, app).await;
}

/// `/api/*` JSON 请求参数（前端 -> Rust）。
///
/// # 说明
/// - 该结构用于承载前端传入的请求信息；
/// - 仅允许请求 `/api/*` 路径（由上层路由拼接/校验）。
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequestJsonArgs {
    /// 服务器 socket 地址（用于 TLS 策略与网络命名空间）。
    pub server_socket: String,
    /// HTTP method（例如 `GET` / `POST`）。
    pub method: String,
    /// API 路径（必须以 `/api/` 开头）。
    pub path: String,
    /// 请求头（可选）。
    pub headers: Option<std::collections::BTreeMap<String, String>>,
    /// JSON 请求体（可选）。
    pub body: Option<serde_json::Value>,
    /// TLS 策略（可选）。
    pub tls_policy: Option<String>,
    /// TLS 指纹（可选，SHA-256 hex）。
    pub tls_fingerprint: Option<String>,
}

/// `/api/*` JSON 请求结果（Rust -> 前端）。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequestJsonResult {
    /// 是否为 2xx 成功响应。
    pub ok: bool,
    /// HTTP 状态码。
    pub status: u16,
    /// 成功响应体（JSON）。
    pub body: Option<serde_json::Value>,
    /// 错误响应体（JSON）。
    pub error: Option<serde_json::Value>,
}

/// 使用 Rust `reqwest` 执行 `/api/*` JSON 请求（支持 TLS 策略）。
///
/// # 说明
/// - WebView 的 `fetch/WebSocket` 无法绕过自签证书校验；
/// - 桌面端可通过 Rust sidecar 按 TLS 策略（insecure/指纹）完成请求。
#[tauri::command]
pub async fn api_request_json(args: ApiRequestJsonArgs) -> Result<ApiRequestJsonResult, String> {
    api_usecases::api_request_json(args)
        .await
        .map_err(|e| e.to_string())
}
