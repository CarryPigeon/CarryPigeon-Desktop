//! plugin_store｜受控网络访问（同源 fetch + `network:external` 跨源放行）。
//!
//! 说明：
//! - 插件运行时可能需要发起 HTTP 请求（例如访问服务端扩展 API）；
//! - 默认强制“同源限制”：只能访问当前 server origin，防止客户端变成开放代理；
//! - manifest 声明 `network:external` 权限的插件可访问任意外部 http/https 目标
//!   （例如 OpenAI 兼容 provider、本地 Ollama），外源请求使用系统证书校验，
//!   不继承聊天服务器的自签 TLS 策略；
//! - 请求头值中的 `@secret(<name>)` 引用由本模块在发送前从该插件的 keyring
//!   命名空间解析替换，密钥明文不进入 WebView、不落日志。

use crate::features::plugins::domain::types::PluginFetchResponse;
use anyhow::Context;

use super::api::fetch_server_id;
use super::secrets;
use super::{
    PluginManifestV1, download::is_same_origin, origin::to_http_origin, paths::manifest_file_path,
    state::read_current, tls,
};

/// 跨源访问所需的 manifest 权限。
pub const PERMISSION_NETWORK_EXTERNAL: &str = "network:external";

/// 单个请求头值中允许的最大密钥引用数（防御性上限）。
const MAX_SECRET_REFERENCES_PER_HEADER: usize = 8;

/// 密钥引用的完整形式（名称限 `[A-Za-z0-9._-]{1,64}`，解析时统一净化）。
const SECRET_REF_PREFIX: &str = "@secret(";

/// 请求超时（毫秒）夹取范围：过小会让慢上游必然失败，过大失去保护意义。
const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 120_000;

