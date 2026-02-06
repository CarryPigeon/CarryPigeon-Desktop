//! 插件本地安装存储（zip 安装 + current.json/state.json + 文件路径映射）。
//!
//! 本模块实现 PRD/UI/协议文档所需的“客户端本地插件生命周期”的最小落地：
//! - 从 server catalog 下载 zip
//! - sha256 校验
//! - 解压到本地（按 server_id 隔离）
//! - 维护 current.json（当前版本 + enabled）与 state.json（status/last_error）
//!
//! 关联文档：
//! - `design/client/PLUGIN-PACKAGE-STRUCTURE.md`
//! - `design/client/PLUGIN-INSTALL-UPDATE.md`
//! - `design/client/APP-URL-SPEC.md`
//! - `docs/api/*`（/api/server, /api/plugins/catalog）

use std::path::PathBuf;

use anyhow::Context;
use serde::{Deserialize, Serialize};

mod api;
mod download;
mod hash;
mod json_io;
mod net_fetch;
mod origin;
mod paths;
mod state;
mod storage;
mod tls;
mod unpack;

use api::{fetch_plugin_catalog, fetch_server_id};
use download::download_plugin_zip_bytes;
use hash::{eq_hash_hex, sha256_hex};
use origin::to_http_origin;
use paths::{base_plugins_dir, manifest_file_path, plugin_root_dir, plugin_version_dir};
use state::{
    PluginCurrent, PluginStateFile, build_installed_state, read_current, write_current,
    write_state_file,
};
use tls::build_server_client;
use unpack::unpack_plugin_zip;

/// 插件清单中声明的“提供 domain”条目。
///
/// # 说明
/// - 该结构用于对齐前端插件中心的“domain 绑定/渲染”能力；
/// - 序列化字段使用 `snake_case`，与 `plugin.json` 保持一致。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PluginProvidesDomain {
    /// domain id（例如 `Core:Text`）。
    pub domain: String,
    /// domain 协议版本（例如 `v1`）。
    pub domain_version: String,
}

/// `plugin.json`（V1）清单结构。
///
/// # 说明
/// - 该结构是插件包的“权威元数据”，用于安装校验与运行时入口解析；
/// - 字段命名与文档约定一致（`snake_case`）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PluginManifestV1 {
    /// 插件 id（稳定标识）。
    pub plugin_id: String,
    /// 插件名称（展示用）。
    pub name: String,
    /// 插件版本（语义化版本或其它约定）。
    pub version: String,
    /// 宿主最低版本要求（用于兼容性判断）。
    pub min_host_version: String,
    /// 插件描述（可选）。
    pub description: Option<String>,
    /// 作者信息（可选）。
    pub author: Option<String>,
    /// 许可证信息（可选）。
    pub license: Option<String>,
    /// 运行时入口相对路径（相对于插件版本目录）。
    pub entry: String,
    /// 插件权限列表（字符串 key）。
    pub permissions: Vec<String>,
    /// 插件提供的 domain 列表。
    pub provides_domains: Vec<PluginProvidesDomain>,
}

// current.json/state.json 的结构体与读写逻辑已下沉到 `state` 子模块。

/// 已安装插件的汇总状态（面向前端展示）。
///
/// # 说明
/// - 该结构是“安装目录 + current.json + state.json”的汇总视图；
/// - 序列化字段使用 `camelCase`，与前端 TS 类型保持一致。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginState {
    /// 插件 id。
    pub plugin_id: String,
    /// 已安装版本列表（目录扫描结果）。
    pub installed_versions: Vec<String>,
    /// 当前选择版本（来自 current.json）。
    pub current_version: Option<String>,
    /// 是否启用（来自 current.json）。
    pub enabled: bool,
    /// 插件状态（例如 `"ok"`/`"failed"`）。
    pub status: String, // "ok" | "failed"
    /// 最近一次错误消息（来自 state.json）。
    pub last_error: String,
}

/// 插件运行时入口信息（供前端动态 import）。
///
/// # 说明
/// - 前端通过该结构拼装 `app://plugins/...` URL 并加载插件模块；
/// - 序列化字段使用 `camelCase`，与前端 TS 类型保持一致。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRuntimeEntry {
    /// 服务端 id（由 `/api/server/id` 返回，用于本地隔离目录）。
    pub server_id: String,
    /// 插件 id。
    pub plugin_id: String,
    /// 插件版本。
    pub version: String,
    /// 入口相对路径（来自 plugin.json）。
    pub entry: String,
    /// 宿主最低版本要求（来自 plugin.json）。
    pub min_host_version: String,
    /// 权限列表（来自 plugin.json）。
    pub permissions: Vec<String>,
    /// 插件提供的 domain 列表（来自 plugin.json）。
    pub provides_domains: Vec<PluginProvidesDomain>,
}

