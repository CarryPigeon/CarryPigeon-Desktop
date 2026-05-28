//! emoji｜表情索引持久化。
//!
//! 在 {app_data_dir}/custom-emoji/ 维护 index.json 和 images/ 目录。

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use tauri::Manager;

use crate::features::emoji::domain::types::{EmojiEntry, EmojiIndex};

fn emoji_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("custom-emoji")
}

fn index_path(app_handle: &tauri::AppHandle) -> PathBuf {
    emoji_dir(app_handle).join("index.json")
}

fn images_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    emoji_dir(app_handle).join("images")
}

pub fn load_index(app_handle: &tauri::AppHandle) -> EmojiIndex {
    let path = index_path(app_handle);
    if !path.exists() {
        return EmojiIndex::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_index(app_handle: &tauri::AppHandle, index: &EmojiIndex) -> Result<()> {
    let dir = emoji_dir(app_handle);
    fs::create_dir_all(&dir).context("create dir")?;
    let json = serde_json::to_string_pretty(index).context("serialize")?;
    fs::write(index_path(app_handle), json).context("write")
}

pub fn add_emoji(
    app_handle: &tauri::AppHandle,
    id: &str,
    name: &str,
    source_path: &Path,
    tags: &[String],
) -> Result<EmojiEntry> {
    let imgs = images_dir(app_handle);
    fs::create_dir_all(&imgs).context("create images dir")?;

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let dest = imgs.join(format!("{}.{}", id, ext));

    // Resize image to max 128x128 using the `image` crate
    let img = image::open(source_path).context("open image")?;
    let resized = img.resize(128, 128, image::imageops::FilterType::Lanczos3);
    resized.save(&dest).context("save image")?;

    let entry = EmojiEntry {
        id: id.to_string(),
        name: name.to_string(),
        file_path: format!("images/{}.{}", id, ext),
        added_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        tags: tags.to_vec(),
    };

    let mut index = load_index(app_handle);
    index.items.push(entry.clone());
    save_index(app_handle, &index)?;

    Ok(entry)
}

pub fn delete_emoji(app_handle: &tauri::AppHandle, id: &str) -> Result<()> {
    let mut index = load_index(app_handle);
    let idx = index
        .items
        .iter()
        .position(|e| e.id == id)
        .context("emoji not found")?;
    let entry = index.items.remove(idx);

    // Remove image file
    let img_path = emoji_dir(app_handle).join(&entry.file_path);
    if img_path.exists() {
        let _ = fs::remove_file(img_path);
    }

    save_index(app_handle, &index)
}
