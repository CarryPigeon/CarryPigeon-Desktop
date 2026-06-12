//! emoji｜表情索引持久化。
//!
//! 在 {app_data_dir}/custom-emoji/ 维护 index.json 和 images/ 目录。

use std::fs;
use std::io::BufReader;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use tauri::Manager;
use uuid::Uuid;

use crate::features::emoji::domain::types::{EmojiEntry, EmojiIndex};

pub fn emoji_dir(app_handle: &tauri::AppHandle) -> PathBuf {
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

/// 检测图像是否为动画格式（GIF 多帧 / APNG / WebP 动画）。
fn is_animated_image(source_path: &Path) -> bool {
    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "gif" => {
            // 使用 gif crate 精确读取帧数
            if let Ok(file) = fs::File::open(source_path) {
                let reader = BufReader::new(file);
                if let Ok(mut decoder) = gif::DecodeOptions::new().read_info(reader) {
                    let mut frame_count = 0;
                    while decoder.read_next_frame().is_ok_and(|f| f.is_some()) {
                        frame_count += 1;
                        if frame_count > 1 {
                            return true;
                        }
                    }
                }
            }
            false
        }
        "apng" | "avif" => {
            // APNG 和 AVIF 可能包含动画，原样保留
            true
        }
        "webp" => {
            // WebP: 检查 RIFF 头中的 ANIM chunk
            if let Ok(data) = fs::read(source_path) {
                if data.len() > 30
                    && &data[0..4] == b"RIFF"
                    && &data[8..12] == b"WEBP"
                {
                    for i in (12..data.len() - 8).step_by(1) {
                        if &data[i..i + 4] == b"VP8X" && i + 8 <= data.len() {
                            let flags = data[i + 4];
                            return (flags & 0x02) != 0;
                        }
                    }
                }
            }
            false
        }
        _ => false,
    }
}

pub fn add_emoji(
    app_handle: &tauri::AppHandle,
    id: &str,
    name: &str,
    source_path: &Path,
    tags: &[String],
    owner_uid: &str,
) -> Result<EmojiEntry> {
    let imgs = images_dir(app_handle);
    fs::create_dir_all(&imgs).context("create images dir")?;

    let ext = source_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let dest = imgs.join(format!("{}.{}", id, ext));

    let animated = is_animated_image(source_path);

    if animated {
        // 动图：原样复制，不 resize（避免丢失帧）
        fs::copy(source_path, &dest).context("copy animated image")?;
    } else {
        // 静态图：resize 至最大 128x128
        let img = image::open(source_path).context("open image")?;
        let resized = img.resize(128, 128, image::imageops::FilterType::Lanczos3);
        resized.save(&dest).context("save image")?;
    }

    let entry = EmojiEntry {
        id: id.to_string(),
        name: name.to_string(),
        file_path: format!("images/{}.{}", id, ext),
        added_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        tags: tags.to_vec(),
        owner_uid: owner_uid.to_string(),
        is_animated: animated,
    };

    let mut index = load_index(app_handle);
    index.items.push(entry.clone());
    save_index(app_handle, &index)?;

    Ok(entry)
}

pub fn delete_emoji(app_handle: &tauri::AppHandle, id: &str, owner_uid: &str) -> Result<()> {
    let mut index = load_index(app_handle);
    let idx = index
        .items
        .iter()
        .position(|e| e.id == id && e.owner_uid == owner_uid)
        .context("emoji not found")?;
    let entry = index.items.remove(idx);

    // Remove image file
    let img_path = emoji_dir(app_handle).join(&entry.file_path);
    if img_path.exists() {
        let _ = fs::remove_file(img_path);
    }

    save_index(app_handle, &index)
}

/// 从他人消息中一键保存表情到当前用户的表情列表。
pub fn copy_emoji(
    app_handle: &tauri::AppHandle,
    source_id: &str,
    owner_uid: &str,
    new_name: &str,
) -> Result<EmojiEntry> {
    let index = load_index(app_handle);
    let source = index
        .items
        .iter()
        .find(|e| e.id == source_id)
        .context("source emoji not found")?;

    let src_path = emoji_dir(app_handle).join(&source.file_path);
    if !src_path.exists() {
        anyhow::bail!("source emoji file not found on disk");
    }

    let new_id = Uuid::new_v4().to_string();
    let ext = src_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let dest = images_dir(app_handle).join(format!("{}.{}", new_id, ext));

    let imgs = images_dir(app_handle);
    fs::create_dir_all(&imgs).context("create images dir")?;
    fs::copy(&src_path, &dest).context("copy emoji file")?;

    let entry = EmojiEntry {
        id: new_id.clone(),
        name: new_name.to_string(),
        file_path: format!("images/{}.{}", new_id, ext),
        added_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        tags: source.tags.clone(),
        owner_uid: owner_uid.to_string(),
        is_animated: source.is_animated,
    };

    let mut index = load_index(app_handle);
    index.items.push(entry.clone());
    save_index(app_handle, &index)?;

    Ok(entry)
}