// 路径映射、JSON 读写、状态文件管理已下沉到子模块：`paths` / `json_io` / `state`。

/// 列出某个服务端下本地已安装的插件状态列表。
///
/// # 参数
/// - `server_socket`：服务端 socket（用于解析 origin 并获取 server_id）。
/// - `tls_policy`：TLS 策略（可选）。
/// - `tls_fingerprint`：TLS 指纹（可选）。
///
/// # 返回值
/// - `Ok(Vec<InstalledPluginState>)`：已安装插件状态列表。
/// - `Err(anyhow::Error)`：读取/解析失败原因。
///
/// # 说明
/// - 本函数会先请求服务端 id，再在本地 `data/plugins/{server_id}` 下扫描安装目录；
/// - 若目录不存在，返回空列表（视为“未安装任何插件”）。
pub async fn list_installed(
    server_socket: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<Vec<InstalledPluginState>> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let base = base_plugins_dir().join(&server_id);

    let mut out: Vec<InstalledPluginState> = vec![];
    let mut rd = match tokio::fs::read_dir(&base).await {
        Ok(rd) => rd,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(err) => return Err(err.into()),
    };
    while let Some(ent) = rd.next_entry().await? {
        let ty = ent.file_type().await?;
        if !ty.is_dir() {
            continue;
        }
        let plugin_id = ent.file_name().to_string_lossy().to_string();
        if plugin_id.trim().is_empty() {
            continue;
        }
        out.push(build_installed_state(&server_id, &plugin_id).await?);
    }
    Ok(out)
}

/// 获取某个插件的本地安装状态。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(Some(InstalledPluginState))`：已安装则返回状态。
/// - `Ok(None)`：未安装。
/// - `Err(anyhow::Error)`：读取失败原因。
pub async fn get_installed(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<Option<InstalledPluginState>> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let root = plugin_root_dir(&server_id, plugin_id)?;
    if tokio::fs::metadata(&root).await.is_err() {
        return Ok(None);
    }
    Ok(Some(build_installed_state(&server_id, plugin_id).await?))
}

