//! plugins｜领域端口：plugin_loader_port。

use std::future::Future;
use std::pin::Pin;

use crate::features::plugins::domain::types::{PluginLoadResult, PluginManifest};

pub type PluginLoaderFuture<'a, T> =
    Pin<Box<dyn Future<Output = anyhow::Result<T>> + Send + 'a>>;

pub trait PluginLoaderPort: Send + Sync {
    fn load_plugin<'a>(&'a self, manifest: PluginManifest) -> PluginLoaderFuture<'a, PluginLoadResult>;
    fn list_plugins<'a>(&'a self) -> PluginLoaderFuture<'a, Vec<PluginManifest>>;
}
