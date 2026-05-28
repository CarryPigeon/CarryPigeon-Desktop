//! emoji｜表情索引持久化。
//!
//! 在 {app_data_dir}/custom-emoji/ 维护 index.json 和 images/ 目录。

use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;

use crate::features::emoji::domain::types::{EmojiEntry, EmojiIndex};

fn emoji_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    app_handle.path().app_data_dir().unwrap_or_default().join("custom-emoji")
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

pub fn save_index(app_handle: &tauri::AppHandle, index: &EmojiIndex) -> Result<(), String> {
    let dir = emoji_dir(app_handle);
    fs::create_dir_all(&dir).map_err(|e| format!("create dir: {}", e))?;
    let json = serde_json::to_string_pretty(index).map_err(|e| format!("serialize: {}", e))?;
    fs::write(index_path(app_handle), json).map_err(|e| format!("write: {}", e))
}

pub fn add_emoji(app_handle: &tauri::AppHandle, id: &str, name: &str, source_path: &Path, tags: &[String]) -> Result<EmojiEntry, String> {
    let imgs = images_dir(app_handle);
    fs::create_dir_all(&imgs).map_err(|e| format!("create images dir: {}", e))?;

    let ext = source_path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let dest = imgs.join(format!("{}.{}", id, ext));

    // Resize image to max 128x128 using the `image` crate
    let img = image::open(source_path).map_err(|e| format!("open image: {}", e))?;
    let resized = img.resize(128, 128, image::imageops::FilterType::Lanczos3);
    resized.save(&dest).map_err(|e| format!("save image: {}", e))?;

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

pub fn delete_emoji(app_handle: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let mut index = load_index(app_handle);
    let idx = index.items.iter().position(|e| e.id == id).ok_or("emoji not found")?;
    let entry = index.items.remove(idx);

    // Remove image file
    let img_path = emoji_dir(app_handle).join(&entry.file_path);
    if img_path.exists() {
        let _ = fs::remove_file(img_path);
    }

    save_index(app_handle, &index)
}
