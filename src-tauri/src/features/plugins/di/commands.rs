//! plugins｜DI/命令入口：commands。
//!
//! 约定：注释中文，日志英文（tracing）。
use crate::features::plugins::data::plugin_manager::PluginLoadResult;
use crate::features::plugins::data::plugin_manifest::PluginManifest;
use crate::features::plugins::data::plugin_store;
use crate::features::plugins::data::plugin_store::{InstalledPluginState, PluginRuntimeEntry};
use crate::features::plugins::usecases::plugin_usecases;
use crate::shared::error::{CommandResult, to_command_error};
use std::collections::HashMap;

/// 加载并实例化一个插件（由 manifest 指定）。
///
/// # 参数
/// - `manifest`：插件清单（包含 id/version/url/sha256 等）。
///
/// # 返回值
/// - `Ok(PluginLoadResult)`：加载结果（包含运行时入口等信息）。
/// - `Err(String)`：加载失败原因。
///
/// # 说明
/// 该命令主要用于调试/开发态：前端传入 manifest 后触发本地插件加载流程。
#[tauri::command]
pub async fn load_plugin(manifest: PluginManifest) -> CommandResult<PluginLoadResult> {
    plugin_usecases::load_plugin(manifest)
        .await
        .map_err(|e| to_command_error("PLUGINS_LOAD_FAILED", e))
}

/// 列出本地已保存的插件清单列表。
///
/// # 返回值
/// - `Ok(Vec<PluginManifest>)`：清单列表。
/// - `Err(String)`：读取失败原因。
#[tauri::command]
pub async fn list_plugins() -> CommandResult<Vec<PluginManifest>> {
    plugin_usecases::list_plugins()
        .await
        .map_err(|e| to_command_error("PLUGINS_LIST_FAILED", e))
}

