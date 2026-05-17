//! settings｜数据层：config_store。
//!
//! 约定：注释中文，日志英文（tracing）。
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::any::TypeId;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;

use crate::features::settings::domain::settings_schema::{
    SETTINGS_SCHEMA_VERSION, SettingsBackendStateV1, SettingsImportEnvelopeV1,
    SettingsLocalCacheStateV1, SettingsLocale, SettingsServerConfigV1, SettingsTheme,
    parse_settings_import_envelope,
};

const CONFIG_FILE: &str = "./config.json";

fn config_write_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn config_temp_path(path: &Path) -> PathBuf {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    path.with_extension(format!("tmp-{}-{}", std::process::id(), stamp))
}

#[cfg(windows)]
fn replace_file_windows(src: &Path, dst: &Path) -> std::io::Result<()> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    unsafe extern "system" {
        fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
    }

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;

    fn to_wide(value: &OsStr) -> Vec<u16> {
        let mut wide: Vec<u16> = value.encode_wide().collect();
        wide.push(0);
        wide
    }

    let src_wide = to_wide(src.as_os_str());
    let dst_wide = to_wide(dst.as_os_str());
    let ok = unsafe {
        MoveFileExW(
            src_wide.as_ptr(),
            dst_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok != 0 {
        return Ok(());
    }
    Err(std::io::Error::last_os_error())
}

async fn atomic_write_config(path: &Path, payload: &str) -> anyhow::Result<()> {
    let tmp = config_temp_path(path);
    let mut file = tokio::fs::File::create(&tmp)
        .await
        .map_err(|error| anyhow::anyhow!("Failed to create temp config file: {}", error))?;
    file.write_all(payload.as_bytes())
        .await
        .map_err(|error| anyhow::anyhow!("Failed to write temp config file: {}", error))?;
    file.sync_all()
        .await
        .map_err(|error| anyhow::anyhow!("Failed to sync temp config file: {}", error))?;
    drop(file);

    if tokio::fs::rename(&tmp, path).await.is_ok() {
        return Ok(());
    }
    #[cfg(windows)]
    {
        replace_file_windows(&tmp, path).map_err(|error| {
            anyhow::anyhow!("Failed to replace config via MoveFileExW: {}", error)
        })?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err(anyhow::anyhow!(
            "Failed to rename temp config file to target: {}",
            path.display()
        ))
    }
}

fn legacy_config_to_backend_state(config: &Config) -> SettingsBackendStateV1 {
    SettingsBackendStateV1 {
        auto_login: config.auto_login,
        auto_launch: config.auto_launch,
        close_to_tray: config.close_to_tray,
        check_for_updates: config.check_for_updates,
        email_notifications: config.email_notifications,
        desktop_notifications: config.desktop_notifications,
        server_port: None,
        server_list: config
            .server_list
            .iter()
            .map(|server| SettingsServerConfigV1 {
                server_socket: server.server_socket.clone(),
                server_port: server.server_port,
                server_name: server.server_name.clone(),
                account: server.account.clone(),
                user_name: server.user_name.clone(),
                user_avatar: server.user_avatar.clone(),
            })
            .collect(),
    }
}

fn default_settings_envelope() -> SettingsImportEnvelopeV1 {
    SettingsImportEnvelopeV1 {
        schema_version: SETTINGS_SCHEMA_VERSION,
        backend: legacy_config_to_backend_state(&Config::default()),
        local_cache: SettingsLocalCacheStateV1 {
            theme: SettingsTheme::Patchbay,
            locale: SettingsLocale::ZhCn,
        },
    }
}

fn settings_theme_to_string(theme: SettingsTheme) -> &'static str {
    match theme {
        SettingsTheme::Patchbay => "patchbay",
        SettingsTheme::Legacy => "legacy",
        SettingsTheme::Light => "light",
    }
}

