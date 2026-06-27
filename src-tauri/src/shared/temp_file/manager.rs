//! temp_file｜数据层：TempFileManager 核心生命周期管理。

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Context;
use sea_orm::{ConnectionTrait, DatabaseBackend, QueryResult, Statement, StatementBuilder, Value};
use tokio::io::AsyncSeekExt;
use tracing::warn;

use crate::shared::db::{CPDatabase, sqlite_url_for_path};

use super::types::*;

/// StatementBuilder 包装：将原始 SQL + 值列表包装为 sea-orm 可执行的语句。
struct RawStmt {
    sql: String,
    values: Vec<Value>,
}

impl RawStmt {
    fn raw(sql: &str) -> Self {
        Self {
            sql: sql.to_string(),
            values: vec![],
        }
    }
    fn with_values(sql: &str, values: Vec<Value>) -> Self {
        Self {
            sql: sql.to_string(),
            values,
        }
    }
}

impl StatementBuilder for RawStmt {
    fn build(&self, db_backend: &DatabaseBackend) -> Statement {
        Statement::from_sql_and_values(*db_backend, self.sql.clone(), self.values.clone())
    }
}

/// 临时文件管理器：管理临时文件的下载写入、元数据追踪与清理。
pub struct TempFileManager {
    base_dir: PathBuf,
    db: sea_orm::DatabaseConnection,
}

impl TempFileManager {
    /// 创建 TempFileManager。
    ///
    /// # 参数
    /// - `app_data_dir`：应用数据根目录（`app.path().app_data_dir()`）。
    /// - `metadata_db_path`：SQLite 元数据文件路径。
    ///
    /// # 初始化
    /// 自动创建 `{app_data_dir}/temp_files/downloads/` 目录与元数据表。
    pub async fn new(app_data_dir: PathBuf, metadata_db_path: PathBuf) -> anyhow::Result<Self> {
        let base_dir = app_data_dir.join("temp_files");
        tokio::fs::create_dir_all(base_dir.join("downloads")).await?;

        let db = CPDatabase::new(&sqlite_url_for_path(&metadata_db_path))
            .await
            .context("Failed to create temp_file metadata database")?;

        // 创建表
        let sql = "\
            CREATE TABLE IF NOT EXISTS temp_files (\
                id TEXT PRIMARY KEY,\
                namespace TEXT NOT NULL,\
                file_path TEXT NOT NULL,\
                url TEXT,\
                mime_type TEXT,\
                total_size INTEGER NOT NULL DEFAULT 0,\
                downloaded INTEGER NOT NULL DEFAULT 0,\
                state TEXT NOT NULL DEFAULT 'downloading',\
                created_at INTEGER NOT NULL,\
                accessed_at INTEGER NOT NULL\
            )";
        db.connection
            .execute(&RawStmt::raw(sql))
            .await
            .context("Failed to create temp_files table")?;

        // 创建索引
        for (name, sql) in &[
            (
                "idx_temp_files_state",
                "CREATE INDEX IF NOT EXISTS idx_temp_files_state ON temp_files(state)",
            ),
            (
                "idx_temp_files_namespace",
                "CREATE INDEX IF NOT EXISTS idx_temp_files_namespace ON temp_files(namespace)",
            ),
        ] {
            db.connection
                .execute(&RawStmt::raw(sql))
                .await
                .with_context(|| format!("Failed to create temp_file index: {name}"))?;
        }

        Ok(Self {
            base_dir,
            db: db.connection,
        })
    }

    fn downloads_dir(&self) -> PathBuf {
        self.base_dir.join("downloads")
    }

    fn part_path(&self, id: &str) -> PathBuf {
        self.downloads_dir().join(format!("{id}.part"))
    }

    fn final_path(&self, id: &str, ext: &str) -> PathBuf {
        self.downloads_dir().join(format!("{id}.{ext}"))
    }