/// 以插件权限边界发起受控 HTTP 请求。
///
/// # 参数
/// - `server_socket`：服务器 socket 地址（用于推导同源 origin 与 server_id）。
/// - `plugin_id`：发起请求的插件 id（权限与密钥命名空间归属）。
/// - `url`：目标 URL（允许以 `/path` 形式传入，会自动拼接到 `origin`）。
/// - `method`：HTTP method（例如 `GET` / `POST`）。
/// - `headers`：请求头映射表；值中的 `@secret(<name>)` 引用会被解析替换。
/// - `body`：请求体（可选，文本）。
/// - `timeout_ms`：请求超时毫秒（可选，夹取到 [1000, 120000]）。
/// - `tls_policy`：TLS 策略（可选，取值与前端一致，仅作用于同源请求）。
/// - `tls_fingerprint`：TLS 指纹（可选，SHA-256 hex，仅作用于同源请求）。
///
/// # 返回值
/// - 成功时返回 `PluginFetchResponse`。
///
/// # 说明
/// - 同源请求始终允许；跨源请求要求插件 manifest 声明 `network:external` 权限；
/// - 仅允许 http/https 协议；重定向一律不跟随（防止借 302 绕过边界）；
/// - 引用的密钥不存在时返回错误（不静默发送空密钥）。
pub async fn network_fetch(
    server_socket: &str,
    plugin_id: &str,
    url: &str,
    method: &str,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
    timeout_ms: Option<u64>,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<PluginFetchResponse> {
    let origin = to_http_origin(server_socket)?;
    let base = reqwest::Url::parse(&origin).context("Invalid server origin")?;

    let raw_url = url.trim();
    if raw_url.is_empty() {
        return Err(anyhow::anyhow!("Missing url"));
    }
    let plugin_id = plugin_id.trim();
    if plugin_id.is_empty() {
        return Err(anyhow::anyhow!("Missing plugin id"));
    }
    let full = if raw_url.starts_with('/') {
        format!("{}{}", origin.trim_end_matches('/'), raw_url)
    } else {
        raw_url.to_string()
    };
    let target = reqwest::Url::parse(&full).context("Invalid url")?;
    if target.scheme() != "http" && target.scheme() != "https" {
        return Err(anyhow::anyhow!("Network access denied: unsupported scheme"));
    }

    // server_id 同时用于权限归属与密钥命名空间；有缓存时不会产生额外网络请求。
    let server_id = fetch_server_id(&origin, tls_policy, tls_fingerprint).await?;

    let same_origin = is_same_origin(&target, &base);
    let client = if same_origin {
        tls::build_server_client(&origin, tls_policy, tls_fingerprint).await?
    } else {
        // 跨源访问：要求 manifest 声明 network:external 权限（权威来源为本地已安装清单）。
        let permissions = installed_permissions(&server_id, plugin_id).await?;
        if !has_network_external_permission(&permissions) {
            return Err(anyhow::anyhow!(
                "Network access denied: cross-origin requires permission '{}'",
                PERMISSION_NETWORK_EXTERNAL
            ));
        }
        tracing::debug!(
            action = "plugins_network_external_fetch",
            server_id = %server_id,
            plugin_id = %plugin_id,
            target_host = target.host_str().unwrap_or_default()
        );
        tls::build_external_client()?
    };

    let m = reqwest::Method::from_bytes(method.trim().to_uppercase().as_bytes())
        .context("Invalid method")?;
    let mut req = client.request(m, target);
    if let Some(ms) = timeout_ms {
        req = req.timeout(std::time::Duration::from_millis(
            ms.clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
        ));
    }
    for (k, v) in headers {
        if k.trim().is_empty() {
            continue;
        }
        let value = resolve_secret_references(&v, &server_id, plugin_id)
            .with_context(|| format!("Failed to resolve secret reference in header '{}'", k))?;
        req = req.header(k, value);
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

/// 判断权限表是否授予跨源访问。
fn has_network_external_permission(permissions: &[String]) -> bool {
    permissions.iter().any(|p| p == PERMISSION_NETWORK_EXTERNAL)
}

/// 读取本地已安装插件当前版本的 manifest 权限（权威来源，插件 JS 无法伪造）。
async fn installed_permissions(server_id: &str, plugin_id: &str) -> anyhow::Result<Vec<String>> {
    let current = read_current(server_id, plugin_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Plugin is not installed: {}", plugin_id))?;
    let manifest_path = manifest_file_path(server_id, plugin_id, &current.version)?;
    let raw = tokio::fs::read_to_string(&manifest_path)
        .await
        .with_context(|| format!("Failed to read manifest: {}", manifest_path.display()))?;
    let manifest: PluginManifestV1 = serde_json::from_str(&raw).context("Invalid plugin.json")?;
    Ok(manifest
        .permissions
        .iter()
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect())
}

/// 解析请求头值中的全部 `@secret(<name>)` 引用并替换为密钥明文。
///
/// # 参数
/// - `value`：原始头值（如 `Bearer @secret(api_key)`）。
/// - `server_id` / `plugin_id`：密钥命名空间归属。
///
/// # 返回值
/// - 替换后的头值；引用缺失/格式非法/超过数量上限时返回错误。
fn resolve_secret_references(
    value: &str,
    server_id: &str,
    plugin_id: &str,
) -> anyhow::Result<String> {
    if !value.contains(SECRET_REF_PREFIX) {
        return Ok(value.to_string());
    }
    let mut out = String::with_capacity(value.len());
    let mut rest = value;
    let mut references = 0usize;
    while let Some(pos) = rest.find(SECRET_REF_PREFIX) {
        out.push_str(&rest[..pos]);
        let after = &rest[pos + SECRET_REF_PREFIX.len()..];
        let Some(end) = after.find(')') else {
            return Err(anyhow::anyhow!("Invalid secret reference: missing ')'"));
        };
        let name = &after[..end];
        validate_secret_ref_name(name)?;
        references += 1;
        if references > MAX_SECRET_REFERENCES_PER_HEADER {
            return Err(anyhow::anyhow!(
                "Too many secret references in one header (max {})",
                MAX_SECRET_REFERENCES_PER_HEADER
            ));
        }
        let account = secrets::account_for(server_id, plugin_id, name)?;
        let secret = crate::shared::secure_store::get_secret(&account)
            .with_context(|| format!("Failed to read secret '{}'", name))?
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| anyhow::anyhow!("Plugin secret not found: {}", name))?;
        out.push_str(secret.trim());
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    Ok(out)
}

/// 校验密钥引用名（白名单字符 + 长度；与 keyring 账户名净化规则一致）。
fn validate_secret_ref_name(name: &str) -> anyhow::Result<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return Err(anyhow::anyhow!("Invalid secret reference name length"));
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
    {
        return Err(anyhow::anyhow!("Invalid secret reference name charset"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_references_validated_before_lookup() {
        // 非法名称在触碰 keyring 前即被拒绝。
        assert!(validate_secret_ref_name("").is_err());
        assert!(validate_secret_ref_name("a/b").is_err());
        assert!(validate_secret_ref_name("a b").is_err());
        assert!(validate_secret_ref_name(&"k".repeat(65)).is_err());
        assert!(validate_secret_ref_name("api_key").is_ok());
        assert!(validate_secret_ref_name("Api.Key-1").is_ok());
    }

    #[test]
    fn resolve_without_references_is_passthrough() {
        assert_eq!(
            resolve_secret_references("Bearer sk-plain", "srv", "plugin").unwrap(),
            "Bearer sk-plain"
        );
    }

    #[test]
    fn resolve_rejects_unclosed_reference() {
        let err = resolve_secret_references("Bearer @secret(api_key", "srv", "plugin").unwrap_err();
        assert!(err.to_string().contains("missing ')'"));
    }

    #[test]
    fn resolve_rejects_missing_secret() {
        // keyring 在测试环境不可用（ensure_default_keyring_store 跳过初始化），
        // 读取必然失败：验证错误被归一化而不是 panic。
        let err =
            resolve_secret_references("Bearer @secret(api_key)", "srv", "plugin").unwrap_err();
        assert!(!err.to_string().is_empty());
    }

    #[test]
    fn external_permission_constant_is_stable() {
        // 该字符串是 manifest 权限与 Rust 校验的共享契约，不容漂移。
        assert_eq!(PERMISSION_NETWORK_EXTERNAL, "network:external");
    }

    #[test]
    fn cross_origin_requires_external_permission() {
        // 无权限 / 仅有同源 network 权限：拒绝跨源。
        assert!(!has_network_external_permission(&[]));
        assert!(!has_network_external_permission(&["network".to_string()]));
        assert!(!has_network_external_permission(&[
            "Network:External".to_string()
        ]));
        // 显式声明 network:external：放行。
        assert!(has_network_external_permission(&[
            "ui".to_string(),
            "network:external".to_string(),
        ]));
    }
}
