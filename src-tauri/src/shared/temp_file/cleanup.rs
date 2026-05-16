//! temp_file｜清理：过期临时文件扫描与删除。

use std::time::{SystemTime, UNIX_EPOCH};

use sea_orm::Value;

use super::manager::TempFileManager;
use super::types::CleanupResult;

impl TempFileManager {
    /// 清理过期临时文件。
    ///
    /// # 参数
    /// - `namespace`：命名空间过滤（`None` = 全部）。
    /// - `older_than_hours`：超过此小时数的文件视为过期（默认 24）。
    ///
    /// # 返回值
    /// `CleanupResult`：清理统计。
    pub async fn cleanup(
        &self,
        namespace: Option<&str>,
        older_than_hours: u64,
    ) -> anyhow::Result<CleanupResult> {
        let cutoff = match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(d) => d.as_secs() as i64,
            Err(e) => {
                tracing::warn!(action = "db_temp_file_cleanup_clock_skew", error = %e);
                0
            }
        } - (older_than_hours as i64 * 3600);

        let (sql, params) = if let Some(ns) = namespace {
            (
                "SELECT id, namespace, file_path, url, mime_type, total_size, downloaded, state, created_at, accessed_at \
                 FROM temp_files WHERE namespace=$1 AND accessed_at<$2 AND state IN ('downloading','failed','expired')",
                vec![
                    Value::String(Some(ns.to_string())),
                    Value::BigInt(Some(cutoff)),
                ],
            )
        } else {
            (
                "SELECT id, namespace, file_path, url, mime_type, total_size, downloaded, state, created_at, accessed_at \
                 FROM temp_files WHERE accessed_at<$1 AND state IN ('downloading','failed','expired')",
                vec![Value::BigInt(Some(cutoff))],
            )
        };

        let records = self.query_records(sql, params).await?;
        let mut removed = 0u32;
        let mut freed = 0u64;

        for rec in records {
            // 删除文件
            let path = std::path::Path::new(&rec.file_path);
            if path.exists() {
                if let Ok(meta) = tokio::fs::metadata(path).await {
                    freed += meta.len();
                }
                let _ = tokio::fs::remove_file(path).await;
            }
            // 删除 .part 文件（如果 file_path 指向最终文件，.part 可能已不存在）
            let part_path = self
                .base_dir()
                .join("downloads")
                .join(format!("{}.part", rec.id));
            if part_path.exists() {
                if let Ok(meta) = tokio::fs::metadata(&part_path).await {
                    freed += meta.len();
                }
                let _ = tokio::fs::remove_file(part_path).await;
            }
            // 删除记录
            let _ = self.delete_record(&rec.id).await;
            removed += 1;
        }

        tracing::info!(
            action = "db_temp_file_cleanup_completed",
            removed,
            freed_bytes = freed,
            namespace = ?namespace,
            older_than_hours,
        );

        Ok(CleanupResult {
            removed_files: removed,
            freed_bytes: freed,
        })
    }
}
