//! plugins｜数据适配器：plugin_ports。

use std::collections::HashMap;

use crate::features::plugins::domain::ports::plugin_install_store_port::{
    PluginInstallStoreFuture, PluginInstallStorePort,
};
use crate::features::plugins::domain::ports::plugin_loader_port::{
    PluginLoaderFuture, PluginLoaderPort,
};
use crate::features::plugins::domain::types::{
    InstalledPluginState, PluginFetchResponse, PluginLoadResult, PluginManifest,
    PluginRuntimeEntry,
};

use super::plugin_manager::{list_installed_manifests, plugin_manager};
use super::plugin_store;

#[derive(Debug, Default, Clone, Copy)]
pub struct PluginLoaderPortAdapter;

impl PluginLoaderPortAdapter {
    pub fn shared() -> &'static Self {
        static ADAPTER: PluginLoaderPortAdapter = PluginLoaderPortAdapter;
        &ADAPTER
    }
}

impl PluginLoaderPort for PluginLoaderPortAdapter {
    fn load_plugin<'a>(
        &'a self,
        manifest: PluginManifest,
    ) -> PluginLoaderFuture<'a, PluginLoadResult> {
        Box::pin(async move {
            let manager = plugin_manager()?;
            manager.load_plugin(manifest).await
        })
    }

    fn list_plugins<'a>(&'a self) -> PluginLoaderFuture<'a, Vec<PluginManifest>> {
        Box::pin(async move { list_installed_manifests().await })
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PluginInstallStorePortAdapter;

impl PluginInstallStorePortAdapter {
    pub fn shared() -> &'static Self {
        static ADAPTER: PluginInstallStorePortAdapter = PluginInstallStorePortAdapter;
        &ADAPTER
    }
}

impl PluginInstallStorePort for PluginInstallStorePortAdapter {
    fn list_installed<'a>(
        &'a self,
        server_socket: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, Vec<InstalledPluginState>> {
        Box::pin(async move { plugin_store::list_installed(server_socket, tls_policy, tls_fingerprint).await })
    }

    fn get_installed_state<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, Option<InstalledPluginState>> {
        Box::pin(async move { plugin_store::get_installed(server_socket, plugin_id, tls_policy, tls_fingerprint).await })
    }

    fn get_runtime_entry<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, PluginRuntimeEntry> {
        Box::pin(async move { plugin_store::get_runtime_entry(server_socket, plugin_id, tls_policy, tls_fingerprint).await })
    }

    fn get_runtime_entry_for_version<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        version: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, PluginRuntimeEntry> {
        Box::pin(async move {
            plugin_store::get_runtime_entry_for_version(
                server_socket,
                plugin_id,
                version,
                tls_policy,
                tls_fingerprint,
            )
            .await
        })
    }

    fn install_from_server_catalog<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        version: Option<&'a str>,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState> {
        Box::pin(async move {
            plugin_store::install_from_server_catalog(
                server_socket,
                plugin_id,
                version,
                tls_policy,
                tls_fingerprint,
            )
            .await
        })
    }

    fn install_from_url<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        version: &'a str,
        url: &'a str,
        sha256: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState> {
        Box::pin(async move {
            plugin_store::install_from_url(
                server_socket,
                plugin_id,
                version,
                url,
                sha256,
                tls_policy,
                tls_fingerprint,
            )
            .await
        })
    }

    fn enable<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState> {
        Box::pin(async move { plugin_store::enable(server_socket, plugin_id, tls_policy, tls_fingerprint).await })
    }

    fn disable<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState> {
        Box::pin(async move { plugin_store::disable(server_socket, plugin_id, tls_policy, tls_fingerprint).await })
    }

    fn switch_version<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        version: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState> {
        Box::pin(async move {
            plugin_store::switch_version(
                server_socket,
                plugin_id,
                version,
                tls_policy,
                tls_fingerprint,
            )
            .await
        })
    }

    fn uninstall<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, ()> {
        Box::pin(async move { plugin_store::uninstall(server_socket, plugin_id, tls_policy, tls_fingerprint).await })
    }

    fn set_failed<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        message: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState> {
        Box::pin(async move {
            plugin_store::set_failed(
                server_socket,
                plugin_id,
                message,
                tls_policy,
                tls_fingerprint,
            )
            .await
        })
    }

    fn clear_error<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, InstalledPluginState> {
        Box::pin(async move { plugin_store::clear_error(server_socket, plugin_id, tls_policy, tls_fingerprint).await })
    }

    fn storage_get<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        key: &'a str,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, Option<serde_json::Value>> {
        Box::pin(async move {
            plugin_store::storage_get(server_socket, plugin_id, key, tls_policy, tls_fingerprint).await
        })
    }

    fn storage_set<'a>(
        &'a self,
        server_socket: &'a str,
        plugin_id: &'a str,
        key: &'a str,
        value: serde_json::Value,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, ()> {
        Box::pin(async move {
            plugin_store::storage_set(
                server_socket,
                plugin_id,
                key,
                value,
                tls_policy,
                tls_fingerprint,
            )
            .await
        })
    }

    fn network_fetch<'a>(
        &'a self,
        server_socket: &'a str,
        url: &'a str,
        method: &'a str,
        headers: HashMap<String, String>,
        body: Option<String>,
        tls_policy: Option<&'a str>,
        tls_fingerprint: Option<&'a str>,
    ) -> PluginInstallStoreFuture<'a, PluginFetchResponse> {
        Box::pin(async move {
            plugin_store::network_fetch(
                server_socket,
                url,
                method,
                headers,
                body,
                tls_policy,
                tls_fingerprint,
            )
            .await
        })
    }
}
