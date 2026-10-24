//! plugin_store｜安装状态文件管理（current/state/版本列表）。
//!
//! 职责：
//! - 读取/写入 `current.json`（当前版本 + enabled）
//! - 读取/写入 `state.json`（status + last_error）
//! - 枚举已安装版本目录
//! - 组装 `InstalledPluginState`（供前端展示与运行时决策）
//!
//! 说明：
//! - 该模块只处理“本地状态文件与目录”，不处理下载/解压/网络请求。

use std::{cmp::Ordering, time::SystemTime};

use serde::{Deserialize, Serialize};

use super::{
    InstalledPluginState,
    json_io::{read_json_file, write_json_file},
    paths::{current_file_path, plugin_root_dir, state_file_path},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) struct PluginCurrent {
    pub version: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(super) struct PluginStateFile {
    pub status: String,     // "ok" | "failed"
    pub last_error: String, // 人类可读的错误信息
}

async fn list_installed_versions(server_id: &str, plugin_id: &str) -> anyhow::Result<Vec<String>> {
    let root = plugin_root_dir(server_id, plugin_id)?;
    let mut versions: Vec<(SystemTime, String)> = Vec::new();
    let mut rd = match tokio::fs::read_dir(&root).await {
        Ok(rd) => rd,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(err) => return Err(err.into()),
    };
    while let Some(ent) = rd.next_entry().await? {
        let ty = ent.file_type().await?;
        if !ty.is_dir() {
            continue;
        }
        let name = ent.file_name().to_string_lossy().to_string();
        if name.trim().is_empty() {
            continue;
        }
        let modified = ent
            .metadata()
            .await
            .and_then(|meta| meta.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        versions.push((modified, name));
    }
    versions.sort_by(|a, b| match a.0.cmp(&b.0) {
        Ordering::Equal => a.1.cmp(&b.1),
        other => other,
    });
    Ok(versions.into_iter().map(|(_, version)| version).collect())
}

pub(super) async fn read_current(
    server_id: &str,
    plugin_id: &str,
) -> anyhow::Result<Option<PluginCurrent>> {
    let path = current_file_path(server_id, plugin_id)?;
    read_json_file::<PluginCurrent>(&path).await
}

pub(super) async fn write_current(
    server_id: &str,
    plugin_id: &str,
    current: &PluginCurrent,
) -> anyhow::Result<()> {
    let path = current_file_path(server_id, plugin_id)?;
    write_json_file(&path, current).await
}

pub(super) async fn read_state_file(
    server_id: &str,
    plugin_id: &str,
) -> anyhow::Result<PluginStateFile> {
    let path = state_file_path(server_id, plugin_id)?;
    let existing = read_json_file::<PluginStateFile>(&path).await?;
    Ok(existing.unwrap_or(PluginStateFile {
        status: "ok".to_string(),
        last_error: "".to_string(),
    }))
}

pub(super) async fn write_state_file(
    server_id: &str,
    plugin_id: &str,
    st: &PluginStateFile,
) -> anyhow::Result<()> {
    let path = state_file_path(server_id, plugin_id)?;
    write_json_file(&path, st).await
}

pub(super) async fn build_installed_state(
    server_id: &str,
    plugin_id: &str,
) -> anyhow::Result<InstalledPluginState> {
    let installed_versions = list_installed_versions(server_id, plugin_id).await?;
    let current = read_current(server_id, plugin_id).await?;
    let state = read_state_file(server_id, plugin_id).await?;

    Ok(InstalledPluginState {
        plugin_id: plugin_id.to_string(),
        installed_versions,
        current_version: current.as_ref().map(|c| c.version.clone()),
        enabled: current.as_ref().map(|c| c.enabled).unwrap_or(false),
        status: state.status,
        last_error: state.last_error,
    })
}

/// 判断安装态是否构成一次“真实安装”。
///
/// 背景：本地源（自带）插件通过 `plugins_storage_*` 写 KV 存储时，也会在
/// `{base}/{server_id}/{plugin_id}/` 下创建 `storage.json`，仅凭目录存在
/// 判定“已安装”会把这类目录误报为幻影安装记录（无 current.json 时
/// `enabled` 恒为 false），进而覆盖前端本地源的默认启用态，表现为
/// “自带插件反复回到已禁用、启用不生效”。
///
/// 判定规则：存在 current.json（`current_version` 非空）或至少一个版本目录
/// （`installed_versions` 非空）才算已安装；仅剩 storage.json 等运行期数据
/// 的目录视为未安装。
pub(super) fn is_actually_installed(state: &InstalledPluginState) -> bool {
    state.current_version.is_some() || !state.installed_versions.is_empty()
}
