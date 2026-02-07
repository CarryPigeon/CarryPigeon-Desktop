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
/// - `Err(anyhow::Error)`：加载失败原因。
pub async fn load_plugin(manifest: PluginManifest) -> anyhow::Result<PluginLoadResult> {
    let manager = plugin_manager()?;
    manager.load_plugin(manifest).await
}

/// 列出本地已保存的插件清单列表。
///
/// # 返回值
/// - `Ok(Vec<PluginManifest>)`：清单列表。
/// - `Err(anyhow::Error)`：读取失败原因。
pub async fn list_plugins() -> anyhow::Result<Vec<PluginManifest>> {
    list_installed_manifests().await
}
