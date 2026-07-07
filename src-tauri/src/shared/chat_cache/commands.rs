//! chat_cache｜加密聊天缓存命令。

use aes_gcm::{Aes256Gcm, Nonce, aead::Aead, aead::KeyInit};
use anyhow::{Context, Result};
use keyring_core::Entry;
use sea_orm::{
    ConnectionTrait, Database, DatabaseBackend, Statement, StatementBuilder, TransactionTrait,
    Value,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use crate::shared::error::{CommandResult, command_error, to_command_error};

const SERVICE: &str = "carrypigeon-desktop";
const ACCOUNT: &str = "chat-cache-master-key";

/// 聊天缓存条目数上限。
/// 生产环境保持 8192；测试环境降低以便验证淘汰逻辑。
#[cfg(not(test))]
const CHAT_CACHE_MAX_ENTRIES: usize = 8_192;
#[cfg(test)]
const CHAT_CACHE_MAX_ENTRIES: usize = 5;

static CHAT_CACHE_DB: OnceLock<Mutex<Option<Arc<sea_orm::DatabaseConnection>>>> = OnceLock::new();
static CHAT_CACHE_MASTER_KEY: OnceLock<Mutex<Option<[u8; 32]>>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCachePutRequest {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCacheRemoveRequest {
    pub key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCacheRemoveManyRequest {
    pub keys: Vec<String>,
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

fn now_ms() -> i64 {
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    millis as i64
}

fn base_db_dir() -> Result<PathBuf, crate::shared::app_data_dir::AppDataDirError> {
    Ok(crate::shared::app_data_dir::get_app_data_dir()?.join("db"))
}

fn chat_cache_path() -> Result<PathBuf, crate::shared::app_data_dir::AppDataDirError> {
    Ok(base_db_dir()?.join("chat_cache.db"))
}

async fn ensure_parent_dir(path: &Path) -> Result<()> {
    if let Some(dir) = path.parent() {
        tokio::fs::create_dir_all(dir)
            .await
            .with_context(|| format!("Failed to create db parent dir: {}", dir.display()))?;
    }
    Ok(())
}

fn chat_cache_db_cell() -> &'static Mutex<Option<Arc<sea_orm::DatabaseConnection>>> {
    CHAT_CACHE_DB.get_or_init(|| Mutex::new(None))
}

async fn db() -> Result<Arc<sea_orm::DatabaseConnection>> {
    if let Some(conn) = chat_cache_db_cell()
        .lock()
        .map_err(|_| anyhow::anyhow!("Failed to lock chat cache db"))?
        .as_ref()
        .cloned()
    {
        return Ok(conn);
    }

    let path = chat_cache_path().map_err(|e| anyhow::anyhow!("{e}"))?;
    ensure_parent_dir(&path).await?;
    let path_str = path.to_string_lossy().replace('\\', "/");
    let url = if path.is_absolute() {
        if path_str.starts_with('/') {
            format!("sqlite://{path_str}?mode=rwc")
        } else {
            format!("sqlite:///{path_str}?mode=rwc")
        }
    } else {
        format!("sqlite:{path_str}?mode=rwc")
    };
    let conn = Arc::new(Database::connect(url).await?);

    // 应用 SQLite 性能 PRAGMA
    if let Err(e) = conn
        .execute_unprepared(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA cache_size = -8000;
             PRAGMA busy_timeout = 5000;",
        )
        .await
    {
        tracing::warn!(action = "db_chat_cache_pragma_set_failed", error = %e);
    }

    let stmt = RawStatement::new(
        r#"
        CREATE TABLE IF NOT EXISTS chat_cache (
            key TEXT PRIMARY KEY,
            nonce_hex TEXT NOT NULL,
            value_hex TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#
        .to_string(),
        Vec::new(),
    );
    conn.execute(&stmt).await?;

    let mut guard = chat_cache_db_cell()
        .lock()
        .map_err(|_| anyhow::anyhow!("Failed to lock chat cache db"))?;
    if let Some(existing) = guard.as_ref() {
        return Ok(existing.clone());
    }
    *guard = Some(conn.clone());
    Ok(conn)
}

fn master_key(create_if_missing: bool) -> Result<Option<[u8; 32]>> {
    let cell = CHAT_CACHE_MASTER_KEY.get_or_init(|| Mutex::new(None));
    if let Some(key) = *cell
        .lock()
        .map_err(|_| anyhow::anyhow!("Failed to lock chat cache master key"))?
    {
        return Ok(Some(key));
    }
    let entry = match Entry::new(SERVICE, ACCOUNT) {
        Ok(entry) => entry,
        Err(err) if is_missing_secure_storage_error_message(&err.to_string()) => {
            if create_if_missing {
                return Err(anyhow::anyhow!(
                    "secure storage is unavailable, cannot persist chat cache encryption key"
                ));
            }
            return Ok(None);
        }
        Err(err) => return Err(err.into()),
    };
    match entry.get_password() {
        Ok(secret) => {
            let bytes = hex::decode(secret.trim()).context("Invalid chat cache master key")?;
            let key: [u8; 32] = bytes
                .try_into()
                .map_err(|_| anyhow::anyhow!("Invalid chat cache master key length"))?;
            cache_master_key(cell, key);
            Ok(Some(key))
        }
        Err(err) if is_missing_secure_storage_error_message(&err.to_string()) => {
            if !create_if_missing {
                return Ok(None);
            }
            let key = generate_master_key(cell)?;
            match entry.set_password(&hex::encode(key)) {
                Ok(()) => Ok(Some(key)),
                Err(err) if is_missing_secure_storage_error_message(&err.to_string()) => {
                    Err(anyhow::anyhow!(
                        "secure storage is unavailable, cannot persist chat cache encryption key"
                    ))
                }
                Err(err) => Err(err.into()),
            }
        }
        Err(err) => Err(err.into()),
    }
}

fn is_missing_secure_storage_error_message(message: &str) -> bool {
    message.contains("not found")
        || message.contains("NoEntry")
        || message.contains("No matching entry found in secure storage")
        || message.contains("No default store has been set")
        || message.contains("cannot search or create entries")
}

fn cache_master_key(cell: &Mutex<Option<[u8; 32]>>, key: [u8; 32]) {
    if let Ok(mut guard) = cell.lock() {
        *guard = Some(key);
    }
}

fn generate_master_key(cell: &Mutex<Option<[u8; 32]>>) -> Result<[u8; 32]> {
    let mut key = [0u8; 32];
    getrandom::fill(&mut key)
        .map_err(|_| anyhow::anyhow!("Failed to generate chat cache master key"))?;
    cache_master_key(cell, key);
    Ok(key)
}

fn clear_master_key_cache() {
    if let Some(cell) = CHAT_CACHE_MASTER_KEY.get()
        && let Ok(mut guard) = cell.lock()
    {
        *guard = None;
    }
}

fn forget_master_key() -> Result<()> {
    clear_master_key_cache();
    let entry = match Entry::new(SERVICE, ACCOUNT) {
        Ok(entry) => entry,
        Err(err) if is_missing_secure_storage_error_message(&err.to_string()) => return Ok(()),
        Err(err) => return Err(err.into()),
    };
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(err) if is_missing_secure_storage_error_message(&err.to_string()) => Ok(()),
        Err(err) => Err(err.into()),
    }
}

fn encrypt_value(key_bytes: &[u8; 32], plaintext: &str) -> Result<(String, String)> {
    let cipher =
        Aes256Gcm::new_from_slice(key_bytes).context("Failed to init chat cache cipher")?;
    let mut nonce = [0u8; 12];
    getrandom::fill(&mut nonce).map_err(|_| anyhow::anyhow!("Failed to generate nonce"))?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext.as_bytes())
        .map_err(|_| anyhow::anyhow!("Failed to encrypt chat cache value"))?;
    Ok((hex::encode(nonce), hex::encode(ciphertext)))
}

fn decrypt_value(key_bytes: &[u8; 32], nonce_hex: &str, value_hex: &str) -> Result<String> {
    let cipher =
        Aes256Gcm::new_from_slice(key_bytes).context("Failed to init chat cache cipher")?;
    let nonce_bytes = hex::decode(nonce_hex).context("Invalid chat cache nonce")?;
    let value_bytes = hex::decode(value_hex).context("Invalid chat cache ciphertext")?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), value_bytes.as_ref())
        .map_err(|_| anyhow::anyhow!("Failed to decrypt chat cache value"))?;
    String::from_utf8(plaintext).context("Invalid utf-8 chat cache value")
}

