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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_trims_and_lowercases() {
        assert_eq!(normalize_sha256_fingerprint("  A1B2C3  "), "a1b2c3");
    }

    #[test]
    fn normalize_filters_non_hex() {
        assert_eq!(
            normalize_sha256_fingerprint("AA:BB:CC:DD:EE:FF"),
            "aabbccddeeff"
        );
    }

    #[test]
    fn normalize_filters_colons_and_spaces() {
        assert_eq!(
            normalize_sha256_fingerprint(
                "A1:B2:C3:D4 E5:F6:G7:H8 I9:J0:K1:L2 M3:N4:O5:P6 Q7:R8:S9:T0 U1:V2:W3:X4 Y5:Z6"
            ),
            "a1b2c3d4e5f678901234567890123456"
        );
    }

    #[test]
    fn verify_matching_cert() {
        let cert_der = b"test certificate data for hashing";
        let expected = sha256_hex(cert_der);
        assert!(verify_der_sha256_fingerprint(&expected, cert_der).is_ok());
    }

    #[test]
    fn verify_mismatched_cert() {
        let expected = "a".repeat(64);
        let cert_der = b"different certificate data";
        let err = verify_der_sha256_fingerprint(&expected, cert_der).unwrap_err();
        assert!(err.to_string().contains("fingerprint mismatch"));
    }

    #[test]
    fn verify_invalid_length_rejected() {
        let expected = "abc";
        let cert_der = b"some data";
        let err = verify_der_sha256_fingerprint(expected, cert_der).unwrap_err();
        assert!(err.to_string().contains("Invalid TLS fingerprint"));
    }

    #[test]
    fn verify_empty_cert() {
        let cert_der: &[u8] = &[];
        let expected = sha256_hex(cert_der);
        assert!(verify_der_sha256_fingerprint(&expected, cert_der).is_ok());
    }
}
