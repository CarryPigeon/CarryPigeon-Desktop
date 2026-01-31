use crate::features::plugins::data::plugin_manager::PluginLoadResult;
use crate::features::plugins::data::plugin_manifest::PluginManifest;
use crate::features::plugins::usecases::plugin_usecases;

#[tauri::command]
pub async fn load_plugin(manifest: PluginManifest) -> Result<PluginLoadResult, String> {
    plugin_usecases::load_plugin(manifest).await
}

#[tauri::command]
pub async fn list_plugins() -> Result<Vec<PluginManifest>, String> {
    plugin_usecases::list_plugins().await
}
