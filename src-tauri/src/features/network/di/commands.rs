//! network｜DI/命令入口：commands。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, State};

use crate::features::network::data::http_client::ReqwestApiRequestAdapter;
use crate::features::network::di::event_sink::TauriTcpEventSink;
use crate::features::network::di::models::{ApiRequestJsonArgs, ApiRequestJsonResult};
use crate::features::network::di::tcp_backend_factory::DefaultTcpBackendFactory;
use crate::features::network::usecases::api_usecases::{self, ApiJsonRequest};
use crate::features::network::usecases::tcp_usecases::TcpRegistryService;
use crate::shared::error::{CommandResult, to_command_error};
use crate::shared::temp_file::{DownloadResult, TempFileManager};
use tokio::io::AsyncWriteExt;

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
        .map_err(|e| to_command_error("NETWORK_TCP_ADD_FAILED", "error.network_tcp_add_failed", e))
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
        .map_err(|e| {
            to_command_error(
                "NETWORK_TCP_REMOVE_FAILED",
                "error.network_tcp_remove_failed",
                e,
            )
        })
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
        .map_err(|e| {
            to_command_error(
                "NETWORK_TCP_SEND_FAILED",
                "error.network_tcp_send_failed",
                e,
            )
        })
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
        .map_err(|e| {
            to_command_error(
                "NETWORK_API_REQUEST_FAILED",
                "error.network_api_request_failed",
                e,
            )
        })
}

/// 使用 Rust `reqwest` 下载文件，通过 Tauri event 推送下载进度。
///
/// Tauri 事件 `download:progress` 负载:
/// ```json
/// { "taskId": "...", "downloaded": 12345, "total": 99999 }
/// ```
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

#[tauri::command]
pub async fn download_file(
    app: AppHandle,
    temp_files: State<'_, TempFileManager>,
    url: String,
    token: String,
    task_id: String,
) -> CommandResult<DownloadResult> {
    use futures_util::StreamExt;

    let client = HTTP_CLIENT.get_or_init(reqwest::Client::new);
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| {
            to_command_error(
                "DOWNLOAD_REQUEST_FAILED",
                "error.download_request_failed",
                e,
            )
        })?
        .error_for_status()
        .map_err(|e| to_command_error("DOWNLOAD_HTTP_ERROR", "error.download_http_error", e))?;

    let total = response.content_length().unwrap_or(0);
    let mime_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let mut file = temp_files
        .create_download(&task_id, &url, mime_type.as_deref(), total)
        .await
        .map_err(|e| {
            to_command_error(
                "TEMP_FILE_CREATE_FAILED",
                "error.temp_file_create_failed",
                e,
            )
        })?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    let stream_result: Result<(), _> = async {
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| to_command_error("DOWNLOAD_STREAM_ERROR", "error.download_stream_error", e))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| to_command_error("TEMP_FILE_WRITE_FAILED", "error.temp_file_write_failed", e))?;
            downloaded += chunk.len() as u64;

            if let Err(e) = temp_files
                .update_progress(&task_id, downloaded)
                .await
            {
                tracing::warn!(action = "network_temp_file_update_progress_failed", task_id = %task_id, error = %e);
            }

            let _ = app.emit(
                "download:progress",
                serde_json::json!({
                    "taskId": task_id,
                    "downloaded": downloaded,
                    "total": total,
                }),
            );
        }
        Ok::<_, String>(())
    }
    .await;

    if let Err(e) = stream_result {
        let _ = temp_files.mark_failed(&task_id).await;
        return Err(e);
    }

    drop(file);

    let ext = mime_to_ext(mime_type.as_deref().unwrap_or("application/octet-stream"));
    let final_path = temp_files
        .mark_complete(&task_id, &ext)
        .await
        .map_err(|e| to_command_error("TEMP_FILE_MOVE_FAILED", "error.temp_file_move_failed", e))?;

    tracing::info!(
        action = "network_download_completed",
        url = %url,
        downloaded,
        total,
        path = %final_path,
    );

    Ok(DownloadResult {
        file_id: task_id,
        file_path: final_path,
        mime_type,
        total_size: total,
    })
}

/// 根据 MIME 类型推导文件扩展名。
fn mime_to_ext(mime: &str) -> &'static str {
    match mime {
        "application/zip" => "zip",
        "application/pdf" => "pdf",
        "image/png" => "png",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "text/plain" => "txt",
        "text/html" => "html",
        "application/json" => "json",
        _ => "bin",
    }
}
