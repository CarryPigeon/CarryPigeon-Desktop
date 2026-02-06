//! plugin_store｜路径与目录工具。
//!
//! 说明：
//! - 该文件只负责“安全路径拼接 + 插件根目录定位”的纯函数工具；
//! - 不做任何 IO，以便在安装/卸载/读取状态等流程中复用。

use std::path::{Path, PathBuf};

/// 获取插件存储根目录：`{repoRoot}/data/plugins`。
///
/// 说明：
/// - 运行时工作目录可能位于 `src-tauri/`，这里做一次“向上回退”以对齐仓库根。
/// - 该目录由上层流程按需创建（本函数不负责创建目录）。
pub(super) fn base_plugins_dir() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let parent = cwd
        .file_name()
        .map(|name| name == "src-tauri")
        .unwrap_or(false)
        .then(|| cwd.parent().map(|p| p.to_path_buf()))
        .flatten();
    let root = parent.unwrap_or(cwd);
    root.join("data").join("plugins")
}

fn sanitize_segment(seg: &str) -> anyhow::Result<String> {
    let s = seg.trim();
    if s.is_empty() {
        return Err(anyhow::anyhow!("Invalid empty path segment"));
    }
    if s == "." || s == ".." || s.contains('\\') || s.contains('/') {
        return Err(anyhow::anyhow!("Invalid path segment: {}", s));
    }
    if s.contains(':') {
        return Err(anyhow::anyhow!(
            "Invalid path segment (contains ':'): {}",
            s
        ));
    }
    Ok(s.to_string())
}

/// 在根目录下安全拼接多个路径段（防止 `..`、分隔符注入等）。
///
/// # 参数
/// - `root`：根目录。
/// - `segments`：路径段（将逐个做合法性校验）。
///
/// # 返回值
/// - 拼接后的 PathBuf。
pub(super) fn safe_join(root: &Path, segments: &[String]) -> anyhow::Result<PathBuf> {
    let mut p = root.to_path_buf();
    for s in segments {
        let seg = sanitize_segment(s)?;
        p.push(seg);
    }
    Ok(p)
}

/// 插件根目录：`{base}/{server_id}/{plugin_id}`。
pub(super) fn plugin_root_dir(server_id: &str, plugin_id: &str) -> anyhow::Result<PathBuf> {
    let base = base_plugins_dir();
    let segments = vec![server_id.to_string(), plugin_id.to_string()];
    safe_join(&base, &segments)
}

/// 插件版本目录：`{base}/{server_id}/{plugin_id}/{version}`。
pub(super) fn plugin_version_dir(
    server_id: &str,
    plugin_id: &str,
    version: &str,
) -> anyhow::Result<PathBuf> {
    let base = base_plugins_dir();
    let segments = vec![
        server_id.to_string(),
        plugin_id.to_string(),
        version.to_string(),
    ];
    safe_join(&base, &segments)
}

/// `current.json` 路径：记录当前版本与启用态。
pub(super) fn current_file_path(server_id: &str, plugin_id: &str) -> anyhow::Result<PathBuf> {
    Ok(plugin_root_dir(server_id, plugin_id)?.join("current.json"))
}

/// `state.json` 路径：记录 status 与 last_error。
pub(super) fn state_file_path(server_id: &str, plugin_id: &str) -> anyhow::Result<PathBuf> {
    Ok(plugin_root_dir(server_id, plugin_id)?.join("state.json"))
}

/// `plugin.json` 路径：插件清单文件（位于版本目录）。
pub(super) fn manifest_file_path(
    server_id: &str,
    plugin_id: &str,
    version: &str,
) -> anyhow::Result<PathBuf> {
    Ok(plugin_version_dir(server_id, plugin_id, version)?.join("plugin.json"))
}

/// `storage.json` 路径：插件侧简单 KV 存储（位于插件根目录）。
pub(super) fn storage_file_path(server_id: &str, plugin_id: &str) -> anyhow::Result<PathBuf> {
    Ok(plugin_root_dir(server_id, plugin_id)?.join("storage.json"))
}

/// 解析 `app://plugins/...` 自定义 scheme 对应的本地文件路径。
///
/// 说明：
/// - 返回路径始终落在仓库的 `data/plugins` 目录下（开发态友好，便于直接查看文件）；
/// - 调用方仍需自行设置正确的 Content-Type（该函数不推断 MIME）。
pub(super) fn resolve_app_plugins_path(
    server_id: &str,
    plugin_id: &str,
    version: &str,
    rel_path: &str,
) -> anyhow::Result<PathBuf> {
    let base = base_plugins_dir();
    let rel = rel_path.trim().trim_start_matches('/');
    if rel.is_empty() {
        return Err(anyhow::anyhow!("Missing relative path"));
    }
    if rel.contains('\\') {
        return Err(anyhow::anyhow!(
            "Invalid relative path (contains backslash)"
        ));
    }
    // 防止路径穿越：严格禁止 "."/".." 段。
    for seg in rel.split('/') {
        if seg.is_empty() || seg == "." || seg == ".." {
            return Err(anyhow::anyhow!("Invalid relative path segment"));
        }
    }
    let segments = vec![
        server_id.to_string(),
        plugin_id.to_string(),
        version.to_string(),
    ];
    let root = safe_join(&base, &segments)?;
    Ok(root.join(rel))
}
