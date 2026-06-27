//! settings｜数据适配器：config_store_port_adapter。
//!
//! 本适配器负责两件事：
//! 1. 将 config_store 的 async 函数适配为 ConfigStorePort trait
//! 2. 同步 close_to_tray 内存缓存（CloseToTrayState），
//!    确保 di/commands 层仅做参数透传和错误规范化。

use std::sync::OnceLock;
use std::sync::atomic::Ordering;

use tauri::Manager;

use crate::features::settings::data::config_store::{Config, config_file_path};
use crate::features::settings::domain::ports::config_store_port::{
    ConfigStoreFuture, ConfigStorePort,
};
use crate::features::settings::domain::settings_schema::SettingsImportEnvelopeV1;
use crate::shared::close_to_tray_state::CloseToTrayState;

use super::config_store;

/// 缓存 AppHandle 用于在 data 层同步 close_to_tray 内存缓存，
/// 避免 di/commands 层需要感知缓存同步逻辑。
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

#[derive(Debug, Default, Clone, Copy)]
pub struct ConfigStorePortAdapter;

impl ConfigStorePortAdapter {
    pub fn shared() -> &'static Self {
        static ADAPTER: ConfigStorePortAdapter = ConfigStorePortAdapter;
        &ADAPTER
    }

    /// 初始化适配器的 AppHandle 引用（需在 Tauri setup 期间调用一次）。
    pub fn init_app_handle(app_handle: &tauri::AppHandle) {
        let _ = APP_HANDLE.set(app_handle.clone());
    }
}

impl ConfigStorePortAdapter {
    /// 从磁盘 config.json 重新读取 close_to_tray 并同步到 Tauri 托管状态。
    ///
    /// 用于 import_settings / reset_settings 等批量写入后刷新缓存。
    /// 优先解析信封格式（迁移后），回退到旧版 Config 格式以兼容未迁移文件。
    pub fn sync_close_to_tray_cache(app_handle: &tauri::AppHandle) {
        if let Some(state) = app_handle.try_state::<CloseToTrayState>() {
            let path = config_file_path();
            let value = std::fs::read_to_string(&path)
                .ok()
                .and_then(|raw| {
                    serde_json::from_str::<SettingsImportEnvelopeV1>(&raw)
                        .map(|e| e.backend.close_to_tray)
                        .or_else(|_| serde_json::from_str::<Config>(&raw).map(|c| c.close_to_tray))
                        .ok()
                })
                .unwrap_or(true);
            state.0.store(value, Ordering::SeqCst);
            tracing::info!(action = "settings_close_to_tray_synced", value = value);
        }
    }

    /// 直接将已知值写入 close_to_tray 内存缓存，无需读取磁盘。
    ///
    /// 用于 update_config_bool(key="close_to_tray") ——
    /// usecase 已将值写入磁盘，此方法仅同步内存缓存。
    pub fn notify_close_to_tray_changed(app_handle: &tauri::AppHandle, value: bool) {
        if let Some(state) = app_handle.try_state::<CloseToTrayState>() {
            state.0.store(value, Ordering::SeqCst);
            tracing::info!(action = "settings_close_to_tray_synced", value = value);
        }
    }
}

impl ConfigStorePort for ConfigStorePortAdapter {
    fn get_config<'a>(&'a self) -> ConfigStoreFuture<'a, String> {
        Box::pin(async { Ok(config_store::get_config().await) })
    }

    fn export_settings<'a>(&'a self) -> ConfigStoreFuture<'a, String> {
        Box::pin(async { Ok(config_store::export_settings().await) })
    }

    fn import_settings<'a>(&'a self, raw: String) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async move {
            config_store::import_settings(raw).await?;
            // 导入后同步 close_to_tray 内存缓存（data 层职责，避免 di/commands 感知缓存逻辑）。
            if let Some(app_handle) = APP_HANDLE.get() {
                Self::sync_close_to_tray_cache(app_handle);
            }
            Ok(())
        })
    }

    fn reset_settings<'a>(&'a self) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async {
            config_store::reset_settings().await?;
            // 重置后同步 close_to_tray 内存缓存。
            if let Some(app_handle) = APP_HANDLE.get() {
                Self::sync_close_to_tray_cache(app_handle);
            }
            Ok(())
        })
    }

    fn get_config_bool<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, bool> {
        Box::pin(async move { Ok(config_store::get_config_bool(key).await) })
    }

    fn get_config_u32<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, u32> {
        Box::pin(async move { Ok(config_store::get_config_u32(key).await) })
    }

    fn get_config_u64<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, u64> {
        Box::pin(async move { Ok(config_store::get_config_u64(key).await) })
    }

    fn get_config_string<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, String> {
        Box::pin(async move { Ok(config_store::get_config_string(key).await) })
    }

    fn get_server_config_string<'a>(
        &'a self,
        server_socket: String,
    ) -> ConfigStoreFuture<'a, String> {
        Box::pin(async move { Ok(config_store::get_server_config_string(server_socket).await) })
    }

    fn get_server_config_u32<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, u32> {
        Box::pin(async move { Ok(config_store::get_server_config_u32(server_socket).await) })
    }

    fn get_server_config_u64<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, u64> {
        Box::pin(async move { Ok(config_store::get_server_config_u64(server_socket).await) })
    }

    fn get_server_config_bool<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, bool> {
        Box::pin(async move { Ok(config_store::get_server_config_bool(server_socket).await) })
    }

    fn update_config_bool<'a>(&'a self, key: String, value: bool) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async move {
            config_store::update_config_bool(key.clone(), value).await?;
            // 更新 close_to_tray 时同步内存缓存（data 层职责）。
            if key == "close_to_tray"
                && let Some(app_handle) = APP_HANDLE.get()
            {
                Self::notify_close_to_tray_changed(app_handle, value);
            }
            Ok(())
        })
    }

    fn update_config_u32<'a>(&'a self, key: String, value: u32) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async move { config_store::update_config_u32(key, value).await })
    }

    fn update_config_string<'a>(&'a self, key: String, value: String) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async move { config_store::update_config_string(key, value).await })
    }
}
