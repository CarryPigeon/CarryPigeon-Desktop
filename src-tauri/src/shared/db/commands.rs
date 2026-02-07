//! shared｜数据库：commands。
//!
//! 约定：注释中文，日志英文（tracing）。
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use sea_orm::{
    ConnectionTrait, DatabaseBackend, Statement, StatementBuilder, TransactionTrait, Value,
};
use tauri::command;

use crate::shared::error::{CommandResult, command_error, to_command_error};

use super::{close_db, connect_named, get_db, get_entry, remove_db};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
/// 数据库参数/结果值的跨端表示（Rust ⇄ 前端）。
///
/// # 说明
/// - 前端通过 invoke 传入的参数需要可序列化；这里用 `serde(untagged)` 以简化 JSON 形态。
/// - 该类型会被映射为 SeaORM/SQLx 可执行的 `Value`，用于参数化 SQL。
pub enum DbValue {
    /// 空值（NULL）。
    Null,
    /// 布尔值。
    Bool(bool),
    /// 数值（使用 `f64` 承载，便于与 JS number 对齐）。
    Number(f64),
    /// 字符串。
    String(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// 执行类 SQL 的请求参数（INSERT/UPDATE/DELETE 等）。
///
/// # 说明
/// - `key`：数据库连接 key（由 `db_init` 初始化）。
/// - `sql`：要执行的 SQL 文本。
/// - `params`：可选参数数组（按占位符顺序传递）。
pub struct DbExecuteRequest {
    /// 数据库连接 key（由 `db_init` 初始化）。
    pub key: String,
    /// SQL 文本。
    pub sql: String,
    /// SQL 参数（可选）。
    pub params: Option<Vec<DbValue>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// 查询类 SQL 的请求参数（SELECT）。
///
/// # 说明
/// - `columns` 用于指定需要从结果中抽取的列，并决定返回 rows 的列顺序。
pub struct DbQueryRequest {
    /// 数据库连接 key（由 `db_init` 初始化）。
    pub key: String,
    /// SQL 文本。
    pub sql: String,
    /// SQL 参数（可选）。
    pub params: Option<Vec<DbValue>>,
    /// 需要读取的列名列表（返回 rows 将严格按此顺序对齐）。
    pub columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// 事务内的单条 SQL 语句描述。
pub struct DbStatement {
    /// SQL 文本。
    pub sql: String,
    /// SQL 参数（可选）。
    pub params: Option<Vec<DbValue>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// 事务请求参数：在同一事务内按序执行多条语句。
pub struct DbTransactionRequest {
    /// 数据库连接 key（由 `db_init` 初始化）。
    pub key: String,
    /// 待执行的语句列表（按顺序执行）。
    pub statements: Vec<DbStatement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// 初始化数据库连接的请求参数。
///
/// # 说明
/// - `path` 为空时会自动落到项目根目录下的默认路径（`data/db/{key}.db`）。
/// - `kind` 用于决定初始化迁移（system/server），详见 `run_migrations`。
pub struct DbInitRequest {
    /// 数据库连接 key（逻辑命名）。
    pub key: String,
    /// 数据库文件路径（可选）。
    pub path: Option<String>,
    /// 数据库类型/用途标记（可选）。
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// 执行类 SQL 的结果。
pub struct DbExecResult {
    /// 受影响的行数。
    pub rows_affected: u64,
    /// 最后插入行 id（若可用）；当前实现不保证返回。
    pub last_insert_rowid: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// 查询类 SQL 的结果。
///
/// # 说明
/// - `rows` 为二维数组，内层数组与 `columns` 一一对齐。
pub struct DbQueryResult {
    /// 列名（返回 rows 的对齐基准）。
    pub columns: Vec<String>,
    /// 行数据（与 columns 对齐）。
    pub rows: Vec<Vec<DbValue>>,
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

fn ensure_parent_dir(path: &Path) -> CommandResult<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| to_command_error("DB_DIR_CREATE_FAILED", e))?;
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
/// 初始化（或连接）一个命名数据库，并按需执行迁移。
///
/// # 参数
/// - `req`：初始化请求（key/path/kind）。
///
/// # 返回值
/// - `Ok(())`：初始化成功。
/// - `Err(String)`：初始化失败原因。
///
/// # 说明
/// - 前端应先调用该命令，再调用 `db_execute/db_query/db_transaction` 等命令。
/// - 若 `path` 为空，将使用默认路径 `data/db/{key}.db`。
pub async fn db_init(req: DbInitRequest) -> CommandResult<()> {
    if req.key.trim().is_empty() {
        return Err(command_error("DB_KEY_REQUIRED", "key is required"));
    }

    let path = req
        .path
        .map(PathBuf::from)
        .unwrap_or_else(|| default_db_path(&req.key));
    ensure_parent_dir(&path)?;
    connect_named(&req.key, path)
        .await
        .map_err(|e| to_command_error("DB_CONNECT_FAILED", e))?;
    run_migrations(&req.key, req.kind.as_deref())
        .await
        .map_err(|e| to_command_error("DB_MIGRATE_FAILED", e))
}

#[command]
/// 执行一条 SQL（非查询）。
///
/// # 参数
/// - `req`：执行请求（key/sql/params）。
///
/// # 返回值
/// - `Ok(DbExecResult)`：执行结果（行数等）。
/// - `Err(String)`：执行失败原因。
pub async fn db_execute(req: DbExecuteRequest) -> CommandResult<DbExecResult> {
    let db = get_db(&req.key)
        .await
        .map_err(|e| to_command_error("DB_GET_CONNECTION_FAILED", e))?;
    let conn = &db.connection;
    let stmt = RawStatement::new(req.sql, map_values(req.params));
    let result = conn
        .execute(&stmt)
        .await
        .map_err(|e| to_command_error("DB_EXECUTE_FAILED", e))?;
    Ok(exec_result(&result))
}

#[command]
/// 执行一条查询 SQL，并按指定列名抽取结果。
///
/// # 参数
/// - `req`：查询请求（key/sql/params/columns）。
///
/// # 返回值
/// - `Ok(DbQueryResult)`：查询结果（columns + rows）。
/// - `Err(String)`：查询失败原因。
///
/// # 说明
/// - 为减少跨端类型推断复杂度，调用方必须显式提供 `columns`。
/// - 若 `columns` 为空，直接返回错误。
pub async fn db_query(req: DbQueryRequest) -> CommandResult<DbQueryResult> {
    if req.columns.is_empty() {
        return Err(command_error("DB_COLUMNS_REQUIRED", "columns is required"));
    }

    let db = get_db(&req.key)
        .await
        .map_err(|e| to_command_error("DB_GET_CONNECTION_FAILED", e))?;
    let conn = &db.connection;
    let stmt = RawStatement::new(req.sql, map_values(req.params));
    let rows = conn
        .query_all(&stmt)
        .await
        .map_err(|e| to_command_error("DB_QUERY_FAILED", e))?;
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
/// 在同一事务内按序执行多条 SQL（非查询）。
///
/// # 参数
/// - `req`：事务请求（key/statements）。
///
/// # 返回值
/// - `Ok(Vec<DbExecResult>)`：每条语句的执行结果列表（与输入 statements 顺序一致）。
/// - `Err(String)`：执行失败原因。
pub async fn db_transaction(req: DbTransactionRequest) -> CommandResult<Vec<DbExecResult>> {
    let db = get_db(&req.key)
        .await
        .map_err(|e| to_command_error("DB_GET_CONNECTION_FAILED", e))?;
    let conn = &db.connection;
    let txn = conn
        .begin()
        .await
        .map_err(|e| to_command_error("DB_TRANSACTION_BEGIN_FAILED", e))?;
    let mut results = Vec::with_capacity(req.statements.len());

    for statement in req.statements {
        let stmt = RawStatement::new(statement.sql, map_values(statement.params));
        let res = txn
            .execute(&stmt)
            .await
            .map_err(|e| to_command_error("DB_TRANSACTION_EXECUTE_FAILED", e))?;
        results.push(exec_result(&res));
    }

    txn.commit()
        .await
        .map_err(|e| to_command_error("DB_TRANSACTION_COMMIT_FAILED", e))?;
    Ok(results)
}

#[command]
/// 关闭并释放一个命名数据库连接（从注册表移除）。
///
/// # 参数
/// - `key`：数据库连接 key。
///
/// # 返回值
/// - `Ok(())`：关闭成功。
/// - `Err(String)`：关闭失败原因。
///
/// # 说明
/// 该操作会从内存注册表移除连接；连接对象被 drop 后由底层驱动完成资源释放。
pub async fn db_close(key: String) -> CommandResult<()> {
    if key.trim().is_empty() {
        return Err(command_error("DB_KEY_REQUIRED", "key is required"));
    }
    close_db(&key)
        .await
        .map_err(|e| to_command_error("DB_CLOSE_FAILED", e))
}

#[command]
/// 移除一个命名数据库连接，并尝试删除对应的数据库文件。
///
/// # 参数
/// - `key`：数据库连接 key。
///
/// # 返回值
/// - `Ok(())`：删除成功或文件不存在。
/// - `Err(String)`：删除失败原因。
///
/// # 说明
/// - 该命令会先从注册表移除连接，再删除文件。
/// - 若注册表中不存在该 key，则使用默认路径作为删除目标兜底。
pub async fn db_remove(key: String) -> CommandResult<()> {
    if key.trim().is_empty() {
        return Err(command_error("DB_KEY_REQUIRED", "key is required"));
    }

    let path = remove_db(&key)
        .await
        .map_err(|e| to_command_error("DB_REMOVE_FAILED", e))?
        .unwrap_or_else(|| default_db_path(&key));

    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| to_command_error("DB_FILE_REMOVE_FAILED", e))?;
    }
    Ok(())
}

#[command]
/// 获取命名数据库对应的文件路径。
///
/// # 参数
/// - `key`：数据库连接 key。
///
/// # 返回值
/// - `Ok(String)`：数据库文件路径（字符串）。
/// - `Err(String)`：获取失败原因。
///
/// # 说明
/// - 若注册表中存在该 key，则返回初始化时的路径。
/// - 若不存在，则返回默认路径 `data/db/{key}.db`。
pub async fn db_path(key: String) -> CommandResult<String> {
    if key.trim().is_empty() {
        return Err(command_error("DB_KEY_REQUIRED", "key is required"));
    }
    let path = match get_entry_path(&key).await {
        Ok(path) => path,
        Err(_) => default_db_path(&key),
    };
    Ok(path.to_string_lossy().to_string())
}

async fn get_entry_path(key: &str) -> CommandResult<PathBuf> {
    let entry = get_entry(key)
        .await
        .map_err(|e| to_command_error("DB_ENTRY_LOOKUP_FAILED", e))?;
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

async fn ensure_migrations_table(conn: &sea_orm::DatabaseConnection) -> CommandResult<()> {
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
    conn.execute(&stmt)
        .await
        .map_err(|e| to_command_error("DB_MIGRATIONS_TABLE_ENSURE_FAILED", e))?;
    Ok(())
}

async fn fetch_applied_versions(conn: &sea_orm::DatabaseConnection) -> CommandResult<Vec<i64>> {
    let stmt = RawStatement::new(
        "SELECT version FROM schema_migrations ORDER BY version ASC".to_string(),
        Vec::new(),
    );
    let rows = conn
        .query_all(&stmt)
        .await
        .map_err(|e| to_command_error("DB_MIGRATIONS_FETCH_APPLIED_FAILED", e))?;
    let mut versions = Vec::with_capacity(rows.len());
    for row in rows.iter() {
        if let Ok(Some(v)) = row.try_get::<Option<i64>>("", "version") {
            versions.push(v);
        }
    }
    Ok(versions)
}

async fn run_migrations(key: &str, kind: Option<&str>) -> CommandResult<()> {
    let db = get_db(key)
        .await
        .map_err(|e| to_command_error("DB_MIGRATIONS_DB_GET_FAILED", e))?;
    let conn = &db.connection;
    ensure_migrations_table(conn).await?;
    let applied = fetch_applied_versions(conn).await?;

    let kind = kind.map(|v| v.trim().to_lowercase()).unwrap_or_else(|| {
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
        let txn = conn
            .begin()
            .await
            .map_err(|e| to_command_error("DB_MIGRATIONS_TXN_BEGIN_FAILED", e))?;
        for statement in migration.statements.iter() {
            let stmt = RawStatement::new((*statement).to_string(), Vec::new());
            txn.execute(&stmt)
                .await
                .map_err(|e| to_command_error("DB_MIGRATIONS_STATEMENT_EXECUTE_FAILED", e))?;
        }
        let insert_stmt = RawStatement::new(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
                .to_string(),
            vec![
                Value::BigInt(Some(migration.version)),
                Value::String(Some(migration.name.to_string())),
                Value::BigInt(Some(now_ms())),
            ],
        );
        txn.execute(&insert_stmt)
            .await
            .map_err(|e| to_command_error("DB_MIGRATIONS_RECORD_INSERT_FAILED", e))?;
        txn.commit()
            .await
            .map_err(|e| to_command_error("DB_MIGRATIONS_TXN_COMMIT_FAILED", e))?;
    }

    Ok(())
}
