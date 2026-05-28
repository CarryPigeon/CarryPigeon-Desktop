//! emoji｜Tauri 命令实现。

use tauri::AppHandle;
use tauri::Manager;

use crate::features::emoji::domain::types::EmojiEntry;
use crate::features::emoji::repository;
use crate::shared::error::CommandResult;

#[tauri::command]
pub async fn list_custom_emojis(app_handle: AppHandle) -> CommandResult<Vec<EmojiEntry>> {
    let index = repository::load_index(&app_handle);
    Ok(index.items)
}

#[tauri::command]
pub async fn save_emoji(
    app_handle: AppHandle,
    source_path: String,
    name: String,
    tags: Vec<String>,
) -> CommandResult<EmojiEntry> {
    let id = uuid::Uuid::new_v4().to_string();
    let entry = repository::add_emoji(
        &app_handle,
        &id,
        &name,
        std::path::Path::new(&source_path),
        &tags,
    )
    .map_err(|e| e.to_string())?;
    tracing::info!(action = "app_emoji_saved", id = %id, name = %name);
    Ok(entry)
}

#[tauri::command]
pub async fn delete_emoji(app_handle: AppHandle, id: String) -> CommandResult<()> {
    repository::delete_emoji(&app_handle, &id).map_err(|e| e.to_string())?;
    tracing::info!(action = "app_emoji_deleted", id = %id);
    Ok(())
}

#[tauri::command]
pub async fn get_emoji_image_path(app_handle: AppHandle, id: String) -> CommandResult<String> {
    let index = repository::load_index(&app_handle);
    let entry = index
        .items
        .iter()
        .find(|e| e.id == id)
        .ok_or("emoji not found")?;
    let full_path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("custom-emoji")
        .join(&entry.file_path);
    Ok(full_path.to_string_lossy().to_string())
}
