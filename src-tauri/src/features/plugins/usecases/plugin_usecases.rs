//! plugins｜用例层：plugin_usecases。
//!
//! 约定：注释中文，日志英文（tracing）。
use crate::features::plugins::data::plugin_manager::{
    PluginLoadResult, list_installed_manifests, plugin_manager,
};
use crate::features::plugins::data::plugin_manifest::PluginManifest;

/// 加载并返回插件前端运行所需资源（wasm/js/html）。
///
/// # 参数
/// - `manifest`：插件清单。
///
/// # 返回值
/// - `Ok(PluginLoadResult)`：加载成功。
/// - `Err(String)`：加载失败原因（字符串化）。
pub async fn load_plugin(manifest: PluginManifest) -> Result<PluginLoadResult, String> {
    plugin_manager()
        .load_plugin(manifest)
        .await
        .map_err(|e| e.to_string())
}

/// 列出本地已保存的插件清单列表。
///
/// # 返回值
/// - `Ok(Vec<PluginManifest>)`：清单列表。
/// - `Err(String)`：读取失败原因（字符串化）。
pub async fn list_plugins() -> Result<Vec<PluginManifest>, String> {
    list_installed_manifests().await.map_err(|e| e.to_string())
}
