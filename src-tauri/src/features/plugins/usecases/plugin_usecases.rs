//! plugins｜用例层：plugin_usecases。
//!
//! 约定：注释中文，日志英文（tracing）。
use std::collections::HashMap;

use crate::features::plugins::domain::ports::plugin_install_store_port::PluginInstallStorePort;
use crate::features::plugins::domain::ports::plugin_loader_port::PluginLoaderPort;
use crate::features::plugins::domain::types::{
    InstalledPluginState, PluginFetchResponse, PluginLoadResult, PluginManifest, PluginRuntimeEntry,
};

/// 加载并返回插件前端运行所需资源（wasm/js/html）。
///
/// # 参数
/// - `manifest`：插件清单。
///
/// # 返回值
/// - `Ok(PluginLoadResult)`：加载成功。
/// - `Err(anyhow::Error)`：加载失败原因。
pub async fn load_plugin(
    manifest: PluginManifest,
    plugin_loader_port: &dyn PluginLoaderPort,
) -> anyhow::Result<PluginLoadResult> {
    plugin_loader_port.load_plugin(manifest).await
}

/// 列出本地已保存的插件清单列表。
///
/// # 返回值
/// - `Ok(Vec<PluginManifest>)`：清单列表。
/// - `Err(anyhow::Error)`：读取失败原因。
pub async fn list_plugins(
    plugin_loader_port: &dyn PluginLoaderPort,
) -> anyhow::Result<Vec<PluginManifest>> {
    plugin_loader_port.list_plugins().await
}

/// 查询服务端已安装插件列表（含当前版本/启用态/错误等状态）。
pub async fn plugins_list_installed(
    server_socket: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<Vec<InstalledPluginState>> {
    plugin_store_port
        .list_installed(server_socket, tls_policy, tls_fingerprint)
        .await
}

/// 查询某个插件在服务端的安装状态。
pub async fn plugins_get_installed_state(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<Option<InstalledPluginState>> {
    plugin_store_port
        .get_installed_state(server_socket, plugin_id, tls_policy, tls_fingerprint)
        .await
}

/// 获取插件“当前版本”的运行时入口信息。
pub async fn plugins_get_runtime_entry(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<PluginRuntimeEntry> {
    plugin_store_port
        .get_runtime_entry(server_socket, plugin_id, tls_policy, tls_fingerprint)
        .await
}

/// 获取插件“指定版本”的运行时入口信息。
pub async fn plugins_get_runtime_entry_for_version(
    server_socket: &str,
    plugin_id: &str,
    version: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<PluginRuntimeEntry> {
    plugin_store_port
        .get_runtime_entry_for_version(
            server_socket,
            plugin_id,
            version,
            tls_policy,
            tls_fingerprint,
        )
        .await
}

/// 从服务端目录安装插件。
pub async fn plugins_install_from_server_catalog(
    server_socket: &str,
    plugin_id: &str,
    version: Option<&str>,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<InstalledPluginState> {
    plugin_store_port
        .install_from_server_catalog(
            server_socket,
            plugin_id,
            version,
            tls_policy,
            tls_fingerprint,
        )
        .await
}

/// 从指定 URL 安装插件。
pub async fn plugins_install_from_url(
    server_socket: &str,
    plugin_id: &str,
    version: &str,
    url: &str,
    sha256: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<InstalledPluginState> {
    plugin_store_port
        .install_from_url(
            server_socket,
            plugin_id,
            version,
            url,
            sha256,
            tls_policy,
            tls_fingerprint,
        )
        .await
}

/// 启用插件。
pub async fn plugins_enable(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<InstalledPluginState> {
    plugin_store_port
        .enable(server_socket, plugin_id, tls_policy, tls_fingerprint)
        .await
}

/// 禁用插件。
pub async fn plugins_disable(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<InstalledPluginState> {
    plugin_store_port
        .disable(server_socket, plugin_id, tls_policy, tls_fingerprint)
        .await
}

/// 切换插件版本。
pub async fn plugins_switch_version(
    server_socket: &str,
    plugin_id: &str,
    version: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<InstalledPluginState> {
    plugin_store_port
        .switch_version(
            server_socket,
            plugin_id,
            version,
            tls_policy,
            tls_fingerprint,
        )
        .await
}

/// 卸载插件。
pub async fn plugins_uninstall(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<()> {
    plugin_store_port
        .uninstall(server_socket, plugin_id, tls_policy, tls_fingerprint)
        .await
}

/// 将插件标记为失败态。
pub async fn plugins_set_failed(
    server_socket: &str,
    plugin_id: &str,
    message: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<InstalledPluginState> {
    plugin_store_port
        .set_failed(
            server_socket,
            plugin_id,
            message,
            tls_policy,
            tls_fingerprint,
        )
        .await
}

/// 清除插件失败态。
pub async fn plugins_clear_error(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<InstalledPluginState> {
    plugin_store_port
        .clear_error(server_socket, plugin_id, tls_policy, tls_fingerprint)
        .await
}

/// 读取插件 KV 存储。
pub async fn plugins_storage_get(
    server_socket: &str,
    plugin_id: &str,
    key: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<Option<serde_json::Value>> {
    plugin_store_port
        .storage_get(server_socket, plugin_id, key, tls_policy, tls_fingerprint)
        .await
}

/// 写入插件 KV 存储。
pub async fn plugins_storage_set(
    server_socket: &str,
    plugin_id: &str,
    key: &str,
    value: serde_json::Value,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<()> {
    plugin_store_port
        .storage_set(
            server_socket,
            plugin_id,
            key,
            value,
            tls_policy,
            tls_fingerprint,
        )
        .await
}

/// 以插件权限边界发起网络请求。
pub async fn plugins_network_fetch(
    server_socket: &str,
    url: &str,
    method: &str,
    headers: HashMap<String, String>,
    body: Option<String>,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
    plugin_store_port: &dyn PluginInstallStorePort,
) -> anyhow::Result<PluginFetchResponse> {
    plugin_store_port
        .network_fetch(
            server_socket,
            url,
            method,
            headers,
            body,
            tls_policy,
            tls_fingerprint,
        )
        .await
}
