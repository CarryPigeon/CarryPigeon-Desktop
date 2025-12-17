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

use crate::plugin::plugin_manifest::{PluginManifest, PluginManifestList};

#[derive(Debug, Clone)]
pub struct Plugin {
    pub manifest: Arc<Mutex<PluginManifest>>,
    pub frontend_wasm_bytes: Vec<u8>,
    pub backend_wasm_bytes: Vec<u8>,
    pub frontend_js_bytes: Vec<u8>,
    pub frontend_html_bytes: Vec<u8>,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginLoadResult {
    pub frontend_wasm: Vec<u8>,
    pub frontend_js: Vec<u8>,
    pub frontend_html: Vec<u8>,
}

pub struct PluginManager {
    engine: Engine,
    cache_path: PathBuf,
    loaded_plugins: Mutex<HashMap<String, Arc<Mutex<Plugin>>>>,
}

impl PluginManager {
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

pub fn plugin_manager() -> &'static PluginManager {
    PLUGINMANAGER.get_or_init(|| {
        let mut config = wasmtime::Config::new();
        config.wasm_component_model(true);
        let engine = Engine::new(&config).expect("Failed to create Wasmtime engine");
        PluginManager::new(engine, PathBuf::from("./plugin_cache"))
            .expect("Failed to init PluginManager")
    })
}

#[tauri::command]
pub async fn load_plugin(manifest: PluginManifest) -> Result<PluginLoadResult, String> {
    let manager = plugin_manager();
    manager
        .load_plugin(manifest)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_plugins() -> Result<Vec<PluginManifest>, String> {
    PluginManifestList::new()
        .await
        .map(|list| list.plugins)
        .map_err(|e| e.to_string())
}
