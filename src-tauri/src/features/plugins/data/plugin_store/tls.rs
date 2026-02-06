//! plugin_store｜TLS 策略与指纹校验。
//!
//! 说明：
//! - 该文件只负责“按策略构建 reqwest client +（可选）HTTPS 指纹校验”；
//! - 指纹校验用于 `tls-fp://` 场景：允许无效证书/域名，但必须匹配指定证书 SHA-256 指纹。

use anyhow::Context;
use tokio::net::TcpStream;

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
    // 说明：指纹是信任根，因此此处必须允许无效证书/域名。
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
        return Err(anyhow::anyhow!(
            "TLS fingerprint check failed: missing peer certificate"
        ));
    };
    let der = cert
        .to_der()
        .map_err(|e| anyhow::anyhow!("Failed to export peer certificate DER: {}", e))?;
    let actual = super::hash::sha256_hex(&der);
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

/// 为 server API 请求构建 reqwest client（包含可选 TLS 策略与指纹校验）。
///
/// 说明：
/// - 只有 `https://` 需要特殊处理；`http://` 直接使用默认 client。
pub(super) async fn build_server_client(
    origin: &str,
    tls_policy: Option<&str>,
    tls_fingerprint: Option<&str>,
) -> anyhow::Result<reqwest::Client> {
    if !origin.trim().starts_with("https://") {
        return Ok(reqwest::Client::new());
    }
    let policy = parse_tls_policy(tls_policy);
    if policy == TlsPolicy::TrustFingerprint {
        verify_https_fingerprint(origin, tls_fingerprint.unwrap_or("")).await?;
    }
    build_reqwest_client(policy)
}
