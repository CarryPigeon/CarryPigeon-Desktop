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

use std::{
    collections::BTreeSet,
    io::{Cursor, Read},
    path::{Path, PathBuf},
};

use anyhow::Context;
use serde::{Deserialize, Serialize};
use sha2::Digest;
use tokio::net::TcpStream;
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PluginProvidesDomain {
    pub domain: String,
    pub domain_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct PluginManifestV1 {
    pub plugin_id: String,
    pub name: String,
    pub version: String,
    pub min_host_version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub entry: String,
    pub permissions: Vec<String>,
    pub provides_domains: Vec<PluginProvidesDomain>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct PluginCurrent {
    pub version: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
struct PluginStateFile {
    pub status: String,      // "ok" | "failed"
    pub last_error: String,  // human readable
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginState {
    pub plugin_id: String,
    pub installed_versions: Vec<String>,
    pub current_version: Option<String>,
    pub enabled: bool,
    pub status: String,      // "ok" | "failed"
    pub last_error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginRuntimeEntry {
    pub server_id: String,
    pub plugin_id: String,
    pub version: String,
    pub entry: String,
    pub min_host_version: String,
    pub permissions: Vec<String>,
    pub provides_domains: Vec<PluginProvidesDomain>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ApiServerInfo {
    server_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ApiPluginCatalog {
    plugins: Vec<ApiCatalogItem>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ApiCatalogItem {
    plugin_id: String,
    version: String,
    download: Option<ApiDownload>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
struct ApiDownload {
    url: String,
    sha256: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TlsPolicy {
    Strict,
    Insecure,
    TrustFingerprint,
}

fn parse_tls_policy(raw: Option<&str>) -> TlsPolicy {
    match raw.unwrap_or("strict").trim() {
        "insecure" => TlsPolicy::Insecure,
        "trust_fingerprint" => TlsPolicy::TrustFingerprint,
        _ => TlsPolicy::Strict,
    }
}

fn normalize_fingerprint(raw: &str) -> String {
    raw.trim()
        .to_ascii_lowercase()
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .collect()
}

fn base_plugins_dir() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let parent = cwd
        .file_name()
        .map(|name| name == "src-tauri")
        .unwrap_or(false)
        .then(|| cwd.parent().map(|p| p.to_path_buf()))
        .flatten();
    let root = parent.unwrap_or(cwd);
    root.join("data").join("plugins")
}

fn sanitize_segment(seg: &str) -> anyhow::Result<String> {
    let s = seg.trim();
    if s.is_empty() {
        return Err(anyhow::anyhow!("Invalid empty path segment"));
    }
    if s == "." || s == ".." || s.contains('\\') || s.contains('/') {
        return Err(anyhow::anyhow!("Invalid path segment: {}", s));
    }
    if s.contains(':') {
        return Err(anyhow::anyhow!("Invalid path segment (contains ':'): {}", s));
    }
    Ok(s.to_string())
}

fn safe_join(root: &Path, segments: &[String]) -> anyhow::Result<PathBuf> {
    let mut p = root.to_path_buf();
    for s in segments {
        let seg = sanitize_segment(s)?;
        p.push(seg);
    }
    Ok(p)
}

fn to_http_origin(server_socket: &str) -> anyhow::Result<String> {
    let raw = server_socket.trim();
    if raw.is_empty() {
        return Err(anyhow::anyhow!("Missing server socket"));
    }

    let mapped = if raw.starts_with("ws://") {
        format!("http://{}", &raw["ws://".len()..])
    } else if raw.starts_with("wss://") {
        format!("https://{}", &raw["wss://".len()..])
    } else if raw.starts_with("tcp://") {
        format!("http://{}", &raw["tcp://".len()..])
    } else if raw.starts_with("tls://") {
        format!("https://{}", &raw["tls://".len()..])
    } else if raw.starts_with("tls-insecure://") {
        format!("https://{}", &raw["tls-insecure://".len()..])
    } else if raw.starts_with("tls-fp://") {
        // `tls-fp://{fp}@host:port`
        let rest = &raw["tls-fp://".len()..];
        let addr = rest.split_once('@').map(|x| x.1).unwrap_or(rest);
        format!("https://{}", addr)
    } else if raw.starts_with("http://") || raw.starts_with("https://") {
        raw.to_string()
    } else {
        format!("https://{}", raw)
    };

    let u = reqwest::Url::parse(&mapped).context("Invalid server socket URL")?;
    Ok(format!(
        "{}://{}{}",
        u.scheme(),
        u.host_str().unwrap_or_default(),
        port_suffix(&u)
    ))
}

fn port_suffix(u: &reqwest::Url) -> String {
    match u.port() {
        Some(p) => format!(":{}", p),
        None => "".to_string(),
    }
}

fn extract_host_port_from_origin(origin: &str) -> anyhow::Result<(String, u16)> {
    let u = reqwest::Url::parse(origin).context("Invalid origin URL")?;
    let host = u.host_str().unwrap_or_default().to_string();
    if host.trim().is_empty() {
        return Err(anyhow::anyhow!("Invalid origin host"));
    }
    let port = u
        .port_or_known_default()
        .ok_or_else(|| anyhow::anyhow!("Missing origin port"))?;
    Ok((host, port))
}

async fn verify_https_fingerprint(origin: &str, expected_sha256: &str) -> anyhow::Result<()> {
    let expected = normalize_fingerprint(expected_sha256);
    if expected.len() != 64 {
        return Err(anyhow::anyhow!(
            "Invalid TLS fingerprint: expected SHA-256 (64 hex chars), got len={}",
            expected.len()
        ));
    }

    let (host, port) = extract_host_port_from_origin(origin)?;
    let addr = format!("{}:{}", host, port);
    let stream = TcpStream::connect(addr.clone())
        .await
        .with_context(|| format!("Failed to connect for TLS fingerprint check: {}", addr))?;

    let mut builder = native_tls::TlsConnector::builder();
    // We always allow invalid certs/hostnames here; fingerprint is the trust root.
    builder.danger_accept_invalid_certs(true);
    builder.danger_accept_invalid_hostnames(true);
    let connector = tokio_native_tls::TlsConnector::from(builder.build()?);
    let tls = connector
        .connect(&host, stream)
        .await
        .map_err(|e| anyhow::anyhow!("TLS handshake failed (fingerprint check): {}", e))?;

    let peer = tls
        .get_ref()
        .peer_certificate()
        .map_err(|e| anyhow::anyhow!("Failed to read peer certificate: {}", e))?;
    let Some(cert) = peer else {
        return Err(anyhow::anyhow!("TLS fingerprint check failed: missing peer certificate"));
    };
    let der = cert
        .to_der()
        .map_err(|e| anyhow::anyhow!("Failed to export peer certificate DER: {}", e))?;
    let actual = sha256_hex(&der);
    if actual != expected {
        return Err(anyhow::anyhow!(
            "TLS fingerprint mismatch: expected={} actual={}",
            expected,
            actual
        ));
    }
    Ok(())
}

fn build_reqwest_client(policy: TlsPolicy) -> anyhow::Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder();
    if policy != TlsPolicy::Strict {
        builder = builder
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true);
    }
    Ok(builder.build()?)
}

async fn build_server_client(
    origin: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<reqwest::Client> {
    // Only HTTPS needs special TLS handling.
    if !origin.trim().starts_with("https://") {
        return Ok(reqwest::Client::new());
    }
    let policy = parse_tls_policy(tls_policy);
    if policy == TlsPolicy::TrustFingerprint {
        verify_https_fingerprint(origin, tls_fingerprint.unwrap_or("")).await?;
    }
    build_reqwest_client(policy)
}

async fn fetch_server_id(origin: &str, client: &reqwest::Client) -> anyhow::Result<String> {
    let url = format!("{}/api/server", origin);
    let res = client
        .get(url)
        .header("Accept", "application/vnd.carrypigeon+json; version=1")
        .send()
        .await
        .context("Failed to request /api/server")?
        .error_for_status()
        .context("GET /api/server returned an error status")?;
    let info: ApiServerInfo = res.json().await.context("Failed to parse /api/server JSON")?;
    let id = info.server_id.trim().to_string();
    if id.is_empty() {
        return Err(anyhow::anyhow!("Missing server_id in /api/server response"));
    }
    Ok(id)
}

async fn fetch_plugin_catalog(origin: &str, client: &reqwest::Client) -> anyhow::Result<ApiPluginCatalog> {
    let url = format!("{}/api/plugins/catalog", origin);
    let res = client
        .get(url)
        .header("Accept", "application/vnd.carrypigeon+json; version=1")
        .send()
        .await
        .context("Failed to request /api/plugins/catalog")?
        .error_for_status()
        .context("GET /api/plugins/catalog returned an error status")?;
    Ok(res
        .json::<ApiPluginCatalog>()
        .await
        .context("Failed to parse /api/plugins/catalog JSON")?)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = sha2::Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

fn eq_hash_hex(a: &str, b: &str) -> bool {
    a.trim().eq_ignore_ascii_case(b.trim())
}

fn normalize_zip_name(raw: &str) -> String {
    raw.replace('\\', "/").trim_start_matches('/').to_string()
}

fn is_zip_name_safe(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    if name.starts_with('/') {
        return false;
    }
    // Disallow drive letters / scheme-ish hints.
    if name.contains(':') {
        return false;
    }
    // Disallow traversal segments.
    for seg in name.split('/') {
        if seg.is_empty() || seg == "." || seg == ".." {
            return false;
        }
    }
    true
}

fn detect_single_root_prefix(names: &[String]) -> Option<String> {
    let mut prefix: Option<&str> = None;
    for n in names {
        let segs: Vec<&str> = n.split('/').collect();
        if segs.len() < 2 {
            return None;
        }
        match prefix {
            Some(p) if p != segs[0] => return None,
            None => prefix = Some(segs[0]),
            _ => {}
        }
    }
    prefix.map(|s| s.to_string())
}

fn strip_root_prefix(name: &str, prefix: &str) -> String {
    if !name.starts_with(prefix) {
        return name.to_string();
    }
    let trimmed = name.strip_prefix(prefix).unwrap_or(name);
    trimmed.trim_start_matches('/').to_string()
}

async fn ensure_dir(path: &Path) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create dir: {}", parent.display()))?;
    }
    Ok(())
}

async fn read_json_file<T: for<'de> Deserialize<'de>>(path: &Path) -> anyhow::Result<Option<T>> {
    match tokio::fs::read_to_string(path).await {
        Ok(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return Ok(None);
            }
            let parsed = serde_json::from_str::<T>(trimmed)
                .with_context(|| format!("Failed to parse JSON: {}", path.display()))?;
            Ok(Some(parsed))
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.into()),
    }
}

async fn write_json_file<T: Serialize>(path: &Path, value: &T) -> anyhow::Result<()> {
    ensure_dir(path).await?;
    let s = serde_json::to_string_pretty(value).context("Failed to serialize JSON")?;
    tokio::fs::write(path, s)
        .await
        .with_context(|| format!("Failed to write file: {}", path.display()))?;
    Ok(())
}

fn plugin_root_dir(server_id: &str, plugin_id: &str) -> anyhow::Result<PathBuf> {
    let base = base_plugins_dir();
    let segments = vec![server_id.to_string(), plugin_id.to_string()];
    safe_join(&base, &segments)
}

fn plugin_version_dir(server_id: &str, plugin_id: &str, version: &str) -> anyhow::Result<PathBuf> {
    let base = base_plugins_dir();
    let segments = vec![server_id.to_string(), plugin_id.to_string(), version.to_string()];
    safe_join(&base, &segments)
}

fn current_file_path(server_id: &str, plugin_id: &str) -> anyhow::Result<PathBuf> {
    Ok(plugin_root_dir(server_id, plugin_id)?.join("current.json"))
}

fn state_file_path(server_id: &str, plugin_id: &str) -> anyhow::Result<PathBuf> {
    Ok(plugin_root_dir(server_id, plugin_id)?.join("state.json"))
}

fn manifest_file_path(server_id: &str, plugin_id: &str, version: &str) -> anyhow::Result<PathBuf> {
    Ok(plugin_version_dir(server_id, plugin_id, version)?.join("plugin.json"))
}

async fn list_installed_versions(server_id: &str, plugin_id: &str) -> anyhow::Result<Vec<String>> {
    let root = plugin_root_dir(server_id, plugin_id)?;
    let mut set = BTreeSet::<String>::new();
    let mut rd = match tokio::fs::read_dir(&root).await {
        Ok(rd) => rd,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(err) => return Err(err.into()),
    };
    while let Some(ent) = rd.next_entry().await? {
        let ty = ent.file_type().await?;
        if !ty.is_dir() {
            continue;
        }
        let name = ent.file_name().to_string_lossy().to_string();
        if name.trim().is_empty() {
            continue;
        }
        set.insert(name);
    }
    Ok(set.into_iter().collect())
}

async fn read_current(server_id: &str, plugin_id: &str) -> anyhow::Result<Option<PluginCurrent>> {
    let path = current_file_path(server_id, plugin_id)?;
    read_json_file::<PluginCurrent>(&path).await
}

async fn write_current(server_id: &str, plugin_id: &str, current: &PluginCurrent) -> anyhow::Result<()> {
    let path = current_file_path(server_id, plugin_id)?;
    write_json_file(&path, current).await
}

async fn read_state_file(server_id: &str, plugin_id: &str) -> anyhow::Result<PluginStateFile> {
    let path = state_file_path(server_id, plugin_id)?;
    let existing = read_json_file::<PluginStateFile>(&path).await?;
    Ok(existing.unwrap_or(PluginStateFile {
        status: "ok".to_string(),
        last_error: "".to_string(),
    }))
}

async fn write_state_file(server_id: &str, plugin_id: &str, st: &PluginStateFile) -> anyhow::Result<()> {
    let path = state_file_path(server_id, plugin_id)?;
    write_json_file(&path, st).await
}

async fn build_installed_state(server_id: &str, plugin_id: &str) -> anyhow::Result<InstalledPluginState> {
    let installed_versions = list_installed_versions(server_id, plugin_id).await?;
    let current = read_current(server_id, plugin_id).await?;
    let state = read_state_file(server_id, plugin_id).await?;

    Ok(InstalledPluginState {
        plugin_id: plugin_id.to_string(),
        installed_versions,
        current_version: current.as_ref().map(|c| c.version.clone()),
        enabled: current.as_ref().map(|c| c.enabled).unwrap_or(false),
        status: state.status,
        last_error: state.last_error,
    })
}

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
        format!("{}/{}", origin.trim_end_matches('/'), dl.url.trim_start_matches('/'))
    };

    let base = reqwest::Url::parse(&origin).context("Invalid server origin")?;
    let download_parsed = reqwest::Url::parse(&download_url).context("Invalid download url")?;
    let same_origin = download_parsed.scheme() == base.scheme()
        && download_parsed.host_str() == base.host_str()
        && port_suffix(&download_parsed) == port_suffix(&base);

    let bytes = (if same_origin {
        client.get(download_url)
    } else {
        reqwest::Client::new().get(download_url)
    })
        .send()
        .await
        .context("Failed to download plugin zip")?
        .error_for_status()
        .context("Plugin download returned an error status")?
        .bytes()
        .await
        .context("Failed to read plugin zip bytes")?
        .to_vec();

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

    // Unpack zip in a blocking task to avoid stalling the async runtime.
    let write_root = version_dir.clone();
    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        let mut archive = ZipArchive::new(Cursor::new(bytes)).context("Invalid zip archive")?;

        // Determine whether the zip wraps everything into a single root directory.
        let mut names: Vec<String> = vec![];
        for i in 0..archive.len() {
            let f = archive.by_index(i)?;
            if f.is_dir() {
                continue;
            }
            let normalized = normalize_zip_name(f.name());
            if normalized.is_empty() {
                continue;
            }
            names.push(normalized);
        }
        let root_prefix = detect_single_root_prefix(&names);

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let normalized = normalize_zip_name(file.name());
            if normalized.is_empty() {
                continue;
            }
            if !is_zip_name_safe(&normalized) {
                return Err(anyhow::anyhow!("Unsafe zip entry path: {}", normalized));
            }

            let final_name = if let Some(prefix) = root_prefix.as_deref() {
                strip_root_prefix(&normalized, prefix)
            } else {
                normalized
            };
            if final_name.is_empty() {
                continue;
            }
            if !is_zip_name_safe(&final_name) {
                return Err(anyhow::anyhow!("Unsafe zip entry path after strip: {}", final_name));
            }

            let out_path = write_root.join(&final_name);
            if file.is_dir() {
                std::fs::create_dir_all(&out_path)?;
                continue;
            }
            if is_forbidden_source_file(&final_name) {
                return Err(anyhow::anyhow!(
                    "Plugin package contains forbidden source file: {}",
                    final_name
                ));
            }
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out = std::fs::File::create(&out_path)?;
            let mut buf = Vec::with_capacity(file.size() as usize);
            file.read_to_end(&mut buf)?;
            std::io::Write::write_all(&mut out, &buf)?;
        }
        Ok(())
    })
    .await
    .context("Unpack task join failed")??;

    // Verify manifest exists and matches expected plugin/version.
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

    // Initialize current.json on first install; keep existing current selection if present.
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

    // Reset state to ok after successful install.
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
    let same_origin = download_parsed.scheme() == base.scheme()
        && download_parsed.host_str() == base.host_str()
        && port_suffix(&download_parsed) == port_suffix(&base);

    let bytes = (if same_origin {
        server_client.get(url)
    } else {
        reqwest::Client::new().get(url)
    })
        .send()
        .await
        .context("Failed to download plugin zip")?
        .error_for_status()
        .context("Plugin download returned an error status")?
        .bytes()
        .await
        .context("Failed to read plugin zip bytes")?
        .to_vec();

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

    let write_root = version_dir.clone();
    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        let mut archive = ZipArchive::new(Cursor::new(bytes)).context("Invalid zip archive")?;
        let mut names: Vec<String> = vec![];
        for i in 0..archive.len() {
            let f = archive.by_index(i)?;
            if f.is_dir() {
                continue;
            }
            let normalized = normalize_zip_name(f.name());
            if normalized.is_empty() {
                continue;
            }
            names.push(normalized);
        }
        let root_prefix = detect_single_root_prefix(&names);

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let normalized = normalize_zip_name(file.name());
            if normalized.is_empty() {
                continue;
            }
            if !is_zip_name_safe(&normalized) {
                return Err(anyhow::anyhow!("Unsafe zip entry path: {}", normalized));
            }

            let final_name = if let Some(prefix) = root_prefix.as_deref() {
                strip_root_prefix(&normalized, prefix)
            } else {
                normalized
            };
            if final_name.is_empty() {
                continue;
            }
            if !is_zip_name_safe(&final_name) {
                return Err(anyhow::anyhow!("Unsafe zip entry path after strip: {}", final_name));
            }

            let out_path = write_root.join(&final_name);
            if file.is_dir() {
                std::fs::create_dir_all(&out_path)?;
                continue;
            }
            if is_forbidden_source_file(&final_name) {
                return Err(anyhow::anyhow!(
                    "Plugin package contains forbidden source file: {}",
                    final_name
                ));
            }
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out = std::fs::File::create(&out_path)?;
            let mut buf = Vec::with_capacity(file.size() as usize);
            file.read_to_end(&mut buf)?;
            std::io::Write::write_all(&mut out, &buf)?;
        }
        Ok(())
    })
    .await
    .context("Unpack task join failed")??;

    // Verify manifest exists and matches expected plugin/version.
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