async fn ensure_schema() -> Result<()> {
    let conn = db().await?;
    let stmt = RawStatement::new(
        r#"
        CREATE TABLE IF NOT EXISTS chat_cache (
            key TEXT PRIMARY KEY,
            nonce_hex TEXT NOT NULL,
            value_hex TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#
        .to_string(),
        Vec::new(),
    );
    conn.execute(&stmt).await?;
    Ok(())
}

async fn load_all_rows() -> Result<Vec<sea_orm::prelude::QueryResult>> {
    let conn = db().await?;
    let stmt = RawStatement::new(
        "SELECT key, nonce_hex, value_hex FROM chat_cache ORDER BY updated_at ASC".to_string(),
        Vec::new(),
    );
    Ok(conn.query_all(&stmt).await?)
}

#[tauri::command]
pub async fn chat_cache_load_all() -> CommandResult<HashMap<String, String>> {
    ensure_schema().await.map_err(|e| {
        to_command_error("CHAT_CACHE_INIT_FAILED", "error.chat_cache_init_failed", e)
    })?;
    let rows = load_all_rows().await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_QUERY_FAILED",
            "error.chat_cache_query_failed",
            e,
        )
    })?;
    if rows.is_empty() {
        return Ok(HashMap::new());
    }
    let Some(key_bytes) = master_key(false)
        .map_err(|e| to_command_error("CHAT_CACHE_KEY_FAILED", "error.chat_cache_key_failed", e))?
    else {
        return Ok(HashMap::new());
    };
    let mut out = HashMap::with_capacity(rows.len());
    for row in rows.iter() {
        let key = row
            .try_get::<Option<String>>("", "key")
            .ok()
            .flatten()
            .unwrap_or_default();
        let nonce_hex = row
            .try_get::<Option<String>>("", "nonce_hex")
            .ok()
            .flatten()
            .unwrap_or_default();
        let value_hex = row
            .try_get::<Option<String>>("", "value_hex")
            .ok()
            .flatten()
            .unwrap_or_default();
        if key.is_empty() || nonce_hex.is_empty() || value_hex.is_empty() {
            continue;
        }
        if let Ok(value) = decrypt_value(&key_bytes, &nonce_hex, &value_hex) {
            out.insert(key, value);
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn chat_cache_clear_all() -> CommandResult<()> {
    ensure_schema().await.map_err(|e| {
        to_command_error("CHAT_CACHE_INIT_FAILED", "error.chat_cache_init_failed", e)
    })?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", "error.chat_cache_db_failed", e))?;
    let txn = conn.begin().await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_TXN_BEGIN_FAILED",
            "error.chat_cache_txn_begin_failed",
            e,
        )
    })?;
    let stmt = RawStatement::new("DELETE FROM chat_cache".to_string(), Vec::new());
    txn.execute(&stmt).await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_DELETE_FAILED",
            "error.chat_cache_delete_failed",
            e,
        )
    })?;
    txn.commit().await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_TXN_COMMIT_FAILED",
            "error.chat_cache_txn_commit_failed",
            e,
        )
    })?;
    forget_master_key().map_err(|e| {
        to_command_error(
            "CHAT_CACHE_KEY_CLEAR_FAILED",
            "error.chat_cache_key_clear_failed",
            e,
        )
    })?;
    Ok(())
}