    fn now() -> i64 {
        match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(d) => d.as_secs() as i64,
            Err(e) => {
                tracing::warn!(action = "db_temp_file_clock_skew", error = %e);
                0
            }
        }
    }

    /// 注册一个新的下载任务，创建 .part 文件并写入 SQLite 记录。
    ///
    /// 若已存在同名任务（按 `id`）的 .part 文件，则**追加**写入而非截断，
    /// 返回文件句柄与已存在的字节数，供调用方判断是否可断点续传。
    pub async fn create_download(
        &self,
        id: &str,
        url: &str,
        mime_type: Option<&str>,
        total_size: u64,
    ) -> anyhow::Result<(tokio::fs::File, u64)> {
        let now = Self::now();
        let part = self.part_path(id);

        let sql = "INSERT INTO temp_files (id, namespace, file_path, url, mime_type, total_size, downloaded, state, created_at, accessed_at) VALUES ($1, 'downloads', $2, $3, $4, $5, 0, 'downloading', $6, $6) ON CONFLICT(id) DO UPDATE SET state='downloading', accessed_at=$6";
        self.db
            .execute(&RawStmt::with_values(
                sql,
                vec![
                    Value::String(Some(id.to_string())),
                    Value::String(Some(part.to_string_lossy().to_string())),
                    Value::String(Some(url.to_string())),
                    Value::String(mime_type.map(|m| m.to_string())),
                    Value::BigInt(Some(total_size as i64)),
                    Value::BigInt(Some(now)),
                ],
            ))
            .await
            .context("Failed to insert temp_file metadata")?;

        // 使用追加模式打开现有 .part 文件，保留已下载字节以支持断点续传。
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .append(true)
            .open(&part)
            .await
            .with_context(|| format!("Failed to open temp file: {}", part.display()))?;
        let existing = file
            .metadata()
            .await
            .map(|m| m.len())
            .with_context(|| format!("Failed to stat temp file: {}", part.display()))?;
        if existing > 0 {
            // seek 到文件末尾，避免 reopen 后位置不确定。
            let _ = file.seek(std::io::SeekFrom::End(0)).await;
        }
        Ok((file, existing))
    }

    /// 更新下载进度（更新 SQLite 中的 downloaded 字段）。
    pub async fn update_progress(&self, id: &str, downloaded: u64) -> anyhow::Result<()> {
        let now = Self::now();
        let sql = "UPDATE temp_files SET downloaded=$1, accessed_at=$2 WHERE id=$3";
        self.db
            .execute(&RawStmt::with_values(
                sql,
                vec![
                    Value::BigInt(Some(downloaded as i64)),
                    Value::BigInt(Some(now)),
                    Value::String(Some(id.to_string())),
                ],
            ))
            .await?;
        Ok(())
    }

    /// 标记下载完成：原子重命名 .part → 最终文件，更新 SQLite state=Complete。
    pub async fn mark_complete(&self, id: &str, ext: &str) -> anyhow::Result<String> {
        let part = self.part_path(id);
        let final_path = self.final_path(id, ext);

        tokio::fs::rename(&part, &final_path)
            .await
            .with_context(|| {
                format!(
                    "Failed to rename {} -> {}",
                    part.display(),
                    final_path.display()
                )
            })?;

        let now = Self::now();
        let sql =
            "UPDATE temp_files SET file_path=$1, state='complete', accessed_at=$2 WHERE id=$3";
        self.db
            .execute(&RawStmt::with_values(
                sql,
                vec![
                    Value::String(Some(final_path.to_string_lossy().to_string())),
                    Value::BigInt(Some(now)),
                    Value::String(Some(id.to_string())),
                ],
            ))
            .await?;

        Ok(final_path.to_string_lossy().to_string())
    }

    /// 标记下载失败（保留 .part 供清理）。
    pub async fn mark_failed(&self, id: &str) -> anyhow::Result<()> {
        let now = Self::now();
        let sql = "UPDATE temp_files SET state='failed', accessed_at=$1 WHERE id=$2";
        self.db
            .execute(&RawStmt::with_values(
                sql,
                vec![
                    Value::BigInt(Some(now)),
                    Value::String(Some(id.to_string())),
                ],
            ))
            .await?;
        Ok(())
    }

    fn row_to_record(row: &QueryResult) -> anyhow::Result<TempFileRecord> {
        Ok(TempFileRecord {
            id: row.try_get_by_index::<String>(0)?,
            namespace: row.try_get_by_index::<String>(1)?,
            file_path: row.try_get_by_index::<String>(2)?,
            url: row.try_get_by_index::<Option<String>>(3)?,
            mime_type: row.try_get_by_index::<Option<String>>(4)?,
            total_size: row.try_get_by_index::<i64>(5)?,
            downloaded: row.try_get_by_index::<i64>(6)?,
            state: row.try_get_by_index::<String>(7)?,
            created_at: row.try_get_by_index::<i64>(8)?,
            accessed_at: row.try_get_by_index::<i64>(9)?,
        })
    }

    /// 获取单个元数据记录。
    pub async fn get_metadata(&self, id: &str) -> anyhow::Result<TempFileRecord> {
        let sql = "SELECT id, namespace, file_path, url, mime_type, total_size, downloaded, state, created_at, accessed_at FROM temp_files WHERE id=$1";
        let rows = self
            .db
            .query_all(&RawStmt::with_values(
                sql,
                vec![Value::String(Some(id.to_string()))],
            ))
            .await
            .context("Failed to query temp_file metadata")?;

        let row = rows
            .first()
            .ok_or_else(|| anyhow::anyhow!("Temp file not found: {id}"))?;

        Self::row_to_record(row)
    }

    /// 删除单个临时文件（删除文件 + 移除 SQLite 记录）。
    pub async fn remove(&self, id: &str) -> anyhow::Result<()> {
        let sql_get = "SELECT file_path FROM temp_files WHERE id=$1";
        let rows = self
            .db
            .query_all(&RawStmt::with_values(
                sql_get,
                vec![Value::String(Some(id.to_string()))],
            ))
            .await?;
        if let Some(row) = rows.first() {
            let path: String = row.try_get_by_index(0)?;
            if let Err(e) = tokio::fs::remove_file(&path).await {
                warn!(action = "db_temp_file_remove_file_failed", path = %path, error = %e);
            }
        }

        let sql_del = "DELETE FROM temp_files WHERE id=$1";
        self.db
            .execute(&RawStmt::with_values(
                sql_del,
                vec![Value::String(Some(id.to_string()))],
            ))
            .await?;
        Ok(())
    }

    /// 复制（或移动）已完成文件到目标路径。
    ///
    /// 目标路径必须在 base_dir 范围内，防止路径穿越攻击。
    pub async fn save_to(&self, id: &str, destination: &str) -> anyhow::Result<String> {
        let meta = self.get_metadata(id).await?;
        if meta.state != "complete" {
            anyhow::bail!(
                "Temp file '{}' is not in 'complete' state (state={})",
                id,
                meta.state
            );
        }
        let dest = Path::new(destination);
        let dest_parent = if dest.is_relative() && dest.parent().is_none() {
            self.base_dir.clone()
        } else {
            dest.parent().unwrap_or(Path::new(".")).to_path_buf()
        };
        let canonical_parent = dest_parent.canonicalize().with_context(|| {
            format!(
                "Failed to resolve destination parent: {}",
                dest_parent.display()
            )
        })?;
        let canonical_base = self
            .base_dir
            .canonicalize()
            .context("Failed to resolve base directory")?;
        if !canonical_parent.starts_with(&canonical_base) {
            anyhow::bail!(
                "Destination path escapes allowed directory: {}",
                dest.display()
            );
        }
        tokio::fs::copy(&meta.file_path, dest)
            .await
            .with_context(|| format!("Failed to copy {} to {}", meta.file_path, destination))?;
        Ok(dest.to_string_lossy().to_string())
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// 内部方法：查询匹配条件的记录，供 cleanup 使用。
    pub async fn query_records(
        &self,
        sql: &str,
        params: Vec<Value>,
    ) -> anyhow::Result<Vec<TempFileRecord>> {
        let rows = self
            .db
            .query_all(&RawStmt::with_values(sql, params))
            .await?;
        let mut records = Vec::with_capacity(rows.len());
        for row in &rows {
            records.push(Self::row_to_record(row)?);
        }
        Ok(records)
    }

    /// 内部方法：删除记录（不删除文件）。
    pub async fn delete_record(&self, id: &str) -> anyhow::Result<()> {
        let sql = "DELETE FROM temp_files WHERE id=$1";
        self.db
            .execute(&RawStmt::with_values(
                sql,
                vec![Value::String(Some(id.to_string()))],
            ))
            .await?;
        Ok(())
    }

    /// 获取 DB 连接引用（供 cleanup 等方法使用）。
    pub fn connection(&self) -> &sea_orm::DatabaseConnection {
        &self.db
    }

    /// 按 URL 查找未完成的下载任务（state=downloading 或 state=failed），返回 `(task_id, downloaded)`。
    ///
    /// 仅匹配 `namespace='downloads'` 且 `url` 完全相同的最新记录；
    /// 若有多条，仅返回 `accessed_at` 最大的。
    pub async fn lookup_incomplete_by_url(
        &self,
        url: &str,
    ) -> anyhow::Result<Option<(String, u64)>> {
        let sql = "SELECT id, downloaded FROM temp_files \
                   WHERE namespace='downloads' AND url=$1 AND state IN ('downloading','failed') \
                   ORDER BY accessed_at DESC LIMIT 1";
        let rows = self
            .db
            .query_all(&RawStmt::with_values(
                sql,
                vec![Value::String(Some(url.to_string()))],
            ))
            .await
            .context("Failed to query incomplete download")?;
        if let Some(row) = rows.first() {
            let id: String = row.try_get_by_index(0)?;
            let downloaded: i64 = row.try_get_by_index(1)?;
            return Ok(Some((id, downloaded.max(0) as u64)));
        }
        Ok(None)
    }

    /// 启动时清理未完成下载：删除 state=downloading/failed 的 .part 文件与元数据记录。
    /// 重启后默认不续传。
    pub async fn prune_incomplete_downloads(&self) -> anyhow::Result<usize> {
        let sql = "SELECT id, file_path FROM temp_files \
                   WHERE namespace='downloads' AND state IN ('downloading','failed')";
        let rows = self
            .db
            .query_all(&RawStmt::raw(sql))
            .await
            .context("Failed to query incomplete downloads for prune")?;
        let mut count = 0usize;
        for row in &rows {
            let id: String = match row.try_get_by_index(0) {
                Ok(v) => v,
                Err(e) => {
                    warn!(action = "db_temp_file_prune_id_read_failed", error = %e);
                    continue;
                }
            };
            let path: String = match row.try_get_by_index(1) {
                Ok(v) => v,
                Err(e) => {
                    warn!(action = "db_temp_file_prune_path_read_failed", error = %e);
                    continue;
                }
            };
            if let Err(e) = tokio::fs::remove_file(&path).await {
                // .part 文件可能已被外部清理，记录但不阻断
                tracing::debug!(
                    action = "db_temp_file_prune_remove_part_failed",
                    path = %path,
                    error = %e
                );
            }
            let del_sql = "DELETE FROM temp_files WHERE id=$1";
            if let Err(e) = self
                .db
                .execute(&RawStmt::with_values(
                    del_sql,
                    vec![Value::String(Some(id.clone()))],
                ))
                .await
            {
                warn!(action = "db_temp_file_prune_delete_record_failed", id = %id, error = %e);
                continue;
            }
            count += 1;
        }
        if count > 0 {
            tracing::info!(
                action = "db_temp_file_prune_incomplete_downloads",
                removed = count
            );
        }
        Ok(count)
    }
}