fn settings_theme_from_string(raw: &str) -> Option<SettingsTheme> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "patchbay" => Some(SettingsTheme::Patchbay),
        "legacy" => Some(SettingsTheme::Legacy),
        "light" => Some(SettingsTheme::Light),
        _ => None,
    }
}

fn default_config_json() -> String {
    serde_json::to_string_pretty(&default_settings_envelope()).unwrap_or_else(|error| {
        tracing::error!(action = "settings_config_default_serialize_failed", error = %error);
        "{}".to_string()
    })
}

async fn ensure_config_file_exists() -> String {
    let config_file = Path::new(CONFIG_FILE);
    let default_json = default_config_json();

    match tokio::fs::write(config_file, &default_json).await {
        Ok(_) => {
            tracing::info!(
                action = "settings_config_file_initialized",
                path = CONFIG_FILE
            );
            default_json
        }
        Err(error) => {
            tracing::error!(
                action = "settings_config_file_initialize_failed",
                path = CONFIG_FILE,
                error = %error
            );
            default_json
        }
    }
}

fn envelope_from_legacy_config(config: Config) -> SettingsImportEnvelopeV1 {
    SettingsImportEnvelopeV1 {
        schema_version: SETTINGS_SCHEMA_VERSION,
        backend: legacy_config_to_backend_state(&config),
        local_cache: SettingsLocalCacheStateV1 {
            theme: SettingsTheme::Patchbay,
            locale: SettingsLocale::ZhCn,
        },
    }
}

fn format_envelope_json(envelope: &SettingsImportEnvelopeV1) -> anyhow::Result<String> {
    serde_json::to_string_pretty(envelope)
        .map_err(|error| anyhow::anyhow!("Failed to serialize settings envelope: {}", error))
}

fn envelope_value_for_key(envelope: &SettingsImportEnvelopeV1, key: &str) -> Option<Value> {
    match key {
        "auto_login" => Some(Value::Bool(envelope.backend.auto_login)),
        "auto_launch" => Some(Value::Bool(envelope.backend.auto_launch)),
        "close_to_tray" => Some(Value::Bool(envelope.backend.close_to_tray)),
        "check_for_updates" => Some(Value::Bool(envelope.backend.check_for_updates)),
        "email_notifications" => Some(Value::Bool(envelope.backend.email_notifications)),
        "desktop_notifications" => Some(Value::Bool(envelope.backend.desktop_notifications)),
        "server_port" => envelope
            .backend
            .server_port
            .map(|p| Value::Number(serde_json::Number::from(p as u64))),
        "theme" => Some(Value::String(
            settings_theme_to_string(envelope.local_cache.theme).to_string(),
        )),
        _ => None,
    }
}

fn update_envelope_bool(envelope: &mut SettingsImportEnvelopeV1, key: &str, value: bool) -> bool {
    match key {
        "auto_login" => envelope.backend.auto_login = value,
        "auto_launch" => envelope.backend.auto_launch = value,
        "close_to_tray" => envelope.backend.close_to_tray = value,
        "check_for_updates" => envelope.backend.check_for_updates = value,
        "email_notifications" => envelope.backend.email_notifications = value,
        "desktop_notifications" => envelope.backend.desktop_notifications = value,
        _ => return false,
    }
    true
}

fn update_envelope_string(envelope: &mut SettingsImportEnvelopeV1, key: &str, value: &str) -> bool {
    match key {
        "theme" => {
            if let Some(theme) = settings_theme_from_string(value) {
                envelope.local_cache.theme = theme;
                return true;
            }
            false
        }
        _ => false,
    }
}

fn update_envelope_u32(envelope: &mut SettingsImportEnvelopeV1, key: &str, value: u32) -> bool {
    match key {
        "server_port" => {
            envelope.backend.server_port = Some(value as u16);
            true
        }
        _ => false,
    }
}

async fn persist_envelope(envelope: &SettingsImportEnvelopeV1) -> anyhow::Result<()> {
    let config_file = Path::new(CONFIG_FILE);
    let json = format_envelope_json(envelope)?;
    atomic_write_config(config_file, &json).await
}

