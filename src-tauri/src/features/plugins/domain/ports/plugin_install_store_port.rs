//! plugins｜领域端口：plugin_install_store_port。

use std::future::Future;
use std::pin::Pin;

use crate::features::plugins::domain::types::{
    InstalledPluginState, PluginFetchResponse, PluginInstallFromUrlRequest,
    PluginNetworkFetchRequest, PluginRuntimeEntry,
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
}
