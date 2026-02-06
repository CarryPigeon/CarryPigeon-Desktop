//! 模块入口：db。
//!
//! 说明：该文件负责导出子模块与组织依赖关系。
//!
//! 约定：注释中文，日志英文（tracing）。
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};
use tokio::sync::RwLock;

use crate::features::settings::get_config_value;

/// 数据库连接封装（统一持有 SeaORM 的 `DatabaseConnection`）。
///
/// # 说明
/// - 当前项目以 SQLite 为主，通过 SeaORM 统一执行 SQL 与事务。
/// - 连接池参数由配置项控制（见 `CPDatabase::new`）。
pub struct CPDatabase {
    /// SeaORM 数据库连接（内部包含连接池）。
    pub connection: DatabaseConnection,
}

impl CPDatabase {
    /// 通过 SQLite URL 创建数据库连接。
    ///
    /// # 参数
    /// - `url`：SQLite URL（通常由 `sqlite_url_for_path` 生成）。
    ///
    /// # 返回值
    /// - `Ok(Self)`：创建成功。
    /// - `Err(anyhow::Error)`：创建失败原因。
    ///
    /// # 说明
    /// - 连接池大小由配置项控制：
    ///   - `database_pool_max_connections`
    ///   - `database_pool_min_connections`
    /// - 若配置缺失或非法，会回退到安全默认值，避免底层驱动报错。
    pub async fn new(url: &str) -> anyhow::Result<Self> {
        let mut options = ConnectOptions::new(url);
        let mut max_conn =
            get_config_value::<u32>(String::from("database_pool_max_connections")).await;
        let mut min_conn =
            get_config_value::<u32>(String::from("database_pool_min_connections")).await;

        // 确保连接池参数合法：底层 SQLx 要求 max_connections > 0。
        if max_conn == 0 {
            max_conn = 5;
        }
        if min_conn == 0 {
            min_conn = 1;
        }
        if min_conn > max_conn {
            min_conn = max_conn;
        }

        options
            .max_connections(max_conn) // config（max）
            .connect_timeout(std::time::Duration::from_secs(3))
            .idle_timeout(std::time::Duration::from_secs(10))
            .min_connections(min_conn) // config（min）
            .max_lifetime(std::time::Duration::from_secs(3600));
        Ok(Self {
            connection: Database::connect(options).await?,
        })
    }
}

/// 已注册数据库条目（包含连接与对应的文件路径）。
pub struct DbEntry {
    /// 数据库连接。
    pub db: Arc<CPDatabase>,
    /// 数据库文件路径（用于展示/删除等）。
    pub path: PathBuf,
}

#[derive(Default)]
/// 数据库注册表（key -> DbEntry）。
pub struct DbRegistry {
    /// 连接表：key -> entry。
    pub map: HashMap<String, Arc<DbEntry>>,
}

/// 可共享的注册表句柄。
pub type SharedDbRegistry = Arc<RwLock<DbRegistry>>;

/// 全局数据库注册表（进程内单例）。
pub static DB_REGISTRY: OnceLock<SharedDbRegistry> = OnceLock::new();

/// 初始化并返回全局数据库注册表。
///
/// # 返回值
/// 返回共享注册表句柄（Arc + RwLock）。
pub fn init_db_registry() -> SharedDbRegistry {
    DB_REGISTRY
        .get_or_init(|| Arc::new(RwLock::new(DbRegistry::default())))
        .clone()
}

