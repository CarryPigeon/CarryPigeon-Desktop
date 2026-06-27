//! emoji｜Tauri 命令实现。

use tauri::AppHandle;

use crate::features::emoji::domain::types::EmojiEntry;
use crate::features::emoji::repository;
use crate::shared::error::CommandResult;

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
    .map_err(|e| e.to_string())?;
    tracing::info!(action = "app_emoji_saved", id = %id, name = %name, uid = %uid);
    Ok(entry)
}

#[tauri::command]
pub async fn delete_emoji(app_handle: AppHandle, id: String, uid: String) -> CommandResult<()> {
    repository::delete_emoji(&app_handle, &id, &uid).map_err(|e| e.to_string())?;
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
        repository::copy_emoji(&app_handle, &source_id, &uid, &name).map_err(|e| e.to_string())?;
    tracing::info!(action = "app_emoji_copied", source = %source_id, new_id = %entry.id, uid = %uid);
    Ok(entry)
}

#[tauri::command]
pub async fn write_temp_emoji_file(
    app_handle: AppHandle,
    name: String,
    data: Vec<u8>,
) -> CommandResult<String> {
    use std::io::Write;
    let tmp_dir = repository::emoji_dir(&app_handle)
        .map_err(|e| e.to_string())?
        .join("_upload_tmp");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;
    let path = tmp_dir.join(&name);
    let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_emoji_image_path(app_handle: AppHandle, id: String) -> CommandResult<String> {
    let index = repository::load_index(&app_handle);
    let entry = index
        .items
        .iter()
        .find(|e| e.id == id)
        .ok_or("emoji not found")?;
    let full_path = repository::emoji_dir(&app_handle)
        .map_err(|e| e.to_string())?
        .join(&entry.file_path);
    Ok(full_path.to_string_lossy().to_string())
}
