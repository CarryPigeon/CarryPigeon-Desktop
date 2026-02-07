//! plugins｜数据层：plugin_manager。
//!
//! 约定：注释中文，日志英文（tracing）。
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, OnceLock},
};

use anyhow::Context;
use serde::Serialize;
use sha2::Digest;
use tokio::sync::Mutex;
use wasmtime::{
    Engine, Module, Store,
    component::{Component, Linker},
};

use crate::features::plugins::data::plugin_manifest::{PluginManifest, PluginManifestList};

/// 已安装并可被运行的插件对象（包含清单与缓存资源）。
///
/// # 说明
/// - 本结构是插件运行时的“内存态表示”，用于复用已加载的 bytes；
/// - 资源缓存目录默认位于 `./plugin_cache/{plugin_name}`（见 `PluginManager`）。
#[derive(Debug, Clone)]
pub struct Plugin {
    /// 插件清单（可变：允许在运行期更新字段）。
    pub manifest: Arc<Mutex<PluginManifest>>,
    /// 前端 wasm 字节（用于 WebView 侧能力）。
    pub frontend_wasm_bytes: Vec<u8>,
    /// 后端 wasm 字节（用于 wasmtime 组件启动）。
    pub backend_wasm_bytes: Vec<u8>,
    /// 前端 JS 字节（用于注入/加载）。
    pub frontend_js_bytes: Vec<u8>,
    /// 前端 HTML 字节（可选；缺失时可能为空）。
    pub frontend_html_bytes: Vec<u8>,
    /// 插件缓存目录路径。
    pub path: PathBuf,
}

/// 插件加载结果（返回给前端用于渲染/运行）。
///
/// # 说明
/// - 返回字段使用 `camelCase`，便于与前端 TS 类型直接对齐；
/// - 该结果不包含后端 wasm：后端由 Rust 侧直接运行。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLoadResult {
    /// 前端 wasm 字节。
    pub frontend_wasm: Vec<u8>,
    /// 前端 JS 字节。
    pub frontend_js: Vec<u8>,
    /// 前端 HTML 字节（可能为空）。
    pub frontend_html: Vec<u8>,
}

/// 插件管理器：负责插件缓存、加载与后端启动。
///
/// # 说明
/// - 以 `Engine` 为核心，按需加载/实例化插件后端 component；
/// - 维护已加载插件的内存缓存，避免重复 I/O 与重复下载。
pub struct PluginManager {
    engine: Engine,
    cache_path: PathBuf,
    loaded_plugins: Mutex<HashMap<String, Arc<Mutex<Plugin>>>>,
}

impl PluginManager {
    /// 创建插件管理器。
    ///
    /// # 参数
    /// - `engine`：Wasmtime 引擎（需启用 component model）。
    /// - `cache_path`：插件缓存根目录。
    ///
    /// # 返回值
    /// - `Ok(Self)`：创建成功。
    /// - `Err(anyhow::Error)`：创建失败原因（当前实现几乎不会失败，保留接口形态）。
    pub fn new(engine: Engine, cache_path: PathBuf) -> anyhow::Result<Self> {
        Ok(Self {
            engine,
            cache_path,
            loaded_plugins: Mutex::new(HashMap::new()),
        })
    }

    fn plugin_path(&self, plugin_name: &str) -> PathBuf {
        self.cache_path.join(plugin_name)
    }

    async fn run_backend_start(
        &self,
        plugin_name: &str,
        backend_wasm: &[u8],
    ) -> anyhow::Result<()> {
        let component_backend = Component::from_binary(&self.engine, backend_wasm)
            .context("Failed to create backend module from wasm bytes")?;

        let mut store: Store<String> = Store::new(&self.engine, plugin_name.to_string());
        let linker = Linker::new(&self.engine);

        let backend_instance = linker
            .instantiate_async(&mut store, &component_backend)
            .await
            .context("Failed to instantiate backend module")?;

        let backend_start = backend_instance
            .get_typed_func::<(), ()>(&mut store, "start")
            .context("Failed to get 'start' function from backend module")?;

        backend_start.call_async(&mut store, ()).await?;
        Ok(())
    }