/// 以指定 key 与路径连接（或复用）数据库。
///
/// # 参数
/// - `key`：逻辑命名 key。
/// - `path`：数据库文件路径。
///
/// # 返回值
/// - `Ok(())`：连接成功（或已存在且路径一致）。
/// - `Err(anyhow::Error)`：连接失败或 key 已被不同路径占用。
///
/// # 说明
/// - 若 key 已存在且路径一致：视为幂等调用，直接返回成功。
/// - 若 key 已存在但路径不同：返回错误，避免同名 key 指向不同数据库造成混乱。
pub async fn connect_named(key: &str, path: PathBuf) -> anyhow::Result<()> {
    let registry = init_db_registry();
    let mut lock = registry.write().await;
    if let Some(existing) = lock.map.get(key) {
        if existing.path == path {
            return Ok(());
        }
        return Err(anyhow::anyhow!(
            "Database key already initialized with a different path"
        ));
    }
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let url = sqlite_url_for_path(&path);
    tracing::info!(
        action = "db_open",
        key = %key,
        path = %path.display(),
        url = %url,
        cwd = %cwd.display(),
        "Opening database",
    );
    let db = CPDatabase::new(&url).await?;
    let entry = DbEntry {
        db: Arc::new(db),
        path,
    };
    lock.map.insert(key.to_string(), Arc::new(entry));
    Ok(())
}

/// 获取指定 key 对应的数据库连接。
///
/// # 参数
/// - `key`：数据库连接 key。
///
/// # 返回值
/// - `Ok(Arc<CPDatabase>)`：数据库连接。
/// - `Err(String)`：未初始化或其他错误。
pub async fn get_db(key: &str) -> Result<Arc<CPDatabase>, String> {
    let registry = init_db_registry();
    let lock = registry.read().await;
    lock.map
        .get(key)
        .map(|entry| entry.db.clone())
        .ok_or_else(|| format!("Database not initialized for key: {}", key))
}

/// 获取指定 key 对应的数据库条目（含路径信息）。
///
/// # 参数
/// - `key`：数据库连接 key。
///
/// # 返回值
/// - `Ok(Arc<DbEntry>)`：条目。
/// - `Err(String)`：未初始化或其他错误。
pub async fn get_entry(key: &str) -> Result<Arc<DbEntry>, String> {
    let registry = init_db_registry();
    let lock = registry.read().await;
    lock.map
        .get(key)
        .cloned()
        .ok_or_else(|| format!("Database not initialized for key: {}", key))
}

/// 关闭并移除指定 key 的数据库连接。
///
/// # 参数
/// - `key`：数据库连接 key。
///
/// # 返回值
/// - `Ok(())`：移除成功（即便 key 不存在也视为成功）。
/// - `Err(String)`：当前实现不会返回错误（预留接口形态）。
pub async fn close_db(key: &str) -> Result<(), String> {
    let registry = init_db_registry();
    let mut lock = registry.write().await;
    lock.map.remove(key);
    Ok(())
}

/// 移除指定 key 的数据库连接，并返回其路径（若存在）。
///
/// # 参数
/// - `key`：数据库连接 key。
///
/// # 返回值
/// - `Ok(Some(PathBuf))`：存在该 key，返回其数据库路径。
/// - `Ok(None)`：不存在该 key。
/// - `Err(String)`：当前实现不会返回错误（预留接口形态）。
pub async fn remove_db(key: &str) -> Result<Option<PathBuf>, String> {
    let registry = init_db_registry();
    let mut lock = registry.write().await;
    Ok(lock.map.remove(key).map(|entry| entry.path.clone()))
}

fn sqlite_url_for_path(path: &Path) -> String {
    // SQLx/SQLite 期望使用正斜杠；这里统一处理 Windows 的反斜杠路径。
    let path_str = path.to_string_lossy().replace('\\', "/");
    let mut url = if path.is_absolute() {
        if path_str.starts_with('/') {
            format!("sqlite://{path_str}")
        } else {
            // Windows 绝对路径如 "D:/..."：需要三斜杠避免将 "D" 解析为 host。
            format!("sqlite:///{path_str}")
        }
    } else {
        // 相对路径需要使用 sqlite:<path> 形式。
        format!("sqlite:{path_str}")
    };
    // 确保 SQLite 在文件不存在时创建文件。
    url.push_str("?mode=rwc");
    url
}

pub mod commands;
pub use commands::*;