fn is_forbidden_source_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    if lower.ends_with(".d.ts") {
        return false;
    }
    lower.ends_with(".vue")
        || lower.ends_with(".ts")
        || lower.ends_with(".tsx")
        || lower.ends_with(".scss")
        || lower.ends_with(".sass")
        || lower.ends_with(".less")
}

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

    // Validate required files exist before marking enabled.
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

fn storage_file_path(server_id: &str, plugin_id: &str) -> anyhow::Result<PathBuf> {
    Ok(plugin_root_dir(server_id, plugin_id)?.join("storage.json"))
}

pub async fn storage_get(
    server_socket: &str,
    plugin_id: &str,
    key: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<Option<serde_json::Value>> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let path = storage_file_path(&server_id, plugin_id)?;
    let raw = match tokio::fs::read_to_string(&path).await {
        Ok(v) => v,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    let map: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(&raw).context("Invalid storage.json")?;
    Ok(map.get(key).cloned())
}

pub async fn storage_set(
    server_socket: &str,
    plugin_id: &str,
    key: &str,
    value: serde_json::Value,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<()> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let server_id = fetch_server_id(&origin, &client).await?;
    let path = storage_file_path(&server_id, plugin_id)?;
    let mut map: serde_json::Map<String, serde_json::Value> = match tokio::fs::read_to_string(&path).await {
        Ok(v) => serde_json::from_str(&v).context("Invalid storage.json")?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => serde_json::Map::new(),
        Err(e) => return Err(e.into()),
    };
    map.insert(key.to_string(), value);
    let out = serde_json::to_string_pretty(&map).context("Failed to serialize storage")?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .with_context(|| format!("Failed to create dir: {}", parent.display()))?;
    }
    tokio::fs::write(&path, out)
        .await
        .with_context(|| format!("Failed to write: {}", path.display()))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginFetchResponse {
    pub ok: bool,
    pub status: u16,
    pub body_text: String,
    pub headers: std::collections::HashMap<String, String>,
}

pub async fn network_fetch(
    server_socket: &str,
    url: &str,
    method: &str,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<PluginFetchResponse> {
    let origin = to_http_origin(server_socket)?;
    let client = build_server_client(&origin, tls_policy, tls_fingerprint).await?;
    let base = reqwest::Url::parse(&origin).context("Invalid server origin")?;

    let raw_url = url.trim();
    if raw_url.is_empty() {
        return Err(anyhow::anyhow!("Missing url"));
    }
    let full = if raw_url.starts_with('/') {
        format!("{}{}", origin.trim_end_matches('/'), raw_url)
    } else {
        raw_url.to_string()
    };
    let target = reqwest::Url::parse(&full).context("Invalid url")?;

    let same_origin = target.scheme() == base.scheme()
        && target.host_str() == base.host_str()
        && port_suffix(&target) == port_suffix(&base);
    if !same_origin {
        return Err(anyhow::anyhow!("Network access denied: cross-origin"));
    }

    let m = reqwest::Method::from_bytes(method.trim().to_uppercase().as_bytes())
        .context("Invalid method")?;
    let mut req = client.request(m, target);
    for (k, v) in headers {
        if k.trim().is_empty() {
            continue;
        }
        req = req.header(k, v);
    }
    if let Some(b) = body {
        req = req.body(b);
    }
    let res = req.send().await.context("Request failed")?;
    let status = res.status();
    let mut out_headers = std::collections::HashMap::new();
    for (k, v) in res.headers().iter() {
        if let Ok(s) = v.to_str() {
            out_headers.insert(k.to_string(), s.to_string());
        }
    }
    let body_text = res.text().await.unwrap_or_default();
    Ok(PluginFetchResponse {
        ok: status.is_success(),
        status: status.as_u16(),
        body_text,
        headers: out_headers,
    })
}
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

/// Resolve a file path for the `app://plugins/...` custom protocol.
///
/// The returned path always points into the repository `data/plugins` directory
/// (dev-friendly). Callers must still ensure they set correct Content-Type.
pub fn resolve_app_plugins_path(
    server_id: &str,
    plugin_id: &str,
    version: &str,
    rel_path: &str,
) -> anyhow::Result<PathBuf> {
    let base = base_plugins_dir();
    let rel = rel_path.trim().trim_start_matches('/');
    if rel.is_empty() {
        return Err(anyhow::anyhow!("Missing relative path"));
    }
    if rel.contains('\\') {
        return Err(anyhow::anyhow!("Invalid relative path (contains backslash)"));
    }
    // Prevent traversal. We keep the rule strict: no "."/".." segments.
    for seg in rel.split('/') {
        if seg.is_empty() || seg == "." || seg == ".." {
            return Err(anyhow::anyhow!("Invalid relative path segment"));
        }
    }
    let segments = vec![
        server_id.to_string(),
        plugin_id.to_string(),
        version.to_string(),
    ];
    let root = safe_join(&base, &segments)?;
    Ok(root.join(rel))
}