    /// 按 manifest 下载并安装插件资源到本地缓存目录。
    ///
    /// # 参数
    /// - `manifest`：插件清单（包含 url 与 sha256 等校验信息）。
    ///
    /// # 返回值
    /// - `Ok(())`：安装成功。
    /// - `Err(anyhow::Error)`：下载/校验/写入失败原因。
    ///
    /// # 说明
    /// - 当前实现会下载 `frontend.wasm/backend.wasm/frontend.js/frontend.html`；
    /// - 若清单提供 sha256，会进行完整性校验；
    /// - 安装成功后会写入 `plugins.json`（通过 `PluginManifestList`）。
    pub async fn install_from_manifest(&self, manifest: PluginManifest) -> anyhow::Result<()> {
        tokio::fs::create_dir_all(&self.cache_path).await?;

        let client = reqwest::Client::new();

        let frontend_wasm_bytes = client
            .get(format!("{}/frontend.wasm", manifest.url))
            .send()
            .await
            .context("Failed to send request to download plugin frontend.wasm")?
            .error_for_status()
            .context("Plugin download returned an error status")?
            .bytes()
            .await
            .context("Failed to read plugin frontend.wasm bytes")?
            .to_vec();

        let backend_wasm_bytes = client
            .get(format!("{}/backend.wasm", manifest.url))
            .send()
            .await
            .context("Failed to send request to download plugin backend.wasm")?
            .error_for_status()
            .context("Plugin download returned an error status")?
            .bytes()
            .await
            .context("Failed to read plugin backend.wasm bytes")?
            .to_vec();

        let frontend_js_bytes = client
            .get(format!("{}/frontend.js", manifest.url))
            .send()
            .await
            .context("Failed to send request to download plugin frontend.js")?
            .error_for_status()
            .context("Plugin download returned an error status")?
            .bytes()
            .await
            .context("Failed to read plugin frontend.js bytes")?
            .to_vec();

        let frontend_html_bytes = client
            .get(format!("{}/frontend.html", manifest.url))
            .send()
            .await
            .context("Failed to send request to download plugin frontend.html")?
            .error_for_status()
            .context("Plugin download returned an error status")?
            .bytes()
            .await
            .context("Failed to read plugin frontend.html bytes")?
            .to_vec();

        if !manifest.frontend_sha256.trim().is_empty() {
            let mut hasher = sha2::Sha256::new();
            hasher.update(&frontend_wasm_bytes);
            let got_frontend_sha256 = hex::encode(hasher.finalize());
            if !eq_hash_hex(&got_frontend_sha256, &manifest.frontend_sha256) {
                return Err(anyhow::anyhow!(
                    "SHA256 mismatch for plugin {}: expected {}, got {}",
                    manifest.name,
                    manifest.frontend_sha256,
                    got_frontend_sha256
                ));
            }
        }

        if !manifest.backend_sha256.trim().is_empty() {
            let mut hasher = sha2::Sha256::new();
            hasher.update(&backend_wasm_bytes);
            let got_backend_sha256 = hex::encode(hasher.finalize());
            if !eq_hash_hex(&got_backend_sha256, &manifest.backend_sha256) {
                return Err(anyhow::anyhow!(
                    "SHA256 mismatch for plugin {}: expected {}, got {}",
                    manifest.name,
                    manifest.backend_sha256,
                    got_backend_sha256
                ));
            }
        }

        let plugin_path = self.plugin_path(&manifest.name);
        tokio::fs::create_dir_all(&plugin_path).await?;
        tokio::fs::write(plugin_path.join("frontend.wasm"), &frontend_wasm_bytes).await?;
        tokio::fs::write(plugin_path.join("backend.wasm"), &backend_wasm_bytes).await?;
        tokio::fs::write(plugin_path.join("frontend.js"), &frontend_js_bytes).await?;
        tokio::fs::write(plugin_path.join("frontend.html"), &frontend_html_bytes).await?;

        let mut plugin_manifest_list = PluginManifestList::new().await?;
        plugin_manifest_list.add_plugin(manifest.clone()).await?;

        self.loaded_plugins.lock().await.insert(
            manifest.name.clone(),
            Arc::new(Mutex::new(Plugin {
                manifest: Arc::new(Mutex::new(manifest)),
                path: plugin_path,
                frontend_wasm_bytes,
                backend_wasm_bytes,
                frontend_js_bytes,
                frontend_html_bytes,
            })),
        );

        Ok(())
    }

