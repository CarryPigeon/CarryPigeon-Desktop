//! shared｜TLS 指纹工具。
//!
//! 约定：注释中文，日志英文（tracing）。

use sha2::Digest;

/// 标准化 SHA-256 指纹字符串：去空白、转小写、仅保留 hex 字符。
pub fn normalize_sha256_fingerprint(raw: &str) -> String {
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

/// 校验证书 DER 的 SHA-256 指纹。
pub fn verify_der_sha256_fingerprint(expected_sha256: &str, cert_der: &[u8]) -> anyhow::Result<()> {
    let expected = normalize_sha256_fingerprint(expected_sha256);
    if expected.len() != 64 {
        return Err(anyhow::anyhow!(
            "Invalid TLS fingerprint: expected SHA-256 (64 hex chars), got len={}",
            expected.len()
        ));
    }

    let actual = sha256_hex(cert_der);
    if actual != expected {
        return Err(anyhow::anyhow!(
            "TLS fingerprint mismatch: expected={} actual={}",
            expected,
            actual
        ));
    }
    Ok(())
}