/// 查询服务端已安装插件列表（含当前版本/启用态/错误等状态）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `tls_policy`：TLS 策略（可选，传递给网络层）。
/// - `tls_fingerprint`：TLS 指纹（可选，传递给网络层）。
///
/// # 返回值
/// - `Ok(Vec<InstalledPluginState>)`：已安装插件状态列表。
/// - `Err(String)`：查询失败原因。
#[tauri::command]
pub async fn plugins_list_installed(
    server_socket: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<Vec<InstalledPluginState>> {
    plugin_store::list_installed(
        &server_socket,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_LIST_INSTALLED_FAILED", e))
}

/// 查询某个插件在服务端的安装状态。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(Some(InstalledPluginState))`：已安装则返回状态。
/// - `Ok(None)`：未安装。
/// - `Err(String)`：查询失败原因。
#[tauri::command]
pub async fn plugins_get_installed_state(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<Option<InstalledPluginState>> {
    plugin_store::get_installed(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_GET_INSTALLED_STATE_FAILED", e))
}

/// 获取插件运行时入口（用于前端动态 import 插件模块）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(PluginRuntimeEntry)`：运行时入口信息（URL/版本等）。
/// - `Err(String)`：获取失败原因。
#[tauri::command]
pub async fn plugins_get_runtime_entry(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<PluginRuntimeEntry> {
    plugin_store::get_runtime_entry(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_GET_RUNTIME_ENTRY_FAILED", e))
}

/// 获取指定版本的插件运行时入口。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `version`：目标版本。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(PluginRuntimeEntry)`：运行时入口信息。
/// - `Err(String)`：获取失败原因。
#[tauri::command]
pub async fn plugins_get_runtime_entry_for_version(
    server_socket: String,
    plugin_id: String,
    version: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<PluginRuntimeEntry> {
    plugin_store::get_runtime_entry_for_version(
        &server_socket,
        &plugin_id,
        &version,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_GET_RUNTIME_ENTRY_FOR_VERSION_FAILED", e))
}

/// 从服务端插件目录安装插件。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `version`：目标版本（可选；为空时由服务端/目录决定默认版本）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：安装后的状态。
/// - `Err(String)`：安装失败原因。
#[tauri::command]
pub async fn plugins_install_from_server_catalog(
    server_socket: String,
    plugin_id: String,
    version: Option<String>,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<InstalledPluginState> {
    plugin_store::install_from_server_catalog(
        &server_socket,
        &plugin_id,
        version.as_deref(),
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_INSTALL_FROM_SERVER_CATALOG_FAILED", e))
}

/// 从指定 URL 安装插件（自定义来源）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `version`：要安装的版本。
/// - `url`：插件包下载地址。
/// - `sha256`：插件包 sha256（用于完整性校验）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：安装后的状态。
/// - `Err(String)`：安装失败原因。
#[tauri::command]
pub async fn plugins_install_from_url(
    server_socket: String,
    plugin_id: String,
    version: String,
    url: String,
    sha256: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<InstalledPluginState> {
    plugin_store::install_from_url(
        &server_socket,
        &plugin_id,
        &version,
        &url,
        &sha256,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_INSTALL_FROM_URL_FAILED", e))
}

/// 启用已安装插件。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：更新后的插件状态。
/// - `Err(String)`：启用失败原因。
#[tauri::command]
pub async fn plugins_enable(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<InstalledPluginState> {
    plugin_store::enable(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_ENABLE_FAILED", e))
}

/// 禁用已安装插件。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：更新后的插件状态。
/// - `Err(String)`：禁用失败原因。
#[tauri::command]
pub async fn plugins_disable(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<InstalledPluginState> {
    plugin_store::disable(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_DISABLE_FAILED", e))
}

/// 切换已安装插件的当前版本。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `version`：目标版本。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：切换后的插件状态。
/// - `Err(String)`：切换失败原因。
#[tauri::command]
pub async fn plugins_switch_version(
    server_socket: String,
    plugin_id: String,
    version: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<InstalledPluginState> {
    plugin_store::switch_version(
        &server_socket,
        &plugin_id,
        &version,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_SWITCH_VERSION_FAILED", e))
}

/// 卸载插件（移除服务端安装记录与本地缓存）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(())`：卸载成功。
/// - `Err(String)`：卸载失败原因。
#[tauri::command]
pub async fn plugins_uninstall(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<()> {
    plugin_store::uninstall(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_UNINSTALL_FAILED", e))
}

/// 将插件状态标记为失败（写入 last_error 等字段）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `message`：错误消息（用于 UI 展示与诊断）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：更新后的插件状态。
/// - `Err(String)`：更新失败原因。
#[tauri::command]
pub async fn plugins_set_failed(
    server_socket: String,
    plugin_id: String,
    message: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<InstalledPluginState> {
    plugin_store::set_failed(
        &server_socket,
        &plugin_id,
        &message,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_SET_FAILED_STATE_FAILED", e))
}

/// 清除插件的错误信息（从 failed 恢复）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：更新后的插件状态。
/// - `Err(String)`：更新失败原因。
#[tauri::command]
pub async fn plugins_clear_error(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<InstalledPluginState> {
    plugin_store::clear_error(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_CLEAR_ERROR_FAILED", e))
}

/// 读取插件私有存储（KV）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `key`：存储 key。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(Some(Value))`：存在该 key，返回 JSON 值。
/// - `Ok(None)`：不存在该 key。
/// - `Err(String)`：读取失败原因。
#[tauri::command]
pub async fn plugins_storage_get(
    server_socket: String,
    plugin_id: String,
    key: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<Option<serde_json::Value>> {
    plugin_store::storage_get(
        &server_socket,
        &plugin_id,
        &key,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_STORAGE_GET_FAILED", e))
}

/// 写入插件私有存储（KV）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `plugin_id`：插件 id。
/// - `key`：存储 key。
/// - `value`：要写入的 JSON 值。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(())`：写入成功。
/// - `Err(String)`：写入失败原因。
#[tauri::command]
pub async fn plugins_storage_set(
    server_socket: String,
    plugin_id: String,
    key: String,
    value: serde_json::Value,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<()> {
    plugin_store::storage_set(
        &server_socket,
        &plugin_id,
        &key,
        value,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_STORAGE_SET_FAILED", e))
}

/// 以插件权限边界发起网络请求（供插件 runtime 调用）。
///
/// # 参数
/// - `server_socket`：目标服务端 socket。
/// - `url`：请求 URL。
/// - `method`：HTTP 方法（GET/POST/...）。
/// - `headers`：请求头。
/// - `body`：请求体（可选，通常为字符串/JSON）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(PluginFetchResponse)`：请求响应（status/headers/body）。
/// - `Err(String)`：请求失败原因。
#[tauri::command]
pub async fn plugins_network_fetch(
    server_socket: String,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> CommandResult<plugin_store::PluginFetchResponse> {
    plugin_store::network_fetch(
        &server_socket,
        &url,
        &method,
        headers,
        body,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
    .await
    .map_err(|e| to_command_error("PLUGINS_NETWORK_FETCH_FAILED", e))
}
