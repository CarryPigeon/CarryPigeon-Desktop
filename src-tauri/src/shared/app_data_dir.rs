//! 共享应用数据目录，在 setup() 期间解析一次。
//!
//! 所有需要持久化存储路径的模块应通过 `get_app_data_dir()` 读取，
//! 避免依赖当前工作目录推导路径。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::path::PathBuf;
use std::sync::RwLock;

static APP_DATA_DIR: RwLock<Option<PathBuf>> = RwLock::new(None);

/// 初始化共享应用数据目录。
///
/// 必须在 Tauri `setup()` 期间、任何 command handler 运行前调用。
pub fn init_app_data_dir(dir: PathBuf) {
    let mut guard = APP_DATA_DIR
        .write()
        .expect("app_data_dir 锁已污染");
    *guard = Some(dir);
}

/// 重置应用数据目录（仅测试使用）。
pub fn reset_app_data_dir() {
    let mut guard = APP_DATA_DIR
        .write()
        .expect("app_data_dir 锁已污染");
    *guard = None;
}

/// 返回已解析的应用数据目录克隆。
///
/// # Panics
///
/// 若 `init_app_data_dir()` 尚未调用则会 panic。
/// 这是有意的：setup() 保证在命令处理之前运行。
pub fn get_app_data_dir() -> PathBuf {
    APP_DATA_DIR
        .read()
        .expect("app_data_dir 锁已污染")
        .clone()
        .expect("app_data_dir 未初始化，请在 Tauri setup() 中调用 shared::app_data_dir::init_app_data_dir()")
}
