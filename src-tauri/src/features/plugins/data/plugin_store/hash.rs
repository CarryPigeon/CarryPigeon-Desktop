//! plugin_store｜哈希与校验工具。
//!
//! 说明：
//! - 目前只用到 sha256（十六进制字符串）；
//! - 该模块保持“纯函数”，不做 IO，便于在下载/指纹校验/内容校验等场景复用。

use sha2::Digest;

/// 计算输入字节的 SHA-256 十六进制（小写）字符串。
pub(super) fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = sha2::Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

/// 判断两个 SHA-256 十六进制字符串是否相等（忽略大小写/首尾空白）。
pub(super) fn eq_hash_hex(a: &str, b: &str) -> bool {
    a.trim().eq_ignore_ascii_case(b.trim())
}