async fn load_current_envelope() -> SettingsImportEnvelopeV1 {
    let config_file = Path::new(CONFIG_FILE);
    let raw = match tokio::fs::read_to_string(config_file).await {
        Ok(data) if !data.trim().is_empty() => data,
        Ok(_) => {
            tracing::warn!(action = "settings_config_file_empty", path = CONFIG_FILE);
            let default_json = ensure_config_file_exists().await;
            return parse_settings_import_envelope(&default_json)
                .unwrap_or_else(|_| default_settings_envelope());
        }
        Err(error) => {
            tracing::warn!(
                action = "settings_config_file_read_failed",
                path = CONFIG_FILE,
                error = %error
            );
            let default_json = ensure_config_file_exists().await;
            return parse_settings_import_envelope(&default_json)
                .unwrap_or_else(|_| default_settings_envelope());
        }
    };

    if let Ok(envelope) = parse_settings_import_envelope(&raw) {
        return envelope;
    }

    match serde_json::from_str::<Config>(&raw) {
        Ok(legacy) => {
            let envelope = envelope_from_legacy_config(legacy);
            if let Err(error) = persist_envelope(&envelope).await {
                tracing::warn!(
                    action = "settings_config_migration_persist_failed",
                    path = CONFIG_FILE,
                    error = %error
                );
            }
            envelope
        }
        Err(error) => {
            tracing::warn!(
                action = "settings_config_parse_failed",
                path = CONFIG_FILE,
                error = %error
            );
            let default_json = ensure_config_file_exists().await;
            parse_settings_import_envelope(&default_json)
                .unwrap_or_else(|_| default_settings_envelope())
        }
    }
}

/// 单个服务器配置条目（用于本地配置文件持久化）。
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// 服务器 socket 地址（例如 `socket://host:port` 或 `https://...`）。
    pub server_socket: String,
    /// 服务器端口（历史字段，可能与 socket 重复）。
    pub server_port: u16,
    /// 服务器展示名称。
    pub server_name: String,
    /// 账号（历史字段/预留）。
    pub account: String,
    /// 用户名（历史字段/预留）。
    pub user_name: String,
    /// 用户头像（历史字段/预留）。
    pub user_avatar: String,
}

/// 应用配置文件结构（`config.json`）。
#[derive(Default, Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    /// 是否自动登录。
    pub auto_login: bool,
    /// 是否开机自启。
    pub auto_launch: bool,
    /// 关闭窗口时是否最小化到托盘。
    pub close_to_tray: bool,
    /// 是否自动检查更新。
    pub check_for_updates: bool,
    /// 是否接收邮件通知。
    pub email_notifications: bool,
    /// 是否接收桌面通知。
    pub desktop_notifications: bool,
    /// 服务器列表（历史字段）。
    pub server_list: Vec<ServerConfig>,
}

/// 读取（或初始化）配置文件内容。
///
/// # 返回值
/// - 返回版本化 settings envelope 的 JSON 字符串；若文件不存在或损坏，会自动迁移/重置为默认 envelope。
pub async fn get_config() -> String {
    let envelope = load_current_envelope().await;
    format_envelope_json(&envelope).unwrap_or_else(|error| {
        tracing::error!(action = "settings_config_export_failed", error = %error);
        "{}".to_string()
    })
}

/// 导出版本化 settings envelope（storage 层 helper）。
pub async fn export_settings() -> String {
    get_config().await
}

/// 导入版本化 settings envelope（storage 层 helper）。
pub async fn import_settings(raw: String) -> anyhow::Result<()> {
    let _guard = config_write_lock().lock().await;
    let envelope = parse_settings_import_envelope(&raw)?;
    persist_envelope(&envelope).await
}

/// 重置 settings 到默认值（storage 层 helper）。
pub async fn reset_settings() -> anyhow::Result<()> {
    let _guard = config_write_lock().lock().await;
    persist_envelope(&default_settings_envelope()).await
}

