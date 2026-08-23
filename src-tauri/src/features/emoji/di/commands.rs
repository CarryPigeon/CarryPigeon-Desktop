//! emoji｜Tauri 命令实现。

use tauri::AppHandle;

use crate::features::emoji::domain::types::EmojiEntry;
use crate::features::emoji::repository;
use crate::shared::error::{CommandResult, command_error, to_command_error};

#[tauri::command]
pub async fn list_custom_emojis(
    app_handle: AppHandle,
    uid: String,
) -> CommandResult<Vec<EmojiEntry>> {
    let index = repository::load_index(&app_handle);
    let uid_trimmed = uid.trim();
    let items: Vec<EmojiEntry> = index
        .items
        .into_iter()
        .filter(|e| e.owner_uid == uid_trimmed)
        .collect();
    Ok(items)
}

#[tauri::command]
pub async fn save_emoji(
    app_handle: AppHandle,
    source_path: String,
    name: String,
    tags: Vec<String>,
    uid: String,
) -> CommandResult<EmojiEntry> {
    let id = uuid::Uuid::new_v4().to_string();
    let entry = repository::add_emoji(
        &app_handle,
        &id,
        &name,
        std::path::Path::new(&source_path),
        &tags,
        &uid,
    )
    .map_err(|e| to_command_error("EMOJI_SAVE_FAILED", "error.emoji_save_failed", e))?;
    tracing::info!(action = "app_emoji_saved", id = %id, name = %name, uid = %uid);
    Ok(entry)
}

#[tauri::command]
pub async fn delete_emoji(app_handle: AppHandle, id: String, uid: String) -> CommandResult<()> {
    repository::delete_emoji(&app_handle, &id, &uid)
        .map_err(|e| to_command_error("EMOJI_DELETE_FAILED", "error.emoji_delete_failed", e))?;
    tracing::info!(action = "app_emoji_deleted", id = %id, uid = %uid);
    Ok(())
}

#[tauri::command]
pub async fn copy_emoji(
    app_handle: AppHandle,
    source_id: String,
    uid: String,
    name: String,
) -> CommandResult<EmojiEntry> {
    let entry =
        repository::copy_emoji(&app_handle, &source_id, &uid, &name)
            .map_err(|e| to_command_error("EMOJI_COPY_FAILED", "error.emoji_copy_failed", e))?;
    tracing::info!(action = "app_emoji_copied", source = %source_id, new_id = %entry.id, uid = %uid);
    Ok(entry)
}

/// 允许的自定义表情扩展名白名单（与前端上传控件的 accept 列表保持一致）。
const EMOJI_ALLOWED_EXTENSIONS: [&str; 7] = ["png", "jpg", "jpeg", "gif", "webp", "apng", "avif"];

#[tauri::command]
pub async fn write_temp_emoji_file(
    app_handle: AppHandle,
    name: String,
    data: Vec<u8>,
) -> CommandResult<String> {
    use std::io::Write;

    // 安全约束：name 仅用于提取扩展名；落盘文件名由后端生成（uuid），
    // 杜绝 `..\..` / 盘符 / 绝对路径借 Path::join 脱离临时目录。
    let ext = std::path::Path::new(&name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if !EMOJI_ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!(
            "[EMOJI_EXT_INVALID] unsupported emoji file extension: {ext}"
        ));
    }
    if !repository::emoji_magic_matches(&data, &ext) {
        return Err(command_error(
            "EMOJI_MAGIC_INVALID",
            "error.emoji_magic_invalid",
        ));
    }

    let tmp_dir = repository::emoji_dir(&app_handle)
        .map_err(|e| to_command_error("EMOJI_DIR_FAILED", "error.emoji_dir_failed", e))?
        .join("_upload_tmp");
    std::fs::create_dir_all(&tmp_dir)
        .map_err(|e| to_command_error("EMOJI_WRITE_FAILED", "error.emoji_write_failed", e))?;
    let file_name = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let path = tmp_dir.join(file_name);
    let mut file = std::fs::File::create(&path)
        .map_err(|e| to_command_error("EMOJI_WRITE_FAILED", "error.emoji_write_failed", e))?;
    file.write_all(&data)
        .map_err(|e| to_command_error("EMOJI_WRITE_FAILED", "error.emoji_write_failed", e))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_emoji_image_path(app_handle: AppHandle, id: String) -> CommandResult<String> {
    let index = repository::load_index(&app_handle);
    let entry = index
        .items
        .iter()
        .find(|e| e.id == id)
        .ok_or_else(|| command_error("EMOJI_NOT_FOUND", "error.emoji_not_found"))?;
    let full_path = repository::emoji_dir(&app_handle)
        .map_err(|e| to_command_error("EMOJI_DIR_FAILED", "error.emoji_dir_failed", e))?
        .join(&entry.file_path);
    Ok(full_path.to_string_lossy().to_string())
}
