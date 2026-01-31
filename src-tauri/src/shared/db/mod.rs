use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};
use tokio::sync::RwLock;

use crate::features::settings::get_config_value;

pub struct CPDatabase {
    pub connection: DatabaseConnection,
}

impl CPDatabase {
    pub async fn new(url: &str) -> anyhow::Result<Self> {
        let mut options = ConnectOptions::new(url);
        let mut max_conn =
            get_config_value::<u32>(String::from("database_pool_max_connections")).await;
        let mut min_conn =
            get_config_value::<u32>(String::from("database_pool_min_connections")).await;

        // Ensure pool sizes are valid; SQLx requires max_connections > 0.
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
            .max_connections(max_conn) // config
            .connect_timeout(std::time::Duration::from_secs(3))
            .idle_timeout(std::time::Duration::from_secs(10))
            .min_connections(min_conn) // config
            .max_lifetime(std::time::Duration::from_secs(3600));
        Ok(Self {
            connection: Database::connect(options).await?,
        })
    }
}

pub struct DbEntry {
    pub db: Arc<CPDatabase>,
    pub path: PathBuf,
}

#[derive(Default)]
pub struct DbRegistry {
    pub map: HashMap<String, Arc<DbEntry>>,
}

pub type SharedDbRegistry = Arc<RwLock<DbRegistry>>;

pub static DB_REGISTRY: OnceLock<SharedDbRegistry> = OnceLock::new();

pub fn init_db_registry() -> SharedDbRegistry {
    DB_REGISTRY
        .get_or_init(|| Arc::new(RwLock::new(DbRegistry::default())))
        .clone()
}

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
        "Opening database: key={}, path={}, url={}, cwd={}",
        key,
        path.to_string_lossy(),
        url,
        cwd.to_string_lossy()
    );
    let db = CPDatabase::new(&url).await?;
    let entry = DbEntry {
        db: Arc::new(db),
        path,
    };
    lock.map.insert(key.to_string(), Arc::new(entry));
    Ok(())
}

pub async fn get_db(key: &str) -> Result<Arc<CPDatabase>, String> {
    let registry = init_db_registry();
    let lock = registry.read().await;
    lock.map
        .get(key)
        .map(|entry| entry.db.clone())
        .ok_or_else(|| format!("Database not initialized for key: {}", key))
}

pub async fn get_entry(key: &str) -> Result<Arc<DbEntry>, String> {
    let registry = init_db_registry();
    let lock = registry.read().await;
    lock.map
        .get(key)
        .cloned()
        .ok_or_else(|| format!("Database not initialized for key: {}", key))
}

pub async fn close_db(key: &str) -> Result<(), String> {
    let registry = init_db_registry();
    let mut lock = registry.write().await;
    lock.map.remove(key);
    Ok(())
}

pub async fn remove_db(key: &str) -> Result<Option<PathBuf>, String> {
    let registry = init_db_registry();
    let mut lock = registry.write().await;
    Ok(lock.map.remove(key).map(|entry| entry.path.clone()))
}

fn sqlite_url_for_path(path: &PathBuf) -> String {
    // SQLx/SQLite expects forward slashes; handle absolute/relative paths on Windows.
    let path_str = path.to_string_lossy().replace('\\', "/");
    let mut url = if path.is_absolute() {
        if path_str.starts_with('/') {
            format!("sqlite://{path_str}")
        } else {
            // Windows absolute path like "D:/...": need triple slash to avoid treating "D" as host.
            format!("sqlite:///{path_str}")
        }
    } else {
        // Relative path must use sqlite:<path>
        format!("sqlite:{path_str}")
    };
    // Ensure SQLite creates the file if it doesn't exist.
    url.push_str("?mode=rwc");
    url
}

pub mod commands;
pub use commands::*;
