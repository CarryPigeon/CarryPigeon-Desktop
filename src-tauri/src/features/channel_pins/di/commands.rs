//! channel_pins｜Tauri 命令实现。
//!
//! 约定：注释中文，日志英文（tracing）。

use crate::features::channel_pins::data::store;
use crate::features::channel_pins::domain::model::ChannelPinsStateV1;
use crate::shared::error::{CommandResult, to_command_error};

/// 读取全部服务器的置顶频道状态。
#[tauri::command]
pub async fn channel_pins_get() -> CommandResult<ChannelPinsStateV1> {
    if let Err(error) = store::ensure_file_exists().await {
        tracing::warn!(action = "app_channel_pins_ensure_file_failed", error = %error);
    }
    Ok(store::load_state().unwrap_or_default())
}

/// 设置某频道在当前服务器下的置顶状态。
#[tauri::command]
pub async fn channel_pins_set(
    server_socket: String,
    channel_id: String,
    pinned: bool,
) -> CommandResult<ChannelPinsStateV1> {
    store::set_pinned(&server_socket, &channel_id, pinned)
        .await
        .map_err(|e| {
            to_command_error(
                "CHANNEL_PINS_SAVE_FAILED",
                "error.channel_pins_save_failed",
                e,
            )
        })
}

/// 切换某频道在当前服务器下的置顶状态。
#[tauri::command]
pub async fn channel_pins_toggle(
    server_socket: String,
    channel_id: String,
) -> CommandResult<ChannelPinsStateV1> {
    store::toggle_pinned(&server_socket, &channel_id)
        .await
        .map_err(|e| {
            to_command_error(
                "CHANNEL_PINS_SAVE_FAILED",
                "error.channel_pins_save_failed",
                e,
            )
        })
}

/// 覆盖某服务器下的置顶频道有序列表（应用内编辑器保存入口）。
#[tauri::command]
pub async fn channel_pins_set_order(
    server_socket: String,
    channel_ids: Vec<String>,
) -> CommandResult<ChannelPinsStateV1> {
    store::set_order(&server_socket, &channel_ids)
        .await
        .map_err(|e| {
            to_command_error(
                "CHANNEL_PINS_SAVE_FAILED",
                "error.channel_pins_save_failed",
                e,
            )
        })
}
