//! network｜用例层：api_usecases。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::collections::BTreeMap;

use anyhow::Context;
use sha2::Digest;
use tokio::net::TcpStream;

use crate::features::network::di::commands::{ApiRequestJsonArgs, ApiRequestJsonResult};
use crate::shared::net::origin::to_http_origin;

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

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = sha2::Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
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
        return Err(anyhow::anyhow!(
            "TLS fingerprint check failed: missing peer certificate"
        ));
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

/// 执行 `/api/*` JSON 请求（Rust -> server），并返回结构化结果供前端使用。
///
/// # 参数
/// - `args`：请求参数（server_socket/method/path/headers/body/tls_*）。
///
/// # 返回值
/// - `Ok(ApiRequestJsonResult)`：请求结果（ok/status/body/error）。
/// - `Err(anyhow::Error)`：请求失败原因（参数校验/TLS 校验/网络错误等）。
///
/// # 说明
/// - 仅允许请求 `/api/*` 路径，并做基础的 `..` 防穿越校验；
/// - 当 TLS 策略为指纹信任时，会在请求前先校验证书指纹；
/// - 204 No Content 会返回空 body/error。
pub async fn api_request_json(args: ApiRequestJsonArgs) -> anyhow::Result<ApiRequestJsonResult> {
    let socket = args.server_socket.trim().to_string();
    if socket.is_empty() {
        return Err(anyhow::anyhow!("Missing server_socket"));
    }

    let method = args.method.trim().to_uppercase();
    if method.is_empty() {
        return Err(anyhow::anyhow!("Missing method"));
    }

    let path = args.path.trim().to_string();
    if !path.starts_with("/api/") {
        return Err(anyhow::anyhow!("Invalid path: must start with /api/"));
    }
    if path.contains("..") {
        return Err(anyhow::anyhow!("Invalid path: contains '..'"));
    }

    let origin = to_http_origin(&socket)?;
    let url = format!("{}{}", origin, path);

    let tls_policy = parse_tls_policy(args.tls_policy.as_deref());
    if tls_policy == TlsPolicy::TrustFingerprint {
        let fp = args.tls_fingerprint.as_deref().unwrap_or("");
        verify_https_fingerprint(&origin, fp).await?;
    }

    let client = build_reqwest_client(tls_policy)?;
    let mut req = client.request(method.parse()?, url);

    let headers: BTreeMap<String, String> = args.headers.unwrap_or_default();
    for (k, v) in headers {
        if k.trim().is_empty() {
            continue;
        }
        req = req.header(k, v);
    }

    if let Some(body) = args.body {
        req = req.json(&body);
    }

    let res = req.send().await.context("Failed to send request")?;
    let status = res.status().as_u16();
    let ok = res.status().is_success();

    if status == 204 {
        return Ok(ApiRequestJsonResult {
            ok,
            status,
            body: None,
            error: None,
        });
    }

    let bytes = res.bytes().await.context("Failed to read response body")?;
    if bytes.is_empty() {
        return Ok(ApiRequestJsonResult {
            ok,
            status,
            body: None,
            error: None,
        });
    }

    let json: serde_json::Value =
        serde_json::from_slice(&bytes).context("Failed to parse JSON response")?;
    if ok {
        Ok(ApiRequestJsonResult {
            ok: true,
            status,
            body: Some(json),
            error: None,
        })
    } else {
        Ok(ApiRequestJsonResult {
            ok: false,
            status,
            body: None,
            error: Some(json),
        })
    }
}
