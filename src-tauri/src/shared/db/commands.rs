use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use sea_orm::{
    ConnectionTrait,
    DatabaseBackend,
    Statement,
    StatementBuilder,
    TransactionTrait,
    Value,
};
use tauri::command;

use super::{close_db, connect_named, get_db, get_entry, remove_db};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DbValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbExecuteRequest {
    pub key: String,
    pub sql: String,
    pub params: Option<Vec<DbValue>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbQueryRequest {
    pub key: String,
    pub sql: String,
    pub params: Option<Vec<DbValue>>,
    pub columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbStatement {
    pub sql: String,
    pub params: Option<Vec<DbValue>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbTransactionRequest {
    pub key: String,
    pub statements: Vec<DbStatement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbInitRequest {
    pub key: String,
    pub path: Option<String>,
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbExecResult {
    pub rows_affected: u64,
    pub last_insert_rowid: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbQueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<DbValue>>, // rows aligned to columns
}

#[derive(Debug, Clone)]
struct RawStatement {
    sql: String,
    values: Vec<Value>,
}

impl RawStatement {
    fn new(sql: String, values: Vec<Value>) -> Self {
        Self { sql, values }
    }
}

impl StatementBuilder for RawStatement {
    fn build(&self, db_backend: &DatabaseBackend) -> Statement {
        Statement::from_sql_and_values(*db_backend, self.sql.clone(), self.values.clone())
    }
}

fn sanitize_key(key: &str) -> String {
    let mut out = String::with_capacity(key.len());
    for ch in key.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "default".to_string()
    } else {
        out
    }
}

fn default_db_path(key: &str) -> PathBuf {
    let safe = sanitize_key(key);
    let mut base = base_db_dir();
    base.push(format!("{}.db", safe));
    base
}

fn base_db_dir() -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let parent = cwd
        .file_name()
        .map(|name| name == "src-tauri")
        .unwrap_or(false)
        .then(|| cwd.parent().map(|p| p.to_path_buf()))
        .flatten();
    let root = parent.unwrap_or(cwd);
    root.join("data").join("db")
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Failed to create db dir: {e}"))?;
    }
    Ok(())
}


fn map_values(params: Option<Vec<DbValue>>) -> Vec<Value> {
    params
        .unwrap_or_default()
        .into_iter()
        .map(|v| match v {
            DbValue::Null => Value::String(None),
            DbValue::Bool(v) => Value::Bool(Some(v)),
            DbValue::Number(v) => Value::Double(Some(v)),
            DbValue::String(v) => Value::String(Some(v)),
        })
        .collect()
}

fn row_get_value(row: &sea_orm::QueryResult, col: &str) -> DbValue {
    if let Ok(value) = row.try_get::<Option<bool>>("", col) {
        return value.map(DbValue::Bool).unwrap_or(DbValue::Null);
    }
    if let Ok(value) = row.try_get::<Option<i64>>("", col) {
        return value
            .map(|v| DbValue::Number(v as f64))
            .unwrap_or(DbValue::Null);
    }
    if let Ok(value) = row.try_get::<Option<f64>>("", col) {
        return value.map(DbValue::Number).unwrap_or(DbValue::Null);
    }
    if let Ok(value) = row.try_get::<Option<String>>("", col) {
        return value.map(DbValue::String).unwrap_or(DbValue::Null);
    }
    DbValue::Null
}

fn exec_result(result: &sea_orm::ExecResult) -> DbExecResult {
    DbExecResult {
        rows_affected: result.rows_affected(),
        last_insert_rowid: None,
    }
}

#[command]
pub async fn db_init(req: DbInitRequest) -> Result<(), String> {
    if req.key.trim().is_empty() {
        return Err("key is required".into());
    }

    let path = req
        .path
        .map(PathBuf::from)
        .unwrap_or_else(|| default_db_path(&req.key));
    ensure_parent_dir(&path)?;
    connect_named(&req.key, path).await.map_err(|e| e.to_string())?;
    run_migrations(&req.key, req.kind.as_deref()).await
}

#[command]
pub async fn db_execute(req: DbExecuteRequest) -> Result<DbExecResult, String> {
    let db = get_db(&req.key).await?;
    let conn = &db.connection;
    let stmt = RawStatement::new(req.sql, map_values(req.params));
    let result = conn.execute(&stmt).await.map_err(|e| e.to_string())?;
    Ok(exec_result(&result))
}

#[command]
pub async fn db_query(req: DbQueryRequest) -> Result<DbQueryResult, String> {
    if req.columns.is_empty() {
        return Err("columns is required".into());
    }

    let db = get_db(&req.key).await?;
    let conn = &db.connection;
    let stmt = RawStatement::new(req.sql, map_values(req.params));
    let rows = conn.query_all(&stmt).await.map_err(|e| e.to_string())?;
    let mut result_rows = Vec::with_capacity(rows.len());

    for row in rows.iter() {
        let mut values = Vec::with_capacity(req.columns.len());
        for col in req.columns.iter() {
            values.push(row_get_value(row, col));
        }
        result_rows.push(values);
    }

    Ok(DbQueryResult {
        columns: req.columns,
        rows: result_rows,
    })
}

#[command]
pub async fn db_transaction(req: DbTransactionRequest) -> Result<Vec<DbExecResult>, String> {
    let db = get_db(&req.key).await?;
    let conn = &db.connection;
    let txn = conn.begin().await.map_err(|e| e.to_string())?;
    let mut results = Vec::with_capacity(req.statements.len());

    for statement in req.statements {
        let stmt = RawStatement::new(statement.sql, map_values(statement.params));
        let res = txn.execute(&stmt).await.map_err(|e| e.to_string())?;
        results.push(exec_result(&res));
    }

    txn.commit().await.map_err(|e| e.to_string())?;
    Ok(results)
}

#[command]
pub async fn db_close(key: String) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("key is required".into());
    }
    close_db(&key).await
}