/// 配置值抽取器：将 JSON 值转换为指定类型，并支持反向写回 JSON。
///
/// # 说明
/// - `extract`：从 `serde_json::Value` 中提取目标类型；
/// - `into_json`：将目标类型转换为可写入配置文件的 JSON 值。
pub trait ConfigValueExtractor<T> {
    /// 从 JSON 值中提取类型 `T`。
    fn extract(value: &Value) -> T;
    /// 将当前值转换为 JSON，以便写入配置文件。
    fn into_json(self) -> Value;
}

impl ConfigValueExtractor<u32> for u32 {
    fn extract(value: &Value) -> u32 {
        value.as_number().and_then(|v| v.as_u64()).unwrap_or(0) as u32
    }
    fn into_json(self) -> Value {
        Value::Number(serde_json::Number::from(self))
    }
}

impl ConfigValueExtractor<u64> for u64 {
    fn extract(value: &Value) -> u64 {
        value.as_number().and_then(|v| v.as_u64()).unwrap_or(0)
    }
    fn into_json(self) -> Value {
        Value::Number(serde_json::Number::from(self))
    }
}

impl ConfigValueExtractor<String> for String {
    fn extract(value: &Value) -> String {
        value.as_str().unwrap_or("").to_string()
    }
    fn into_json(self) -> Value {
        Value::String(self)
    }
}

impl ConfigValueExtractor<bool> for bool {
    fn extract(value: &Value) -> bool {
        value.as_bool().unwrap_or(false)
    }
    fn into_json(self) -> Value {
        Value::Bool(self)
    }
}

/// 异步读取配置文件中的指定键值。
///
/// # 参数
/// - `key`：配置键名（顶层字段）。
///
/// # 返回值
/// - 返回提取后的值；缺失/非法时返回默认值。
pub async fn get_config_value<T>(key: String) -> T
where
    T: ConfigValueExtractor<T> + Default,
{
    let envelope = load_current_envelope().await;
    envelope_value_for_key(&envelope, &key)
        .map(|value| T::extract(&value))
        .unwrap_or_default()
}

/// 异步读取配置文件中的 server_list，并按 server_socket 匹配返回对应条目。
///
/// # 参数
/// - `server_socket`：服务端 socket（用于匹配 server_list 中的条目）。
///
/// # 返回值
/// - 返回提取后的值；缺失/非法时返回默认值。
///
/// # 说明
/// - 历史格式：`server_list` 元素为字符串（直接返回字符串值）；
/// - 对象格式：按类型提取明确字段，`String -> server_socket`、`u32/u64 -> server_port`、
///   `bool -> enabled/is_enabled/is_default/default`（若字段缺失则回退旧语义）。
pub async fn get_server_config_value<T>(server_socket: String) -> T
where
    T: ConfigValueExtractor<T> + Default + 'static,
{
    let envelope = load_current_envelope().await;
    let want = server_socket.trim();
    for server in &envelope.backend.server_list {
        if server.server_socket.trim() != want {
            continue;
        }

        if TypeId::of::<T>() == TypeId::of::<String>() {
            return T::extract(&Value::String(server.server_socket.clone()));
        }
        if TypeId::of::<T>() == TypeId::of::<u32>() || TypeId::of::<T>() == TypeId::of::<u64>() {
            return T::extract(&Value::Number(serde_json::Number::from(server.server_port)));
        }
        if TypeId::of::<T>() == TypeId::of::<bool>() {
            return T::extract(&Value::Bool(false));
        }
        break;
    }

    T::default()
}

/// 异步更新配置文件中的指定 bool 值。
pub async fn update_config_bool(key: String, value: bool) -> anyhow::Result<()> {
    let _guard = config_write_lock().lock().await;
    let mut envelope = load_current_envelope().await;
    if !update_envelope_bool(&mut envelope, &key, value) {
        tracing::error!(action = "settings_config_update_unsupported", key = %key);
        return Err(anyhow::anyhow!("Unsupported config key: {}", key));
    }
    persist_envelope(&envelope).await
}