    /// 加载插件：优先从内存缓存读取，否则从本地缓存目录读取（必要时按 manifest.url 下载安装）。
    ///
    /// # 参数
    /// - `manifest`：插件清单。
    ///
    /// # 返回值
    /// - `Ok(PluginLoadResult)`：返回给前端的加载结果。
    /// - `Err(anyhow::Error)`：加载失败原因。
    ///
    /// # 说明
    /// - 若本地缺少必须文件且 `manifest.url` 为空，会直接返回错误；
    /// - 加载成功后会尝试启动插件后端 `start` 函数（best-effort，但失败会返回错误）。
    pub async fn load_plugin(&self, manifest: PluginManifest) -> anyhow::Result<PluginLoadResult> {
        if let Some(plugin) = self
            .loaded_plugins
            .lock()
            .await
            .get(&manifest.name)
            .cloned()
        {
            let plugin = plugin.lock().await;
            let frontend_wasm = plugin.frontend_wasm_bytes.clone();
            let backend_wasm = plugin.backend_wasm_bytes.clone();
            let frontend_js = plugin.frontend_js_bytes.clone();
            let frontend_html = plugin.frontend_html_bytes.clone();
            drop(plugin);

            self.run_backend_start(&manifest.name, &backend_wasm)
                .await?;

            return Ok(PluginLoadResult {
                frontend_wasm,
                frontend_js,
                frontend_html,
            });
        }

        let path = self.plugin_path(&manifest.name);
        let frontend_wasm_res = tokio::fs::read(path.join("frontend.wasm")).await;
        let backend_wasm_res = tokio::fs::read(path.join("backend.wasm")).await;
        let frontend_js_res = tokio::fs::read(path.join("frontend.js")).await;
        let frontend_html_res = tokio::fs::read(path.join("frontend.html")).await;

        let missing_required = frontend_wasm_res
            .as_ref()
            .err()
            .is_some_and(|e| e.kind() == std::io::ErrorKind::NotFound)
            || backend_wasm_res
                .as_ref()
                .err()
                .is_some_and(|e| e.kind() == std::io::ErrorKind::NotFound)
            || frontend_js_res
                .as_ref()
                .err()
                .is_some_and(|e| e.kind() == std::io::ErrorKind::NotFound);

        if missing_required {
            if manifest.url.trim().is_empty() {
                return Err(anyhow::anyhow!(
                    "Plugin '{}' is not installed (missing cache files) and no manifest.url provided",
                    manifest.name
                ));
            }
            self.install_from_manifest(manifest.clone()).await?;
            return Box::pin(self.load_plugin(manifest)).await;
        }

        let frontend_wasm = frontend_wasm_res.context("Failed to read frontend wasm")?;
        let backend_wasm = backend_wasm_res.context("Failed to read backend wasm")?;
        let frontend_js = frontend_js_res.context("Failed to read frontend js")?;
        let frontend_html = match frontend_html_res {
            Ok(bytes) => bytes,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => vec![],
            Err(err) => return Err(err.into()),
        };

        let _component_frontend = Module::from_binary(&self.engine, &frontend_wasm)
            .context("Failed to create frontend module from wasm bytes")?;
        self.run_backend_start(&manifest.name, &backend_wasm)
            .await?;

        self.loaded_plugins.lock().await.insert(
            manifest.clone().name,
            Arc::new(Mutex::new(Plugin {
                manifest: Arc::new(Mutex::new(manifest.clone())),
                path,
                frontend_wasm_bytes: frontend_wasm.clone(),
                backend_wasm_bytes: backend_wasm,
                frontend_js_bytes: frontend_js.clone(),
                frontend_html_bytes: frontend_html.clone(),
            })),
        );

        Ok(PluginLoadResult {
            frontend_wasm,
            frontend_js,
            frontend_html,
        })
    }
}

fn eq_hash_hex(a: &str, b: &str) -> bool {
    a.trim().eq_ignore_ascii_case(b.trim())
}

pub static PLUGINMANAGER: OnceLock<PluginManager> = OnceLock::new();

fn create_plugin_manager() -> anyhow::Result<PluginManager> {
    let mut config = wasmtime::Config::new();
    config.wasm_component_model(true);
    let engine = Engine::new(&config).context("Failed to create Wasmtime engine")?;
    PluginManager::new(engine, PathBuf::from("./plugin_cache"))
        .context("Failed to init PluginManager")
}

/// 获取全局插件管理器单例（可失败版本）。
///
/// # 返回值
/// - `Ok(&'static PluginManager)`：获取成功。
/// - `Err(anyhow::Error)`：初始化失败原因。
pub fn plugin_manager() -> anyhow::Result<&'static PluginManager> {
    if let Some(manager) = PLUGINMANAGER.get() {
        return Ok(manager);
    }

    let manager = create_plugin_manager()?;
    match PLUGINMANAGER.set(manager) {
        Ok(()) => PLUGINMANAGER
            .get()
            .context("PluginManager initialized but missing from OnceLock"),
        Err(_) => PLUGINMANAGER
            .get()
            .context("PluginManager set raced and final value is missing"),
    }
}

/// 列出本地已保存的插件清单列表。
///
/// # 返回值
/// - `Ok(Vec<PluginManifest>)`：清单列表。
/// - `Err(anyhow::Error)`：读取失败原因。
pub async fn list_installed_manifests() -> anyhow::Result<Vec<PluginManifest>> {
    let manifests = PluginManifestList::new().await?.plugins;
    tracing::debug!(
        action = "plugins_runtime_list_installed",
        count = manifests.len()
    );
    Ok(manifests)
}