#[command]
pub async fn db_remove(key: String) -> Result<(), String> {
    if key.trim().is_empty() {
        return Err("key is required".into());
    }

    let path = remove_db(&key)
        .await?
        .unwrap_or_else(|| default_db_path(&key));

    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to remove db file: {e}"))?;
    }
    Ok(())
}

#[command]
pub async fn db_path(key: String) -> Result<String, String> {
    if key.trim().is_empty() {
        return Err("key is required".into());
    }
    let path = match get_entry_path(&key).await {
        Ok(path) => path,
        Err(_) => default_db_path(&key),
    };
    Ok(path.to_string_lossy().to_string())
}

async fn get_entry_path(key: &str) -> Result<PathBuf, String> {
    let entry = get_entry(key).await?;
    Ok(entry.path.clone())
}

fn now_ms() -> i64 {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    millis as i64
}

fn system_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        name: "system_base",
        statements: vec![
            r#"
            CREATE TABLE IF NOT EXISTS app_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            "#,
            r#"
            CREATE TABLE IF NOT EXISTS servers (
                server_socket TEXT PRIMARY KEY,
                server_name TEXT,
                ecc_public_key TEXT,
                last_connected_at INTEGER,
                db_key TEXT,
                db_path TEXT
            );
            "#,
        ],
    }]
}

fn server_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        name: "server_base",
        statements: vec![
            r#"
            CREATE TABLE IF NOT EXISTS channels (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                owner_id INTEGER,
                created_at INTEGER
            );
            "#,
            r#"
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                channel_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            "#,
            r#"
            CREATE INDEX IF NOT EXISTS idx_messages_channel_time
            ON messages(channel_id, created_at);
            "#,
            r#"
            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            "#,
        ],
    }]
}

struct Migration {
    version: i64,
    name: &'static str,
    statements: Vec<&'static str>,
}

async fn ensure_migrations_table(
    conn: &sea_orm::DatabaseConnection,
) -> Result<(), String> {
    let stmt = RawStatement::new(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at INTEGER NOT NULL
        );
        "#
        .to_string(),
        Vec::new(),
    );
    conn.execute(&stmt).await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn fetch_applied_versions(
    conn: &sea_orm::DatabaseConnection,
) -> Result<Vec<i64>, String> {
    let stmt = RawStatement::new(
        "SELECT version FROM schema_migrations ORDER BY version ASC".to_string(),
        Vec::new(),
    );
    let rows = conn.query_all(&stmt).await.map_err(|e| e.to_string())?;
    let mut versions = Vec::with_capacity(rows.len());
    for row in rows.iter() {
        if let Ok(Some(v)) = row.try_get::<Option<i64>>("", "version") {
            versions.push(v);
        }
    }
    Ok(versions)
}

async fn run_migrations(key: &str, kind: Option<&str>) -> Result<(), String> {
    let db = get_db(key).await?;
    let conn = &db.connection;
    ensure_migrations_table(conn).await?;
    let applied = fetch_applied_versions(conn).await?;

    let kind = kind
        .map(|v| v.trim().to_lowercase())
        .unwrap_or_else(|| {
            if key == "system" {
                "system".to_string()
            } else {
                "server".to_string()
            }
        });

    let migrations = if kind == "system" {
        system_migrations()
    } else {
        server_migrations()
    };

    for migration in migrations {
        if applied.contains(&migration.version) {
            continue;
        }
        let txn = conn.begin().await.map_err(|e| e.to_string())?;
        for statement in migration.statements.iter() {
            let stmt = RawStatement::new((*statement).to_string(), Vec::new());
            txn.execute(&stmt).await.map_err(|e| e.to_string())?;
        }
        let insert_stmt = RawStatement::new(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)".to_string(),
            vec![
                Value::BigInt(Some(migration.version)),
                Value::String(Some(migration.name.to_string())),
                Value::BigInt(Some(now_ms())),
            ],
        );
        txn.execute(&insert_stmt).await.map_err(|e| e.to_string())?;
        txn.commit().await.map_err(|e| e.to_string())?;
    }

    Ok(())
}