/// 异步更新配置文件中的指定 u32 值。
pub async fn update_config_u32(key: String, value: u32) -> anyhow::Result<()> {
    let _guard = config_write_lock().lock().await;
    if key == "server_port" && (value == 0 || value > 65535) {
        return Err(anyhow::anyhow!(
            "Invalid server_port value: {} (must be 1..=65535)",
            value
        ));
    }
    let mut envelope = load_current_envelope().await;
    if !update_envelope_u32(&mut envelope, &key, value) {
        tracing::error!(action = "settings_config_update_unsupported", key = %key, value);
        return Err(anyhow::anyhow!("Unsupported config key: {}", key));
    }
    persist_envelope(&envelope).await
}

/// 异步更新配置文件中的指定 u64 值。
pub async fn update_config_u64(key: String, value: u64) -> anyhow::Result<()> {
    let _guard = config_write_lock().lock().await;
    tracing::error!(action = "settings_config_update_unsupported", key = %key, value);
    Err(anyhow::anyhow!("Unsupported config key for u64 update: {}", key))
}

/// 异步更新配置文件中的指定 string 值。
pub async fn update_config_string(key: String, value: String) -> anyhow::Result<()> {
    let _guard = config_write_lock().lock().await;
    let mut envelope = load_current_envelope().await;
    if !update_envelope_string(&mut envelope, &key, &value) {
        tracing::error!(action = "settings_config_update_unsupported", key = %key);
        return Err(anyhow::anyhow!("Unsupported config key: {}", key));
    }
    persist_envelope(&envelope).await
}
/// 读取 bool 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 bool；缺失/非法时返回默认值（false）。
pub async fn get_config_bool(key: String) -> bool {
    get_config_value::<bool>(key).await
}

/// 读取 u32 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 u32；缺失/非法时返回默认值（0）。
pub async fn get_config_u32(key: String) -> u32 {
    get_config_value::<u32>(key).await
}

/// 读取 u64 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 u64；缺失/非法时返回默认值（0）。
pub async fn get_config_u64(key: String) -> u64 {
    get_config_value::<u64>(key).await
}

/// 读取 string 类型配置值（顶层字段）。
///
/// # 参数
/// - `key`：配置键名。
///
/// # 返回值
/// 返回 string；缺失/非法时返回默认值（空字符串）。
pub async fn get_config_string(key: String) -> String {
    get_config_value::<String>(key).await
}

/// 读取与 server_socket 相关的 string 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 string；缺失/非法时返回默认值（空字符串）。
pub async fn get_server_config_string(server_socket: String) -> String {
    get_server_config_value::<String>(server_socket).await
}

/// 读取与 server_socket 相关的 u32 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 u32；缺失/非法时返回默认值（0）。
pub async fn get_server_config_u32(server_socket: String) -> u32 {
    get_server_config_value::<u32>(server_socket).await
}

/// 读取与 server_socket 相关的 u64 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 u64；缺失/非法时返回默认值（0）。
pub async fn get_server_config_u64(server_socket: String) -> u64 {
    get_server_config_value::<u64>(server_socket).await
}

