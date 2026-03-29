//! network｜DI/命令入口：commands。
//!
//! 约定：注释中文，日志英文（tracing）。

use tauri::{AppHandle, State};

use crate::features::network::data::http_client::ReqwestApiRequestAdapter;
use crate::features::network::di::event_sink::TauriTcpEventSink;
use crate::features::network::di::models::{ApiRequestJsonArgs, ApiRequestJsonResult};
use crate::features::network::di::tcp_backend_factory::DefaultTcpBackendFactory;
use crate::features::network::usecases::api_usecases::{self, ApiJsonRequest};
use crate::features::network::usecases::tcp_usecases::TcpRegistryService;
use crate::shared::error::{CommandResult, to_command_error};

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
    tcp_registry: State<'_, TcpRegistryService>,
    app: AppHandle,
    server_socket: String,
    socket: String,
) -> CommandResult<()> {
    tcp_registry
        .add_tcp_service(
            DefaultTcpBackendFactory::shared(),
            TauriTcpEventSink::shared(app),
            server_socket,
            socket,
        )
        .await
        .map_err(|e| to_command_error("NETWORK_TCP_ADD_FAILED", e))
}

#[tauri::command]
/// 移除并关闭一个 TCP service（按 server_socket）。
///
/// # 参数
/// - `app`：Tauri 应用句柄（用于 emit 断连事件）。
/// - `server_socket`：逻辑 server_socket（registry key）。
///
/// # 返回值
/// - `Ok(())`：移除成功。
/// - `Err(String)`：移除失败原因。
pub async fn remove_tcp_service(
    tcp_registry: State<'_, TcpRegistryService>,
    app: AppHandle,
    server_socket: String,
) -> CommandResult<()> {
    tcp_registry
        .remove_tcp_service(server_socket, TauriTcpEventSink::shared(app))
        .await
        .map_err(|e| to_command_error("NETWORK_TCP_REMOVE_FAILED", e))
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
pub async fn send_tcp_service(
    tcp_registry: State<'_, TcpRegistryService>,
    server_socket: String,
    data: Vec<u8>,
) -> CommandResult<()> {
    tcp_registry
        .send_tcp_service(server_socket, data)
        .await
        .map_err(|e| to_command_error("NETWORK_TCP_SEND_FAILED", e))
}

/// 使用 Rust `reqwest` 执行 `/api/*` JSON 请求（支持 TLS 策略）。
///
/// # 说明
/// - WebView 的 `fetch/WebSocket` 无法绕过自签证书校验；
/// - 桌面端可通过 Rust sidecar 按 TLS 策略（insecure/指纹）完成请求。
#[tauri::command]
pub async fn api_request_json(args: ApiRequestJsonArgs) -> CommandResult<ApiRequestJsonResult> {
    let usecase_args = ApiJsonRequest {
        server_socket: args.server_socket,
        method: args.method,
        path: args.path,
        headers: args.headers,
        body: args.body,
        tls_policy: args.tls_policy,
        tls_fingerprint: args.tls_fingerprint,
    };
    let api_request_port = ReqwestApiRequestAdapter::shared();
    api_usecases::api_request_json(usecase_args, api_request_port.as_ref())
        .await
        .map(|result| ApiRequestJsonResult {
            ok: result.ok,
            status: result.status,
            body: result.body,
            error: result.error,
        })
        .map_err(|e| to_command_error("NETWORK_API_REQUEST_FAILED", e))
}