/// 获取插件“当前版本”的运行时入口信息。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(PluginRuntimeEntry)`：运行时入口信息。
/// - `Err(anyhow::Error)`：插件未安装或解析失败原因。
///
/// # 说明
/// 当前版本来自 `current.json`；若插件未安装，会返回错误（而非 `None`）。
pub async fn get_runtime_entry(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<PluginRuntimeEntry> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let current = read_current(&server_id, plugin_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Plugin is not installed: {}", plugin_id))?;
    get_runtime_entry_for_version_inner(&origin, &server_id, plugin_id, &current.version).await
}

/// 获取插件“指定版本”的运行时入口信息。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `version`：目标版本（不能为空）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(PluginRuntimeEntry)`：运行时入口信息。
/// - `Err(anyhow::Error)`：解析失败原因（例如版本为空/清单缺失）。
pub async fn get_runtime_entry_for_version(
    server_socket: &str,
    plugin_id: &str,
    version: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<PluginRuntimeEntry> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let v = version.trim();
    if v.is_empty() {
        return Err(anyhow::anyhow!("Missing version"));
    }
    get_runtime_entry_for_version_inner(&origin, &server_id, plugin_id, v).await
}

async fn get_runtime_entry_for_version_inner(
    _origin: &str,
    server_id: &str,
    plugin_id: &str,
    version: &str,
) -> anyhow::Result<PluginRuntimeEntry> {
    let manifest_path = manifest_file_path(server_id, plugin_id, version)?;
    let raw = tokio::fs::read_to_string(&manifest_path)
        .await
        .with_context(|| format!("Failed to read manifest: {}", manifest_path.display()))?;
    let manifest: PluginManifestV1 = serde_json::from_str(&raw).context("Invalid plugin.json")?;
    let entry = manifest.entry.trim().to_string();
    if entry.is_empty() {
        return Err(anyhow::anyhow!("Manifest entry is empty"));
    }
    Ok(PluginRuntimeEntry {
        server_id: server_id.to_string(),
        plugin_id: plugin_id.to_string(),
        version: version.to_string(),
        entry,
        min_host_version: manifest.min_host_version.trim().to_string(),
        permissions: manifest
            .permissions
            .iter()
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect(),
        provides_domains: manifest
            .provides_domains
            .iter()
            .map(|d| PluginProvidesDomain {
                domain: d.domain.trim().to_string(),
                domain_version: d.domain_version.trim().to_string(),
            })
            .filter(|d| !d.domain.is_empty())
            .collect(),
    })
}

/// 从服务端插件目录（catalog）安装插件。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `expected_version`：期望版本（可选；若提供且不匹配则报错）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：安装后的插件状态。
/// - `Err(anyhow::Error)`：安装失败原因（下载/校验/解压/写入状态等）。
///
/// # 说明
/// - 会根据 catalog 的 download url + sha256 下载 zip 并做完整性校验；
/// - 解压后会校验 `plugin.json` 的 `plugin_id/version/entry` 等关键字段；
/// - 首次安装会初始化 `current.json`（默认 disabled），并将 `state.json` 重置为 ok。
pub async fn install_from_server_catalog(
    server_socket: &str,
    plugin_id: &str,
    expected_version: Option<&str>,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<InstalledPluginState> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let catalog = fetch_plugin_catalog(&origin, &client).await?;

    let target = catalog
        .plugins
        .iter()
        .find(|p| p.plugin_id == plugin_id)
        .ok_or_else(|| anyhow::anyhow!("Plugin not found in catalog: {}", plugin_id))?;

    if let Some(v) = expected_version {
        let want = v.trim();
        if !want.is_empty() && want != target.version.trim() {
            return Err(anyhow::anyhow!(
                "Version mismatch for {}: expected {}, catalog {}",
                plugin_id,
                want,
                target.version
            ));
        }
    }

    let dl = target
        .download
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Missing download info for {}", plugin_id))?;
    if dl.url.trim().is_empty() || dl.sha256.trim().is_empty() {
        return Err(anyhow::anyhow!("Invalid download info for {}", plugin_id));
    }

    let download_url = if dl.url.starts_with("http://") || dl.url.starts_with("https://") {
        dl.url.clone()
    } else {
        format!(
            "{}/{}",
            origin.trim_end_matches('/'),
            dl.url.trim_start_matches('/')
        )
    };

    let base = reqwest::Url::parse(&origin).context("Invalid server origin")?;
    let download_parsed = reqwest::Url::parse(&download_url).context("Invalid download url")?;
    let bytes = download_plugin_zip_bytes(&base, &client, download_parsed).await?;

    let got = sha256_hex(&bytes);
    if !eq_hash_hex(&got, &dl.sha256) {
        return Err(anyhow::anyhow!(
            "SHA256 mismatch for {}: expected {}, got {}",
            plugin_id,
            dl.sha256,
            got
        ));
    }

    let version = target.version.trim().to_string();
    let version_dir = plugin_version_dir(&server_id, plugin_id, &version)?;
    tokio::fs::create_dir_all(&version_dir)
        .await
        .with_context(|| format!("Failed to create dir: {}", version_dir.display()))?;

    unpack_plugin_zip(bytes, version_dir.clone()).await?;

    // 校验 plugin.json 存在且 plugin/version 与预期一致。
    let manifest_path = version_dir.join("plugin.json");
    let raw = tokio::fs::read_to_string(&manifest_path)
        .await
        .with_context(|| format!("Missing plugin.json at {}", manifest_path.display()))?;
    let manifest: PluginManifestV1 = serde_json::from_str(&raw).context("Invalid plugin.json")?;
    let mid = manifest.plugin_id.trim();
    if mid != plugin_id {
        return Err(anyhow::anyhow!(
            "plugin_id mismatch in manifest: expected {}, got {}",
            plugin_id,
            mid
        ));
    }
    let mv = manifest.version.trim();
    if mv != version {
        return Err(anyhow::anyhow!(
            "version mismatch in manifest: expected {}, got {}",
            version,
            mv
        ));
    }
    if manifest.entry.trim().is_empty() {
        return Err(anyhow::anyhow!("Manifest entry is empty"));
    }

    // 首次安装初始化 current.json；若已存在则保留原选择。
    let current = read_current(&server_id, plugin_id).await?;
    if current.is_none() {
        write_current(
            &server_id,
            plugin_id,
            &PluginCurrent {
                version: version.clone(),
                enabled: false,
            },
        )
        .await?;
    }

    // 安装成功后把 state 重置为 ok。
    write_state_file(
        &server_id,
        plugin_id,
        &PluginStateFile {
            status: "ok".to_string(),
            last_error: "".to_string(),
        },
    )
    .await?;

    build_installed_state(&server_id, plugin_id).await
}

/// 从指定 URL 安装插件（自定义来源）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id（不能为空）。
/// - `version`：插件版本（不能为空）。
/// - `download_url`：插件 zip 下载地址（不能为空）。
/// - `sha256_expected`：期望 sha256（不能为空）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：安装后的插件状态。
/// - `Err(anyhow::Error)`：安装失败原因。
///
/// # 说明
/// 流程与 `install_from_server_catalog` 类似，但安装源由调用方显式指定。
pub async fn install_from_url(
    server_socket: &str,
    plugin_id: &str,
    version: &str,
    download_url: &str,
    sha256_expected: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<InstalledPluginState> {
    let origin = to_http_origin(server_socket)?;
    let server_client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &server_client).await?;

    let id = plugin_id.trim();
    if id.is_empty() {
        return Err(anyhow::anyhow!("Missing plugin_id"));
    }
    let v = version.trim();
    if v.is_empty() {
        return Err(anyhow::anyhow!("Missing version"));
    }
    let url = download_url.trim();
    if url.is_empty() {
        return Err(anyhow::anyhow!("Missing download url"));
    }
    let sha = sha256_expected.trim();
    if sha.is_empty() {
        return Err(anyhow::anyhow!("Missing sha256"));
    }

    let base = reqwest::Url::parse(&origin).context("Invalid server origin")?;
    let download_parsed = reqwest::Url::parse(url).context("Invalid download url")?;
    let bytes = download_plugin_zip_bytes(&base, &server_client, download_parsed).await?;

    let got = sha256_hex(&bytes);
    if !eq_hash_hex(&got, sha) {
        return Err(anyhow::anyhow!(
            "SHA256 mismatch for {}: expected {}, got {}",
            id,
            sha,
            got
        ));
    }

    let version_dir = plugin_version_dir(&server_id, id, v)?;
    tokio::fs::create_dir_all(&version_dir)
        .await
        .with_context(|| format!("Failed to create dir: {}", version_dir.display()))?;

    unpack_plugin_zip(bytes, version_dir.clone()).await?;

    // 校验 plugin.json 存在且 plugin/version 与预期一致。
    let manifest_path = version_dir.join("plugin.json");
    let raw = tokio::fs::read_to_string(&manifest_path)
        .await
        .with_context(|| format!("Missing plugin.json at {}", manifest_path.display()))?;
    let manifest: PluginManifestV1 = serde_json::from_str(&raw).context("Invalid plugin.json")?;
    let mid = manifest.plugin_id.trim();
    if mid != id {
        return Err(anyhow::anyhow!(
            "plugin_id mismatch in manifest: expected {}, got {}",
            id,
            mid
        ));
    }
    let mv = manifest.version.trim();
    if mv != v {
        return Err(anyhow::anyhow!(
            "version mismatch in manifest: expected {}, got {}",
            v,
            mv
        ));
    }
    if manifest.entry.trim().is_empty() {
        return Err(anyhow::anyhow!("Manifest entry is empty"));
    }

    let current = read_current(&server_id, id).await?;
    if current.is_none() {
        write_current(
            &server_id,
            id,
            &PluginCurrent {
                version: v.to_string(),
                enabled: false,
            },
        )
        .await?;
    }

    write_state_file(
        &server_id,
        id,
        &PluginStateFile {
            status: "ok".to_string(),
            last_error: "".to_string(),
        },
    )
    .await?;

    build_installed_state(&server_id, id).await
}

/// 启用已安装插件。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：启用后的插件状态。
/// - `Err(anyhow::Error)`：启用失败原因。
///
/// # 说明
/// - 启用前会校验 `plugin.json` 与入口文件是否存在；
/// - 若入口缺失，会将状态写为 failed 并返回错误，避免 UI “显示可用但无法加载”。
pub async fn enable(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<InstalledPluginState> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let mut current = read_current(&server_id, plugin_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Plugin is not installed: {}", plugin_id))?;

    // 标记 enabled 之前先校验关键文件存在，避免 UI 显示“可用”但实际无法加载。
    let manifest_path = manifest_file_path(&server_id, plugin_id, &current.version)?;
    let raw = tokio::fs::read_to_string(&manifest_path)
        .await
        .with_context(|| format!("Missing plugin.json: {}", manifest_path.display()))?;
    let manifest: PluginManifestV1 = serde_json::from_str(&raw).context("Invalid plugin.json")?;
    let entry_rel = manifest.entry.trim();
    let entry_path = plugin_version_dir(&server_id, plugin_id, &current.version)?.join(entry_rel);
    if tokio::fs::metadata(&entry_path).await.is_err() {
        let msg = format!("Missing plugin entry: {}", entry_rel);
        write_state_file(
            &server_id,
            plugin_id,
            &PluginStateFile {
                status: "failed".to_string(),
                last_error: msg.clone(),
            },
        )
        .await?;
        return Err(anyhow::anyhow!(msg));
    }

    current.enabled = true;
    write_current(&server_id, plugin_id, &current).await?;
    write_state_file(
        &server_id,
        plugin_id,
        &PluginStateFile {
            status: "ok".to_string(),
            last_error: "".to_string(),
        },
    )
    .await?;
    build_installed_state(&server_id, plugin_id).await
}

/// 将插件标记为失败，并写入错误信息。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `message`：错误信息（会做 trim）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：更新后的插件状态。
/// - `Err(anyhow::Error)`：更新失败原因。
///
/// # 说明
/// - 该操作会强制将 `current.enabled` 置为 false；
/// - `state.json` 会被写为 `failed` 并更新 `last_error`。
pub async fn set_failed(
    server_socket: &str,
    plugin_id: &str,
    message: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<InstalledPluginState> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let mut current = read_current(&server_id, plugin_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Plugin is not installed: {}", plugin_id))?;
    current.enabled = false;
    write_current(&server_id, plugin_id, &current).await?;
    write_state_file(
        &server_id,
        plugin_id,
        &PluginStateFile {
            status: "failed".to_string(),
            last_error: message.trim().to_string(),
        },
    )
    .await?;
    build_installed_state(&server_id, plugin_id).await
}

/// 清除插件错误信息（将状态恢复为 ok，清空 last_error）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：更新后的插件状态。
/// - `Err(anyhow::Error)`：更新失败原因。
///
/// # 说明
/// 该操作不会修改 `current.enabled`。
pub async fn clear_error(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<InstalledPluginState> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    write_state_file(
        &server_id,
        plugin_id,
        &PluginStateFile {
            status: "ok".to_string(),
            last_error: "".to_string(),
        },
    )
    .await?;
    build_installed_state(&server_id, plugin_id).await
}

pub use net_fetch::{PluginFetchResponse, network_fetch};
pub use storage::{storage_get, storage_set};

/// 禁用已安装插件。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：禁用后的插件状态。
/// - `Err(anyhow::Error)`：禁用失败原因。
pub async fn disable(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<InstalledPluginState> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let mut current = read_current(&server_id, plugin_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Plugin is not installed: {}", plugin_id))?;
    current.enabled = false;
    write_current(&server_id, plugin_id, &current).await?;
    build_installed_state(&server_id, plugin_id).await
}

/// 切换插件当前版本。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `version`：目标版本（必须已安装）。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(InstalledPluginState)`：切换后的插件状态。
/// - `Err(anyhow::Error)`：切换失败原因（例如版本未安装）。
///
/// # 说明
/// - 若 `current.json` 不存在，会创建默认 current（enabled=false）；
/// - 若存在，会保留 enabled 标记，仅更新 version。
pub async fn switch_version(
    server_socket: &str,
    plugin_id: &str,
    version: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<InstalledPluginState> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let v = version.trim();
    if v.is_empty() {
        return Err(anyhow::anyhow!("Missing version"));
    }
    let version_dir = plugin_version_dir(&server_id, plugin_id, v)?;
    tokio::fs::metadata(&version_dir)
        .await
        .with_context(|| format!("Version is not installed: {}", v))?;

    let mut current = read_current(&server_id, plugin_id)
        .await?
        .unwrap_or(PluginCurrent {
            version: v.to_string(),
            enabled: false,
        });
    current.version = v.to_string();
    write_current(&server_id, plugin_id, &current).await?;
    build_installed_state(&server_id, plugin_id).await
}

/// 卸载插件（删除本地安装目录）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
/// - `plugin_id`：插件 id。
/// - `tls_policy`/`tls_fingerprint`：TLS 相关参数（可选）。
///
/// # 返回值
/// - `Ok(())`：卸载成功或目录不存在。
/// - `Err(anyhow::Error)`：卸载失败原因。
pub async fn uninstall(
    server_socket: &str,
    plugin_id: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<()> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let root = plugin_root_dir(&server_id, plugin_id)?;
    match tokio::fs::remove_dir_all(&root).await {
        Ok(_) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.into()),
    }
}

/// 解析 `app://plugins/...` 自定义 scheme 对应的本地文件路径。
///
/// 说明：
/// - 返回路径始终落在仓库的 `data/plugins` 目录下（开发态友好，便于直接查看文件）；
/// - 调用方仍需自行设置正确的 Content-Type（该函数不推断 MIME）。
pub fn resolve_app_plugins_path(
    server_id: &str,
    plugin_id: &str,
    version: &str,
    rel_path: &str,
) -> anyhow::Result<PathBuf> {
    paths::resolve_app_plugins_path(server_id, plugin_id, version, rel_path)
}