#[tauri::command]
pub async fn chat_cache_get(key: String) -> CommandResult<Option<String>> {
    ensure_schema().await.map_err(|e| {
        to_command_error("CHAT_CACHE_INIT_FAILED", "error.chat_cache_init_failed", e)
    })?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", "error.chat_cache_db_failed", e))?;
    let key = key.trim();
    if key.is_empty() {
        return Err(command_error(
            "CHAT_CACHE_KEY_REQUIRED",
            "error.chat_cache_key_required",
        ));
    }
    let stmt = RawStatement::new(
        "SELECT nonce_hex, value_hex FROM chat_cache WHERE key = ?".to_string(),
        vec![Value::String(Some(key.to_string()))],
    );
    let rows = conn.query_all(&stmt).await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_QUERY_FAILED",
            "error.chat_cache_query_failed",
            e,
        )
    })?;
    if rows.is_empty() {
        return Ok(None);
    }
    let row = &rows[0];
    let nonce_hex = row
        .try_get::<Option<String>>("", "nonce_hex")
        .ok()
        .flatten()
        .unwrap_or_default();
    let value_hex = row
        .try_get::<Option<String>>("", "value_hex")
        .ok()
        .flatten()
        .unwrap_or_default();
    if nonce_hex.is_empty() || value_hex.is_empty() {
        return Ok(None);
    }
    let Some(key_bytes) = master_key(false)
        .map_err(|e| to_command_error("CHAT_CACHE_KEY_FAILED", "error.chat_cache_key_failed", e))?
    else {
        return Ok(None);
    };
    let value = decrypt_value(&key_bytes, &nonce_hex, &value_hex).map_err(|e| {
        to_command_error(
            "CHAT_CACHE_DECRYPT_FAILED",
            "error.chat_cache_decrypt_failed",
            e,
        )
    })?;
    Ok(Some(value))
}

