//! plugin_store｜zip 解压与安全校验。
//!
//! 说明：
//! - 解压在 blocking 线程中执行，避免阻塞 async runtime；
//! - 对 zip entry 做路径安全校验，防止路径穿越与可疑路径片段；
//! - 禁止插件包携带前端源码文件（例如 `.vue/.ts/.scss`），避免“把源代码当成插件包”。

use std::{
    io::{Cursor, Read},
    path::{Path, PathBuf},
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

#[cfg(windows)]
fn is_windows_reparse_point(meta: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_windows_reparse_point(_meta: &std::fs::Metadata) -> bool {
    false
}

fn is_zip_entry_symlink(file: &zip::read::ZipFile<'_>) -> bool {
    file.unix_mode()
        .map(|mode| mode & 0o170000 == 0o120000)
        .unwrap_or(false)
}

fn ensure_write_target_is_safe(
    canonical_root: &Path,
    rel_name: &str,
    is_dir: bool,
) -> anyhow::Result<PathBuf> {
    let mut out_path = canonical_root.to_path_buf();
    let segments: Vec<&str> = rel_name.split('/').collect();

    for (idx, segment) in segments.iter().enumerate() {
        out_path.push(segment);

        match std::fs::symlink_metadata(&out_path) {
            Ok(meta) => {
                let file_type = meta.file_type();
                if std::fs::read_link(&out_path).is_ok() {
                    return Err(anyhow::anyhow!("Symlink path rejected: {}", out_path.display()));
                }
                if file_type.is_symlink() || is_windows_reparse_point(&meta) {
                    return Err(anyhow::anyhow!("Symlink path rejected: {}", out_path.display()));
                }
                let canonical = std::fs::canonicalize(&out_path).with_context(|| {
                    format!("Failed to canonicalize path component: {}", out_path.display())
                })?;
                if !canonical.starts_with(canonical_root) {
                    return Err(anyhow::anyhow!("Symlink path rejected: {}", out_path.display()));
                }
                if idx < segments.len() - 1 && !file_type.is_dir() {
                    return Err(anyhow::anyhow!(
                        "Path component is not a directory: {}",
                        out_path.display()
                    ));
                }
                if idx == segments.len() - 1 {
                    if is_dir && !file_type.is_dir() {
                        return Err(anyhow::anyhow!(
                            "Directory entry conflicts with existing file: {}",
                            out_path.display()
                        ));
                    }
                    if !is_dir && file_type.is_dir() {
                        return Err(anyhow::anyhow!(
                            "File entry conflicts with existing directory: {}",
                            out_path.display()
                        ));
                    }
                }
            }
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                if idx < segments.len() - 1 {
                    continue;
                }
            }
            Err(err) => return Err(err.into()),
        }
    }

    Ok(out_path)
}

/// 将插件 zip 解压到目标目录（在 blocking 线程执行，避免阻塞 async runtime）。
pub(super) async fn unpack_plugin_zip(bytes: Vec<u8>, write_root: PathBuf) -> anyhow::Result<()> {
    tokio::task::spawn_blocking(move || -> anyhow::Result<()> {
        let mut archive = ZipArchive::new(Cursor::new(bytes)).context("Invalid zip archive")?;
        let root_meta = std::fs::symlink_metadata(&write_root)
            .with_context(|| format!("Failed to inspect write root: {}", write_root.display()))?;
        if root_meta.file_type().is_symlink() {
            return Err(anyhow::anyhow!(
                "Plugin write root is a symlink: {}",
                write_root.display()
            ));
        }
        let canonical_root = write_root.canonicalize().with_context(|| {
            format!("Failed to canonicalize plugin write root: {}", write_root.display())
        })?;

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
            if is_zip_entry_symlink(&file) {
                return Err(anyhow::anyhow!("Symlink zip entry rejected: {}", normalized));
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

            let out_path = ensure_write_target_is_safe(&canonical_root, &final_name, file.is_dir())?;
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

#[cfg(test)]
mod tests {
    use super::unpack_plugin_zip;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(prefix: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!(
            "carrypigeon-{}-{}-{}",
            prefix,
            std::process::id(),
            stamp
        ))
    }

    fn build_symlink_zip_bytes() -> Vec<u8> {
        use zip::write::FileOptions;

        let mut writer = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        let options = FileOptions::default().unix_permissions(0o120777);
        writer
            .add_symlink("demo-plugin/link", "/tmp/escape.js", options)
            .expect("start symlink entry");
        writer.finish().expect("finish zip").into_inner()
    }

    #[cfg(unix)]
    fn build_nested_zip_bytes() -> Vec<u8> {
        use zip::write::FileOptions;

        let mut writer = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        let options = FileOptions::default().unix_permissions(0o100644);
        writer
            .start_file("demo-plugin/linked/payload.js", options)
            .expect("start file");
        writer.write_all(b"export default 1;").expect("write file");
        writer.finish().expect("finish zip").into_inner()
    }

    fn cleanup_dir(path: &PathBuf) {
        let _ = std::fs::remove_dir_all(path);
    }

    #[cfg(unix)]
    fn create_dir_link(link: &PathBuf, target: &PathBuf) {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(target, link).expect("create symlink");
        }
        #[cfg(windows)]
        {
            let command = format!(
                "New-Item -ItemType Junction -Path '{}' -Target '{}' | Out-Null",
                link.display(),
                target.display()
            );
            let status = std::process::Command::new("pwsh")
                .args(["-NoProfile", "-Command", &command])
                .status()
                .expect("run junction command");
            assert!(status.success(), "junction creation failed");
        }
    }

    #[tokio::test]
    async fn plugin_rejects_symlink() {
        let root = unique_temp_dir("plugin-symlink-zip");
        std::fs::create_dir_all(&root).expect("create root");

        let err = unpack_plugin_zip(build_symlink_zip_bytes(), root.clone())
            .await
            .expect_err("symlink zip entry must be rejected");
        assert!(err.to_string().contains("Symlink zip entry rejected"));

        cleanup_dir(&root);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn plugin_rejects_outside_canonical_root() {
        let root = unique_temp_dir("plugin-symlink-traversal");
        let linked_root = root.join("demo-plugin").join("linked");
        let outside = unique_temp_dir("plugin-symlink-outside");
        std::fs::create_dir_all(&outside).expect("create outside root");
        std::fs::create_dir_all(linked_root.parent().expect("parent")).expect("create parent");
        create_dir_link(&linked_root, &outside);

        let err = unpack_plugin_zip(build_nested_zip_bytes(), root.clone())
            .await
            .expect_err("symlink traversal must be rejected");
        assert!(err.to_string().contains("Symlink path rejected"));

        cleanup_dir(&root);
        cleanup_dir(&outside);
    }
}
