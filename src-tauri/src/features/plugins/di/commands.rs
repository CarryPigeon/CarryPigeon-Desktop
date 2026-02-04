use crate::features::plugins::data::plugin_manager::PluginLoadResult;
use crate::features::plugins::data::plugin_manifest::PluginManifest;
use crate::features::plugins::data::plugin_store::{InstalledPluginState, PluginRuntimeEntry};
use crate::features::plugins::data::plugin_store;
use crate::features::plugins::usecases::plugin_usecases;
use std::collections::HashMap;

#[tauri::command]
pub async fn load_plugin(manifest: PluginManifest) -> Result<PluginLoadResult, String> {
    plugin_usecases::load_plugin(manifest).await
}

#[tauri::command]
pub async fn list_plugins() -> Result<Vec<PluginManifest>, String> {
    plugin_usecases::list_plugins().await
}

#[tauri::command]
pub async fn plugins_list_installed(
    server_socket: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<Vec<InstalledPluginState>, String> {
    plugin_store::list_installed(
        &server_socket,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_get_installed_state(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<Option<InstalledPluginState>, String> {
    plugin_store::get_installed(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_get_runtime_entry(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<PluginRuntimeEntry, String> {
    plugin_store::get_runtime_entry(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_get_runtime_entry_for_version(
    server_socket: String,
    plugin_id: String,
    version: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<PluginRuntimeEntry, String> {
    plugin_store::get_runtime_entry_for_version(
        &server_socket,
        &plugin_id,
        &version,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_install_from_server_catalog(
    server_socket: String,
    plugin_id: String,
    version: Option<String>,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<InstalledPluginState, String> {
    plugin_store::install_from_server_catalog(
        &server_socket,
        &plugin_id,
        version.as_deref(),
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_install_from_url(
    server_socket: String,
    plugin_id: String,
    version: String,
    url: String,
    sha256: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<InstalledPluginState, String> {
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
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_enable(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<InstalledPluginState, String> {
    plugin_store::enable(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_disable(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<InstalledPluginState, String> {
    plugin_store::disable(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_switch_version(
    server_socket: String,
    plugin_id: String,
    version: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<InstalledPluginState, String> {
    plugin_store::switch_version(
        &server_socket,
        &plugin_id,
        &version,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_uninstall(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<(), String> {
    plugin_store::uninstall(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_set_failed(
    server_socket: String,
    plugin_id: String,
    message: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<InstalledPluginState, String> {
    plugin_store::set_failed(
        &server_socket,
        &plugin_id,
        &message,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_clear_error(
    server_socket: String,
    plugin_id: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<InstalledPluginState, String> {
    plugin_store::clear_error(
        &server_socket,
        &plugin_id,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_storage_get(
    server_socket: String,
    plugin_id: String,
    key: String,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<Option<serde_json::Value>, String> {
    plugin_store::storage_get(
        &server_socket,
        &plugin_id,
        &key,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_storage_set(
    server_socket: String,
    plugin_id: String,
    key: String,
    value: serde_json::Value,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<(), String> {
    plugin_store::storage_set(
        &server_socket,
        &plugin_id,
        &key,
        value,
        tls_policy.as_deref(),
        tls_fingerprint.as_deref(),
    )
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn plugins_network_fetch(
    server_socket: String,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    tls_policy: Option<String>,
    tls_fingerprint: Option<String>,
) -> Result<plugin_store::PluginFetchResponse, String> {
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
        .map_err(|e| e.to_string())
}
