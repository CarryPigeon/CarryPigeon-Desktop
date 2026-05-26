//! 共享应用数据目录，在 setup() 期间解析一次。
//!
//! 所有需要持久化存储路径的模块应通过 `get_app_data_dir()` 读取，
//! 避免依赖当前工作目录推导路径。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::path::PathBuf;
use std::sync::RwLock;

static APP_DATA_DIR: RwLock<Option<PathBuf>> = RwLock::new(None);

/// app_data_dir 错误类型。
#[derive(Debug, Clone)]
pub enum AppDataDirError {
    LockPoisoned,
    NotInitialized,
}

impl std::fmt::Display for AppDataDirError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::LockPoisoned => write!(f, "app_data_dir 锁已污染"),
            Self::NotInitialized => write!(
                f,
                "app_data_dir 未初始化，请在 Tauri setup() 中调用 shared::app_data_dir::init_app_data_dir()"
            ),
        }
    }
}

impl std::error::Error for AppDataDirError {}

/// 初始化共享应用数据目录。
///
/// 必须在 Tauri `setup()` 期间、任何 command handler 运行前调用。
pub fn init_app_data_dir(dir: PathBuf) -> Result<(), AppDataDirError> {
    let mut guard = APP_DATA_DIR
        .write()
        .map_err(|_| AppDataDirError::LockPoisoned)?;
    *guard = Some(dir);
    Ok(())
}

/// 重置应用数据目录（仅测试使用）。
pub fn reset_app_data_dir() -> Result<(), AppDataDirError> {
    let mut guard = APP_DATA_DIR
        .write()
        .map_err(|_| AppDataDirError::LockPoisoned)?;
    *guard = None;
    Ok(())
}

/// 返回已解析的应用数据目录克隆。
pub fn get_app_data_dir() -> Result<PathBuf, AppDataDirError> {
    APP_DATA_DIR
        .read()
        .map_err(|_| AppDataDirError::LockPoisoned)?
        .clone()
        .ok_or(AppDataDirError::NotInitialized)
}
