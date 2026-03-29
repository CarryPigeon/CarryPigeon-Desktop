//! network｜数据层：http_client。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::sync::Arc;

use anyhow::Context;
use tokio::net::TcpStream;

use crate::features::network::domain::ports::api_request_port::{
    ApiHttpRequest, ApiHttpRequestFuture, ApiHttpResponse, ApiHttpTlsPolicy, ApiRequestPort,
};
use crate::shared::net::tls_fingerprint::verify_der_sha256_fingerprint;

/// 基于 reqwest 的 API 请求适配器。
#[derive(Debug, Default)]
pub struct ReqwestApiRequestAdapter;

impl ReqwestApiRequestAdapter {
    /// 构造共享实例（无状态，便于 DI 注入）。
    pub fn shared() -> Arc<Self> {
        Arc::new(Self)
    }
}

impl ApiRequestPort for ReqwestApiRequestAdapter {
    fn execute_json_request<'a>(&'a self, request: ApiHttpRequest) -> ApiHttpRequestFuture<'a> {
        Box::pin(async move { execute_json_request_impl(request).await })
    }
}

fn extract_host_port_from_url(url: &str) -> anyhow::Result<(String, u16)> {
    let u = reqwest::Url::parse(url).context("Invalid request URL")?;
    let host = u.host_str().unwrap_or_default().to_string();
    if host.trim().is_empty() {
        return Err(anyhow::anyhow!("Invalid request host"));
    }
    let port = u
        .port_or_known_default()
        .ok_or_else(|| anyhow::anyhow!("Missing request port"))?;
    Ok((host, port))
}

async fn verify_https_fingerprint(url: &str, expected_sha256: &str) -> anyhow::Result<()> {
    let (host, port) = extract_host_port_from_url(url)?;
    let addr = format!("{}:{}", host, port);
    let stream = TcpStream::connect(addr.clone())
        .await
        .with_context(|| format!("Failed to connect for TLS fingerprint check: {}", addr))?;

    let mut builder = native_tls::TlsConnector::builder();
    // Fingerprint is trust root for this branch.
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
    verify_der_sha256_fingerprint(expected_sha256, &der)
}

fn build_reqwest_client(policy: ApiHttpTlsPolicy) -> anyhow::Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder();
    if policy != ApiHttpTlsPolicy::Strict {
        builder = builder
            .danger_accept_invalid_certs(true)
            .danger_accept_invalid_hostnames(true);
    }
    Ok(builder.build()?)
}

/// 执行 JSON HTTP 请求（含 TLS 策略处理）。
async fn execute_json_request_impl(args: ApiHttpRequest) -> anyhow::Result<ApiHttpResponse> {
    let ApiHttpRequest {
        method,
        url,
        headers,
        body,
        tls_policy,
        tls_fingerprint,
    } = args;

    if tls_policy == ApiHttpTlsPolicy::TrustFingerprint {
        let fp = tls_fingerprint.as_deref().unwrap_or("");
        verify_https_fingerprint(&url, fp).await?;
    }

    let client = build_reqwest_client(tls_policy)?;
    let mut req = client.request(method.parse()?, url);

    for (k, v) in headers {
        if k.trim().is_empty() {
            continue;
        }
        req = req.header(k, v);
    }

    if let Some(body) = body {
        req = req.json(&body);
    }

    let res = req.send().await.context("Failed to send request")?;
    let status = res.status().as_u16();
    let ok = res.status().is_success();

    if status == 204 {
        return Ok(ApiHttpResponse {
            ok,
            status,
            body: None,
        });
    }

    let bytes = res.bytes().await.context("Failed to read response body")?;
    if bytes.is_empty() {
        return Ok(ApiHttpResponse {
            ok,
            status,
            body: None,
        });
    }

    let json: serde_json::Value =
        serde_json::from_slice(&bytes).context("Failed to parse JSON response")?;
    Ok(ApiHttpResponse {
        ok,
        status,
        body: Some(json),
    })
}