/// 如果聊天缓存条目数超过上限，按 `updated_at` 升序淘汰最旧的条目，直到剩余量约为上限的 80%。
///
/// 说明：
/// - 在写入事务内执行，避免 put 与 prune 之间出现不一致。
/// - 淘汰失败仅记录日志，不阻塞正常写入，防止因统计查询异常导致缓存不可用。
async fn prune_chat_cache_if_needed<C>(conn: &C) -> Result<()>
where
    C: ConnectionTrait + TransactionTrait,
{
    let max = CHAT_CACHE_MAX_ENTRIES;
    if max == 0 {
        return Ok(());
    }

    let count_stmt = RawStatement::new(
        "SELECT COUNT(*) AS cnt FROM chat_cache".to_string(),
        Vec::new(),
    );
    let count: i64 = conn
        .query_all(&count_stmt)
        .await?
        .first()
        .and_then(|row| row.try_get::<Option<i64>>("", "cnt").ok().flatten())
        .unwrap_or(0);

    let max_i64 = max as i64;
    if count <= max_i64 {
        return Ok(());
    }

    let target = (max as u64).saturating_mul(4).saturating_div(5).max(1) as i64;
    let to_remove = count.saturating_sub(target);
    if to_remove <= 0 {
        return Ok(());
    }

    let delete_stmt = RawStatement::new(
        "DELETE FROM chat_cache WHERE key IN (SELECT key FROM chat_cache ORDER BY updated_at ASC LIMIT ?)"
            .to_string(),
        vec![Value::BigInt(Some(to_remove))],
    );
    if let Err(e) = conn.execute(&delete_stmt).await {
        tracing::warn!(
            action = "db_chat_cache_prune_failed",
            count = count,
            to_remove = to_remove,
            error = %e
        );
    } else {
        tracing::debug!(
            action = "db_chat_cache_pruned",
            count = count,
            to_remove = to_remove,
            target = target
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn chat_cache_put(req: ChatCachePutRequest) -> CommandResult<()> {
    ensure_schema().await.map_err(|e| {
        to_command_error("CHAT_CACHE_INIT_FAILED", "error.chat_cache_init_failed", e)
    })?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", "error.chat_cache_db_failed", e))?;
    let key = req.key.trim();
    if key.is_empty() {
        return Err(command_error(
            "CHAT_CACHE_KEY_REQUIRED",
            "error.chat_cache_key_required",
        ));
    }
    let Some(key_bytes) = master_key(true)
        .map_err(|e| to_command_error("CHAT_CACHE_KEY_FAILED", "error.chat_cache_key_failed", e))?
    else {
        return Err(command_error(
            "CHAT_CACHE_KEY_FAILED",
            "error.chat_cache_key_failed",
        ));
    };
    let (nonce_hex, value_hex) = encrypt_value(&key_bytes, &req.value).map_err(|e| {
        to_command_error(
            "CHAT_CACHE_ENCRYPT_FAILED",
            "error.chat_cache_encrypt_failed",
            e,
        )
    })?;
    let txn = conn.begin().await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_TXN_BEGIN_FAILED",
            "error.chat_cache_txn_begin_failed",
            e,
        )
    })?;
    let stmt = RawStatement::new(
        "INSERT INTO chat_cache (key, nonce_hex, value_hex, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET nonce_hex = excluded.nonce_hex, value_hex = excluded.value_hex, updated_at = excluded.updated_at".to_string(),
        vec![
            Value::String(Some(key.to_string())),
            Value::String(Some(nonce_hex)),
            Value::String(Some(value_hex)),
            Value::BigInt(Some(now_ms())),
        ],
    );
    txn.execute(&stmt).await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_WRITE_FAILED",
            "error.chat_cache_write_failed",
            e,
        )
    })?;
    // 写入成功后按需淘汰旧条目，防止缓存无限增长。
    let _ = prune_chat_cache_if_needed(&txn).await;
    txn.commit().await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_TXN_COMMIT_FAILED",
            "error.chat_cache_txn_commit_failed",
            e,
        )
    })?;
    Ok(())
}

