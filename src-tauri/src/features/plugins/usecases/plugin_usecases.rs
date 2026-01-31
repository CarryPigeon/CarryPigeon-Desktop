use crate::features::plugins::data::plugin_manager::{
    PluginLoadResult, list_installed_manifests, plugin_manager,
};
use crate::features::plugins::data::plugin_manifest::PluginManifest;

pub async fn load_plugin(manifest: PluginManifest) -> Result<PluginLoadResult, String> {
    plugin_manager()
        .load_plugin(manifest)
        .await
        .map_err(|e| e.to_string())
}

pub async fn list_plugins() -> Result<Vec<PluginManifest>, String> {
    list_installed_manifests().await.map_err(|e| e.to_string())
}
