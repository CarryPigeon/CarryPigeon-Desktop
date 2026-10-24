//! plugins｜领域端口：plugin_install_store_port。

use std::future::Future;
use std::pin::Pin;

use crate::features::plugins::domain::types::{
    InstalledPluginState, PluginFetchResponse, PluginInstallFromUrlRequest,
    PluginNetworkFetchRequest, PluginRuntimeEntry, PluginSecretStatus,
};

pub type PluginInstallStoreFuture<'a, T> =
    Pin<Box<dyn Future<Output = anyhow::Result<T>> + Send + 'a>>;

pub trait PluginInstallStorePort: Send + Sync {
    fn list_installed<'a>(
        &'a self,
        server_socket: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, Vec<InstalledPluginState>>;

    fn get_installed_state<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, Option<InstalledPluginState>>;

    fn get_runtime_entry<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, PluginRuntimeEntry>;

    fn get_runtime_entry_for_version<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        version: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, PluginRuntimeEntry>;

    fn install_from_server_catalog<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        version: Option<&'a str>,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState>;

    fn install_from_url<'a>(
        &'a self,
        request: PluginInstallFromUrlRequest<'a>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState>;

    fn enable<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState>;

    fn disable<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState>;

    fn switch_version<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        version: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState>;

    fn uninstall<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, ()>;

    fn set_failed<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        message: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState>;

    fn clear_error<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState>;

    fn storage_get<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        key: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, Option<serde_json::Value>>;

    fn storage_set<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        key: &'a str,
        value: serde_json::Value,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, ()>;

    fn network_fetch<'a>(
        &'a self,
        request: PluginNetworkFetchRequest<'a>,
    ) -> PluginInstallStoreFuture<'a, PluginFetchResponse>;

    /// 写入（覆盖）插件密钥（系统 keyring，按 server + plugin 隔离）。
    fn secret_set<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        name: &'a str,
        value: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, ()>;

    /// 查询插件密钥状态（不返回密钥内容）。
    fn secret_status<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        name: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, PluginSecretStatus>;

    /// 清除插件密钥（幂等）。
    fn secret_clear<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        name: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, ()>;
}
