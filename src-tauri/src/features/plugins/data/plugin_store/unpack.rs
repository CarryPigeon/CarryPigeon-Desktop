//! plugin_store｜zip 解压与安全校验。
//!
//! 说明：
//! - 解压在 blocking 线程中执行，避免阻塞 async runtime；
//! - 对 zip entry 做路径安全校验，防止路径穿越与可疑路径片段；
//! - 禁止插件包携带前端源码文件（例如 `.vue/.ts/.scss`），避免“把源代码当成插件包”。

use std::{
    io::{Cursor, Read},
    path::PathBuf,
};

use anyhow::Context;
use zip::ZipArchive;

fn normalize_zip_name(raw: &str) -> String {
    raw.replace('\\', "/").trim_start_matches('/').to_string()
}

fn is_zip_name_safe(name: &str) -> bool {
    if name.is_empty() {
        return false;
    }
    if name.starts_with('/') {
        return false;
    }
    // 禁止盘符/协议类提示（例如 `C:`）。
    if name.contains(':') {
        return false;
    }
    // 禁止路径穿越段（`.`/`..`/空段）。
    for seg in name.split('/') {
        if seg.is_empty() || seg == "." || seg == ".." {
            return false;
        }
    }
    true
}

fn detect_single_root_prefix(names: &[String]) -> Option<String> {
    let mut prefix: Option<&str> = None;
    for n in names {
        let segs: Vec<&str> = n.split('/').collect();
        if segs.len() < 2 {
            return None;
        }
        match prefix {
            Some(p) if p != segs[0] => return None,
            None => prefix = Some(segs[0]),
            _ => {}
        }
    }
    prefix.map(|s| s.to_string())
}

fn strip_root_prefix(name: &str, prefix: &str) -> String {
    if !name.starts_with(prefix) {
        return name.to_string();
    }
    let trimmed = name.strip_prefix(prefix).unwrap_or(name);
    trimmed.trim_start_matches('/').to_string()
}

fn is_forbidden_source_file(path: &str) -> bool {
    let lower = path.to_lowercase();
    if lower.ends_with(".d.ts") {
        return false;
    }
    lower.ends_with(".vue")
        || lower.ends_with(".ts")
        || lower.ends_with(".tsx")
        || lower.ends_with(".scss")
        || lower.ends_with(".sass")
        || lower.ends_with(".less")
}

/// 将插件 zip 解压到目标目录（在 blocking 线程执行，避免阻塞 async runtime）。
pub(super) async fn unpack_plugin_zip(bytes: Vec<u8>, write_root: PathBuf) -> anyhow::Result<()> {
    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        let mut archive = ZipArchive::new(Cursor::new(bytes)).context("Invalid zip archive")?;

        // 判断 zip 是否把所有内容包在单一根目录下（常见打包方式）。
        let mut names: Vec<String> = vec![];
        for i in 0..archive.len() {
            let f = archive.by_index(i)?;
            if f.is_dir() {
                continue;
            }
            let normalized = normalize_zip_name(f.name());
            if normalized.is_empty() {
                continue;
            }
            names.push(normalized);
        }
        let root_prefix = detect_single_root_prefix(&names);

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let normalized = normalize_zip_name(file.name());
            if normalized.is_empty() {
                continue;
            }
            if !is_zip_name_safe(&normalized) {
                return Err(anyhow::anyhow!("Unsafe zip entry path: {}", normalized));
            }

            let final_name = if let Some(prefix) = root_prefix.as_deref() {
                strip_root_prefix(&normalized, prefix)
            } else {
                normalized
            };
            if final_name.is_empty() {
                continue;
            }
            if !is_zip_name_safe(&final_name) {
                return Err(anyhow::anyhow!(
                    "Unsafe zip entry path after strip: {}",
                    final_name
                ));
            }

            let out_path = write_root.join(&final_name);
            if file.is_dir() {
                std::fs::create_dir_all(&out_path)?;
                continue;
            }
            if is_forbidden_source_file(&final_name) {
                return Err(anyhow::anyhow!(
                    "Plugin package contains forbidden source file: {}",
                    final_name
                ));
            }
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out = std::fs::File::create(&out_path)?;
            let mut buf = Vec::with_capacity(file.size() as usize);
            file.read_to_end(&mut buf)?;
            std::io::Write::write_all(&mut out, &buf)?;
        }
        Ok(())
    })
    .await
    .context("Zip unpack task failed")??;
    Ok(())
}