/// 读取与 server_socket 相关的 bool 值（历史 API）。
///
/// # 参数
/// - `server_socket`：服务端 socket。
///
/// # 返回值
/// 返回 bool；缺失/非法时返回默认值（false）。
pub async fn get_server_config_bool(server_socket: String) -> bool {
    get_server_config_value::<bool>(server_socket).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::settings::domain::settings_schema::{
        SettingsTheme, parse_settings_import_envelope,
    };
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn test_lock() -> std::sync::MutexGuard<'static, ()> {
        TEST_LOCK
            .get_or_init(|| Mutex::new(()))
            .lock()
            .expect("test lock")
    }

    fn test_temp_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        std::env::temp_dir().join(format!("carrypigeon-settings-config-{nanos}"))
    }

    fn legacy_payload() -> String {
        serde_json::json!({
            "auto_login": true,
            "auto_launch": false,
            "close_to_tray": true,
            "check_for_updates": false,
            "server_list": [
                {
                    "server_socket": "socket://example.test:11443",
                    "server_port": 11443,
                    "server_name": "Example",
                    "account": "acc",
                    "user_name": "user",
                    "user_avatar": "avatar"
                }
            ]
        })
        .to_string()
    }

    fn envelope_payload() -> String {
        serde_json::json!({
            "schemaVersion": SETTINGS_SCHEMA_VERSION,
            "backend": {
                "autoLogin": true,
                "autoLaunch": false,
                "closeToTray": true,
                "checkForUpdates": true,
                "emailNotifications": true,
                "desktopNotifications": false,
                "serverList": [
                    {
                        "serverSocket": "socket://example.test:11443",
                        "serverPort": 11443,
                        "serverName": "Example",
                        "account": "acc",
                        "userName": "user",
                        "userAvatar": "avatar"
                    }
                ]
            },
            "localCache": {
                "theme": "patchbay"
            }
        })
        .to_string()
    }

    fn assert_no_temp_files(dir: &Path) {
        let temp_files: Vec<_> = std::fs::read_dir(dir)
            .expect("read dir")
            .filter_map(Result::ok)
            .map(|entry| entry.file_name())
            .map(|name| name.to_string_lossy().to_string())
            .filter(|name| name.contains("tmp-"))
            .collect();
        assert!(
            temp_files.is_empty(),
            "unexpected temp files left behind: {temp_files:?}"
        );
    }

    #[tokio::test]
    async fn legacy_config_is_migrated_to_versioned_envelope() {
        let _guard = test_lock();
        let prev = std::env::current_dir().expect("cwd");
        let dir = test_temp_dir();
        std::fs::create_dir_all(&dir).expect("temp dir");
        std::env::set_current_dir(&dir).expect("set cwd");
        std::fs::write("config.json", legacy_payload()).expect("write legacy config");

        let exported = get_config().await;
        let envelope = parse_settings_import_envelope(&exported).expect("envelope");

        assert_eq!(envelope.schema_version, SETTINGS_SCHEMA_VERSION);
        assert!(envelope.backend.auto_login);
        assert!(!envelope.backend.auto_launch);
        assert!(envelope.backend.close_to_tray);
        assert!(!envelope.backend.check_for_updates);
        assert_eq!(envelope.backend.server_list.len(), 1);
        assert_eq!(envelope.local_cache.theme, SettingsTheme::Patchbay);

        let disk = std::fs::read_to_string("config.json").expect("migrated config");
        let disk_envelope = parse_settings_import_envelope(&disk).expect("disk envelope");
        assert_eq!(disk_envelope, envelope);
        assert_no_temp_files(&dir);

        std::env::set_current_dir(prev).expect("restore cwd");
    }

    #[tokio::test]
    async fn import_export_round_trip_persists_envelope() {
        let _guard = test_lock();
        let prev = std::env::current_dir().expect("cwd");
        let dir = test_temp_dir();
        std::fs::create_dir_all(&dir).expect("temp dir");
        std::env::set_current_dir(&dir).expect("set cwd");

        let payload = envelope_payload();
        import_settings(payload.clone()).await.expect("import");

        let exported = export_settings().await;
        let imported = parse_settings_import_envelope(&payload).expect("payload envelope");
        let exported_envelope = parse_settings_import_envelope(&exported).expect("export envelope");

        assert_eq!(exported_envelope, imported);
        assert!(get_config_bool("auto_login".to_string()).await);
        assert_eq!(get_config_string("theme".to_string()).await, "patchbay");
        assert_no_temp_files(&dir);

        std::env::set_current_dir(prev).expect("restore cwd");
    }

    #[tokio::test]
    async fn import_rejects_version_mismatch_and_unknown_fields() {
        let _guard = test_lock();
        let prev = std::env::current_dir().expect("cwd");
        let dir = test_temp_dir();
        std::fs::create_dir_all(&dir).expect("temp dir");
        std::env::set_current_dir(&dir).expect("set cwd");

        let version_mismatch = serde_json::json!({
            "schemaVersion": 999,
            "backend": {
                "autoLogin": true,
                "autoLaunch": false,
                "closeToTray": true,
                "checkForUpdates": true,
                "emailNotifications": true,
                "desktopNotifications": false,
                "serverList": []
            },
            "localCache": {
                "theme": "patchbay"
            }
        })
        .to_string();
        let error = import_settings(version_mismatch)
            .await
            .expect_err("version mismatch");
        assert!(
            error
                .to_string()
                .contains("Unsupported settings schema version")
        );

        let unknown_field = serde_json::json!({
            "schemaVersion": SETTINGS_SCHEMA_VERSION,
            "backend": {
                "autoLogin": true,
                "autoLaunch": false,
                "closeToTray": true,
                "checkForUpdates": true,
                "emailNotifications": true,
                "desktopNotifications": false,
                "serverList": [],
                "unknownField": true
            },
            "localCache": {
                "theme": "patchbay"
            }
        })
        .to_string();
        let error = import_settings(unknown_field)
            .await
            .expect_err("unknown field");
        assert!(
            error
                .to_string()
                .contains("Failed to parse settings import payload")
        );

        std::env::set_current_dir(prev).expect("restore cwd");
    }

    #[tokio::test]
    async fn reset_settings_writes_default_envelope() {
        let _guard = test_lock();
        let prev = std::env::current_dir().expect("cwd");
        let dir = test_temp_dir();
        std::fs::create_dir_all(&dir).expect("temp dir");
        std::env::set_current_dir(&dir).expect("set cwd");

        reset_settings().await.expect("reset");
        let exported = get_config().await;
        let envelope = parse_settings_import_envelope(&exported).expect("envelope");

        assert_eq!(envelope.schema_version, SETTINGS_SCHEMA_VERSION);
        assert!(!envelope.backend.auto_login);
        assert!(!envelope.backend.auto_launch);
        assert!(!envelope.backend.close_to_tray);
        assert!(!envelope.backend.check_for_updates);
        assert!(!envelope.backend.email_notifications);
        assert!(!envelope.backend.desktop_notifications);
        assert!(envelope.backend.server_list.is_empty());
        assert_eq!(envelope.local_cache.theme, SettingsTheme::Patchbay);
        assert_no_temp_files(&dir);

        std::env::set_current_dir(prev).expect("restore cwd");
    }

    #[tokio::test]
    async fn update_config_bool_and_theme_are_persisted_atomically() {
        let _guard = test_lock();
        let prev = std::env::current_dir().expect("cwd");
        let dir = test_temp_dir();
        std::fs::create_dir_all(&dir).expect("temp dir");
        std::env::set_current_dir(&dir).expect("set cwd");

        update_config_bool("auto_login".to_string(), true)
            .await
            .expect("update bool");
        update_config_string("theme".to_string(), "legacy".to_string())
            .await
            .expect("update theme");
        update_config_string("theme".to_string(), "light".to_string())
            .await
            .expect("update light theme");

        assert!(get_config_bool("auto_login".to_string()).await);
        assert_eq!(get_config_string("theme".to_string()).await, "light");

        let disk = std::fs::read_to_string("config.json").expect("config file");
        let envelope = parse_settings_import_envelope(&disk).expect("disk envelope");
        assert!(envelope.backend.auto_login);
        assert_eq!(envelope.local_cache.theme, SettingsTheme::Light);
        assert!(!envelope.backend.email_notifications);
        assert_no_temp_files(&dir);

        std::env::set_current_dir(prev).expect("restore cwd");
    }
}
