//! HTTP 下载工具（头像下载等）。
//!
//! 约定：
//! - 注释统一使用中文，便于团队维护与交接。
//! - 日志输出统一使用英文，便于跨端检索与与上游/第三方日志对齐。

use reqwest::Client;
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::io::AsyncWriteExt;
use tracing::{debug, info};

/// 下载进度回调函数类型定义。
///
/// # 参数
/// - `downloaded`: 当前已下载字节数。
/// - `total`: 总字节数（未知时为 0）。
type ProgressCallback = dyn Fn(u64, u64) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
    + Send
    + Sync
    + 'static;

/// 下载配置结构体。
#[derive(Default)]
pub struct DownloadConfig {
    /// 超时时间（秒）
    pub timeout: Option<u64>,
    /// 预期的文件SHA256哈希值，用于验证完整性
    pub expected_hash: Option<String>,
    /// 下载进度回调函数
    pub progress_callback: Option<Box<ProgressCallback>>,
}

/// 手动实现 Debug：跳过 `progress_callback` 字段，避免输出闭包地址/内容造成噪音。
impl std::fmt::Debug for DownloadConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DownloadConfig")
            .field("timeout", &self.timeout)
            .field("expected_hash", &self.expected_hash)
            .field("progress_callback", &"<callback>")
            .finish()
    }
}

/// 异步文件下载函数
///
/// # 参数
/// - `url`: 要下载的文件URL
/// - `output_path`: 保存文件的路径
/// - `config`: 下载配置，包含超时、哈希验证和进度回调
///
/// # 返回值
/// - `Ok(())`: 下载成功且文件完整
/// - `Err(anyhow::Error)`: 下载过程中发生错误
pub async fn download_avatar_impl(
    url: &str,
    output_path: impl AsRef<Path>,
    config: Option<DownloadConfig>,
) -> anyhow::Result<()> {
    let config = config.unwrap_or_default();

    // 创建reqwest客户端
    let client = match config.timeout {
        Some(timeout) => Client::builder()
            .timeout(std::time::Duration::from_secs(timeout))
            .build()?,
        None => Client::new(),
    };

    // 发送HEAD请求获取文件大小（可选）
    let content_length = match client.head(url).send().await {
        Ok(resp) => resp
            .headers()
            .get(reqwest::header::CONTENT_LENGTH)
            .and_then(|val| val.to_str().ok())
            .and_then(|val| val.parse::<u64>().ok()),
        Err(_) => None,
    };

    // 发送GET请求
    info!("Starting download: url={}", url);
    let mut response = client.get(url).send().await?;

    // 创建输出文件
    let output_path = output_path.as_ref();
    // 确保目录存在
    if let Some(parent) = output_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let mut file = tokio::fs::File::create(output_path).await?;

    // 初始化进度跟踪
    let mut downloaded: u64 = 0;
    let total = content_length.unwrap_or(0);

    // 创建哈希计算器
    let mut hasher = Sha256::new();

    // 读取并写入文件，同时计算哈希和进度
    while let Some(chunk) = response.chunk().await? {
        // 写入文件
        file.write_all(&chunk).await?;

        // 更新哈希
        hasher.update(&chunk);

        // 更新下载进度
        downloaded += chunk.len() as u64;

        // 调用进度回调
        if let Some(callback) = &config.progress_callback {
            callback(downloaded, total).await;
        }
    }

    // 完成文件写入
    file.flush().await?;

    // 计算最终哈希
    let hash = format!("{:x}", hasher.finalize());
    info!(
        "Download completed: path={}, bytes={}, sha256={}",
        output_path.display(),
        downloaded,
        hash,
    );

    // 验证文件完整性
    if let Some(expected) = &config.expected_hash {
        if hash != *expected {
            // 如果哈希不匹配，删除文件并返回错误
            tokio::fs::remove_file(output_path).await?;
            return Err(anyhow::anyhow!(
                "File integrity check failed: expected_sha256={}, actual_sha256={}",
                expected,
                hash
            ));
        }
        info!(
            "File integrity check passed: path={}",
            output_path.display()
        );
    }

    Ok(())
}

/// 下载头像的包装函数。
pub async fn download_avatar(avatar_id: &str, url: &str) -> anyhow::Result<()> {
    let output_path = format!("./avatar/{}.jpg", avatar_id);

    // 可以添加进度回调来显示下载进度
    let config = DownloadConfig {
        timeout: Some(30),   // 30秒超时
        expected_hash: None, // 暂时不验证哈希
        progress_callback: Some(Box::new(|downloaded, total| {
            Box::pin(async move {
                if total > 0 {
                    let progress = (downloaded as f64 / total as f64) * 100.0;
                    debug!(
                        "Avatar download progress: {:.2}% ({}/{})",
                        progress, downloaded, total
                    );
                } else {
                    debug!("Avatar download progress: bytes={}", downloaded);
                }
            })
        })),
    };

    download_avatar_impl(url, output_path, Some(config)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::test;

    #[test]
    #[ignore = "requires external network (httpbin.org)"]
    async fn test_download_file() {
        // 使用一个可靠的测试文件URL
        let url = "https://httpbin.org/image/jpeg";
        let output_path = "./test_download.jpg";

        // 测试基本下载功能
        let result = download_avatar_impl(url, output_path, None).await;
        assert!(result.is_ok(), "download failed: {:?}", result);

        // 测试带超时配置的下载
        let config = Some(DownloadConfig {
            timeout: Some(10),
            expected_hash: None,
            progress_callback: None,
        });
        let result = download_avatar_impl(url, output_path, config).await;
        assert!(
            result.is_ok(),
            "download (with timeout) failed: {:?}",
            result
        );

        // 测试带进度回调的下载
        let config = Some(DownloadConfig {
            timeout: Some(10),
            expected_hash: None,
            progress_callback: Some(Box::new(|downloaded, total| {
                Box::pin(async move {
                    tracing::debug!(
                        action = "download_progress",
                        downloaded,
                        total,
                        "Download progress"
                    );
                })
            })),
        });
        let result = download_avatar_impl(url, output_path, config).await;
        assert!(
            result.is_ok(),
            "download (with progress callback) failed: {:?}",
            result
        );

        // 清理测试文件
        if let Err(e) = tokio::fs::remove_file(output_path).await {
            tracing::warn!(action = "cleanup_test_file_failed", error = %e);
        }
    }

    #[test]
    #[ignore = "requires external network (httpbin.org)"]
    async fn test_download_avatar() {
        // 使用一个可靠的测试头像URL
        let url = "https://httpbin.org/image/jpeg";
        let avatar_id = "test_avatar";

        // 测试头像下载功能
        let result = download_avatar(avatar_id, url).await;
        assert!(result.is_ok(), "avatar download failed: {:?}", result);

        // 清理测试文件
        let output_path = format!("./avatar/{}.jpg", avatar_id);
        if let Err(e) = tokio::fs::remove_file(output_path).await {
            tracing::warn!(action = "cleanup_test_avatar_file_failed", error = %e);
        }
    }
}
