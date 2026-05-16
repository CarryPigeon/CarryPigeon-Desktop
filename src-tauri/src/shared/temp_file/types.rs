//! temp_file｜类型定义。

use serde::{Deserialize, Serialize};

/// 临时文件状态机。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TempFileState {
    Downloading,
    Complete,
    Failed,
    Expired,
}

/// SQLite 中存储的临时文件元数据行。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempFileRecord {
    pub id: String,
    pub namespace: String,
    pub file_path: String,
    pub url: Option<String>,
    pub mime_type: Option<String>,
    pub total_size: i64,
    pub downloaded: i64,
    pub state: String,
    pub created_at: i64,
    pub accessed_at: i64,
}

/// download_file 命令返回给前端的结果。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub file_id: String,
    pub file_path: String,
    pub mime_type: Option<String>,
    pub total_size: u64,
}

/// cleanup_temp_files 命令返回的清理摘要。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupResult {
    pub removed_files: u32,
    pub freed_bytes: u64,
}