#[tauri::command]
pub async fn chat_cache_remove(req: ChatCacheRemoveRequest) -> CommandResult<()> {
    ensure_schema().await.map_err(|e| {
        to_command_error("CHAT_CACHE_INIT_FAILED", "error.chat_cache_init_failed", e)
    })?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", "error.chat_cache_db_failed", e))?;
    let key = req.key.trim();
    if key.is_empty() {
        return Err(command_error(
            "CHAT_CACHE_KEY_REQUIRED",
            "error.chat_cache_key_required",
        ));
    }
    let stmt = RawStatement::new(
        "DELETE FROM chat_cache WHERE key = ?".to_string(),
        vec![Value::String(Some(key.to_string()))],
    );
    conn.execute(&stmt).await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_DELETE_FAILED",
            "error.chat_cache_delete_failed",
            e,
        )
    })?;
    Ok(())
}

#[tauri::command]
pub async fn chat_cache_remove_many(req: ChatCacheRemoveManyRequest) -> CommandResult<()> {
    ensure_schema().await.map_err(|e| {
        to_command_error("CHAT_CACHE_INIT_FAILED", "error.chat_cache_init_failed", e)
    })?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", "error.chat_cache_db_failed", e))?;
    let txn = conn.begin().await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_TXN_BEGIN_FAILED",
            "error.chat_cache_txn_begin_failed",
            e,
        )
    })?;
    for key in req.keys {
        let key = key.trim().to_string();
        if key.is_empty() {
            continue;
        }
        let stmt = RawStatement::new(
            "DELETE FROM chat_cache WHERE key = ?".to_string(),
            vec![Value::String(Some(key))],
        );
        txn.execute(&stmt).await.map_err(|e| {
            to_command_error(
                "CHAT_CACHE_DELETE_FAILED",
                "error.chat_cache_delete_failed",
                e,
            )
        })?;
    }
    txn.commit().await.map_err(|e| {
        to_command_error(
            "CHAT_CACHE_TXN_COMMIT_FAILED",
            "error.chat_cache_txn_commit_failed",
            e,
        )
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

    async fn test_lock() -> tokio::sync::MutexGuard<'static, ()> {
        TEST_LOCK
            .get_or_init(|| tokio::sync::Mutex::new(()))
            .lock()
            .await
    }

    fn test_app_data_dir() -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_millis();
        std::env::temp_dir().join(format!("carrypigeon-chat-cache-test-{millis}"))
    }

    fn init_test_app_data_dir() -> PathBuf {
        let dir = test_app_data_dir();
        let _ = crate::shared::app_data_dir::init_app_data_dir(dir.clone());
        dir
    }

    fn reset_test_state() {
        if let Some(cell) = CHAT_CACHE_DB.get()
            && let Ok(mut guard) = cell.lock()
        {
            *guard = None;
        }
        let _ = forget_master_key();
        let _ = crate::shared::app_data_dir::reset_app_data_dir();
    }

    fn ensure_test_master_key() -> [u8; 32] {
        let cell = CHAT_CACHE_MASTER_KEY.get_or_init(|| Mutex::new(None));
        if let Some(key) = cell.lock().ok().and_then(|g| *g) {
            return key;
        }
        generate_master_key(cell).expect("generate test master key")
    }

    #[tokio::test]
    async fn load_all_empty_db_without_master_key() {
        let _guard = test_lock().await;
        let app_dir = init_test_app_data_dir();
        std::fs::create_dir_all(&app_dir).expect("app dir");
        reset_test_state();
        let _ = crate::shared::app_data_dir::init_app_data_dir(app_dir.clone());
        let result = chat_cache_load_all().await.expect("load all");
        assert!(result.is_empty());
        reset_test_state();
    }

    #[tokio::test]
    async fn clear_all_removes_data_and_key() {
        let _guard = test_lock().await;
        let app_dir = init_test_app_data_dir();
        std::fs::create_dir_all(&app_dir).expect("app dir");
        reset_test_state();
        let _ = crate::shared::app_data_dir::init_app_data_dir(app_dir);

        ensure_test_master_key();
        chat_cache_put(ChatCachePutRequest {
            key: "chat-cache-test-key".to_string(),
            value: "secret message".to_string(),
        })
        .await
        .expect("put");

        let loaded = chat_cache_load_all().await.expect("load before clear");
        assert_eq!(
            loaded.get("chat-cache-test-key").map(String::as_str),
            Some("secret message")
        );

        chat_cache_clear_all().await.expect("clear all");

        let after = chat_cache_load_all().await.expect("load after clear");
        assert!(after.is_empty());

        reset_test_state();
    }

    #[tokio::test]
    async fn load_all_treats_missing_master_key_as_empty_cache() {
        let _guard = test_lock().await;
        let app_dir = init_test_app_data_dir();
        std::fs::create_dir_all(&app_dir).expect("app dir");
        reset_test_state();
        let _ = crate::shared::app_data_dir::init_app_data_dir(app_dir.clone());

        ensure_test_master_key();
        chat_cache_put(ChatCachePutRequest {
            key: "chat-cache-missing-key-test".to_string(),
            value: "secret message".to_string(),
        })
        .await
        .expect("put");

        reset_test_state();
        let _ = crate::shared::app_data_dir::init_app_data_dir(app_dir);
        let loaded = chat_cache_load_all().await.expect("load after missing key");
        assert!(loaded.is_empty());

        ensure_test_master_key();
        chat_cache_put(ChatCachePutRequest {
            key: "chat-cache-missing-key-test".to_string(),
            value: "secret message 2".to_string(),
        })
        .await
        .expect("put after missing key");

        let loaded_after_recovery = chat_cache_load_all().await.expect("load after recovery");
        assert_eq!(
            loaded_after_recovery
                .get("chat-cache-missing-key-test")
                .map(String::as_str),
            Some("secret message 2")
        );

        reset_test_state();
    }

    #[tokio::test]
    async fn get_treats_missing_master_key_as_missing_value() {
        let _guard = test_lock().await;
        let app_dir = init_test_app_data_dir();
        std::fs::create_dir_all(&app_dir).expect("app dir");
        reset_test_state();
        let _ = crate::shared::app_data_dir::init_app_data_dir(app_dir.clone());

        ensure_test_master_key();
        chat_cache_put(ChatCachePutRequest {
            key: "chat-cache-missing-key-get-test".to_string(),
            value: "secret message".to_string(),
        })
        .await
        .expect("put");

        reset_test_state();
        let _ = crate::shared::app_data_dir::init_app_data_dir(app_dir);
        let loaded = chat_cache_get("chat-cache-missing-key-get-test".to_string())
            .await
            .expect("get after missing key");
        assert!(loaded.is_none());

        reset_test_state();
    }

    #[test]
    fn encrypts_and_decrypts() {
        let key = [7u8; 32];
        let (nonce_hex, value_hex) = encrypt_value(&key, "hello world").expect("encrypt");
        assert_ne!(value_hex, hex::encode("hello world"));
        let plain = decrypt_value(&key, &nonce_hex, &value_hex).expect("decrypt");
        assert_eq!(plain, "hello world");
    }

    #[tokio::test]
    async fn forget_master_key_is_idempotent() {
        let _guard = test_lock().await;
        reset_test_state();
        let _ = forget_master_key();
        let _ = forget_master_key();
        reset_test_state();
    }

    #[tokio::test]
    async fn prunes_oldest_entries_when_over_limit() {
        let _guard = test_lock().await;
        let app_dir = init_test_app_data_dir();
        std::fs::create_dir_all(&app_dir).expect("app dir");
        reset_test_state();
        let _ = crate::shared::app_data_dir::init_app_data_dir(app_dir);

        ensure_test_master_key();
        // 插入 6 条（上限 5，目标保留 4），确保每条 updated_at 有差异。
        for i in 0..6 {
            chat_cache_put(ChatCachePutRequest {
                key: format!("chat-cache-prune-{i}"),
                value: format!("value-{i}"),
            })
            .await
            .expect("put");
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        }

        let loaded = chat_cache_load_all().await.expect("load after prune");
        assert_eq!(
            loaded.len(),
            4,
            "oldest entries should be pruned down to 80% of limit"
        );
        assert!(
            !loaded.contains_key("chat-cache-prune-0"),
            "oldest entry should be evicted"
        );
        assert!(
            loaded.contains_key("chat-cache-prune-5"),
            "newest entry should remain"
        );

        reset_test_state();
    }
}
