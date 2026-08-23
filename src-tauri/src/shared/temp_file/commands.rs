//! temp_file｜Tauri 命令

use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::shared::error::{CommandResult, command_error, to_command_error};

use super::manager::TempFileManager;
use super::types::CleanupResult;

/// 清理过期临时文件。
#[tauri::command]
pub async fn cleanup_temp_files(
    temp_files: State<'_, TempFileManager>,
    namespace: Option<String>,
    older_than_hours: Option<u64>,
) -> CommandResult<CleanupResult> {
    temp_files
        .cleanup(namespace.as_deref(), older_than_hours.unwrap_or(24))
        .await
        .map_err(|e| {
            to_command_error(
                "TEMP_FILE_CLEANUP_FAILED",
                "error.temp_file_cleanup_failed",
                e,
            )
        })
}

/// 删除单个临时文件。
#[tauri::command]
pub async fn remove_temp_file(
    temp_files: State<'_, TempFileManager>,
    file_id: String,
) -> CommandResult<()> {
    temp_files.remove(&file_id).await.map_err(|e| {
        to_command_error(
            "TEMP_FILE_REMOVE_FAILED",
            "error.temp_file_remove_failed",
            e,
        )
    })
}

/// 将已完成文件复制到用户指定位置。
#[tauri::command]
pub async fn save_temp_file(
    temp_files: State<'_, TempFileManager>,
    file_id: String,
    destination: String,
) -> CommandResult<String> {
    temp_files
        .save_to(&file_id, &destination)
        .await
        .map_err(|e| to_command_error("TEMP_FILE_MOVE_FAILED", "error.temp_file_move_failed", e))
}

/// 用系统默认程序打开临时文件。
#[tauri::command]
pub async fn open_temp_file(
    app: AppHandle,
    temp_files: State<'_, TempFileManager>,
    file_id: String,
) -> CommandResult<()> {
    let meta = temp_files
        .get_metadata(&file_id)
        .await
        .map_err(|e| to_command_error("TEMP_FILE_NOT_FOUND", "error.temp_file_not_found", e))?;
    let file_path = &meta.file_path;
    if !std::path::Path::new(file_path).exists() {
        return Err(command_error(
            "TEMP_FILE_NOT_FOUND",
            "error.temp_file_not_found",
        ));
    }

    // 安全约束：canonicalize 后必须仍位于 base_dir 内，
    // 防止历史/被篡改的 DB 记录把 base_dir 外的任意文件交给系统程序打开。
    let canonical_base = std::fs::canonicalize(temp_files.base_dir())
        .map_err(|e| to_command_error("TEMP_FILE_OPEN_FAILED", "error.temp_file_open_failed", e))?;
    if !std::fs::canonicalize(file_path)
        .map(|p| p.starts_with(&canonical_base))
        .unwrap_or(false)
    {
        return Err(command_error(
            "TEMP_FILE_PATH_OUTSIDE_BASE",
            "error.temp_file_path_outside_base",
        ));
    }

    // Use the already-registered tauri_plugin_opener
    app.opener()
        .open_path(file_path, None::<&str>)
        .map_err(|e| to_command_error("TEMP_FILE_OPEN_FAILED", "error.temp_file_open_failed", e))?;
    Ok(())
}
