//! chat_cache｜加密聊天缓存命令。

use aes_gcm::{Aes256Gcm, Nonce, aead::Aead, aead::KeyInit};
use anyhow::{Context, Result};
use keyring::Entry;
use sea_orm::ConnectionTrait;
use sea_orm::{Database, DatabaseBackend, Statement, StatementBuilder, TransactionTrait, Value};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};

use crate::shared::error::{CommandResult, command_error, to_command_error};

const SERVICE: &str = "carrypigeon-desktop";
const ACCOUNT: &str = "chat-cache-master-key";

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

fn chat_cache_path() -> PathBuf {
    base_db_dir().join("chat_cache.db")
}

async fn ensure_parent_dir(path: &PathBuf) -> Result<()> {
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

    let path = chat_cache_path();
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

fn master_key(create_if_missing: bool) -> Result<[u8; 32]> {
    let cell = CHAT_CACHE_MASTER_KEY.get_or_init(|| Mutex::new(None));
    if let Some(key) = *cell
        .lock()
        .map_err(|_| anyhow::anyhow!("Failed to lock chat cache master key"))?
    {
        return Ok(key);
    }
    let entry = Entry::new(SERVICE, ACCOUNT)?;
    match entry.get_password() {
        Ok(secret) => {
            let bytes = hex::decode(secret.trim()).context("Invalid chat cache master key")?;
            let key: [u8; 32] = bytes
                .try_into()
                .map_err(|_| anyhow::anyhow!("Invalid chat cache master key length"))?;
            if let Ok(mut guard) = cell.lock() {
                *guard = Some(key);
            }
            Ok(key)
        }
        Err(_) if create_if_missing => {
            let mut key = [0u8; 32];
            getrandom::fill(&mut key)
                .map_err(|_| anyhow::anyhow!("Failed to generate chat cache master key"))?;
            entry
                .set_password(&hex::encode(key))
                .context("Failed to persist chat cache master key")?;
            if let Ok(mut guard) = cell.lock() {
                *guard = Some(key);
            }
            Ok(key)
        }
        Err(err) => Err(err.into()),
    }
}

fn clear_master_key_cache() {
    if let Some(cell) = CHAT_CACHE_MASTER_KEY.get() {
        if let Ok(mut guard) = cell.lock() {
            *guard = None;
        }
    }
}

fn forget_master_key() -> Result<()> {
    clear_master_key_cache();
    let entry = Entry::new(SERVICE, ACCOUNT)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(err)
            if err.to_string().contains("not found")
                || err.to_string().contains("NoEntry")
                || err
                    .to_string()
                    .contains("No matching entry found in secure storage") =>
        {
            Ok(())
        }
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
    Ok(String::from_utf8(plaintext).context("Invalid utf-8 chat cache value")?)
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
    ensure_schema()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_INIT_FAILED", e))?;
    let rows = load_all_rows()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_QUERY_FAILED", e))?;
    if rows.is_empty() {
        return Ok(HashMap::new());
    }
    let key_bytes = master_key(false).map_err(|e| to_command_error("CHAT_CACHE_KEY_FAILED", e))?;
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
    ensure_schema()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_INIT_FAILED", e))?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", e))?;
    let txn = conn
        .begin()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_TXN_BEGIN_FAILED", e))?;
    let stmt = RawStatement::new("DELETE FROM chat_cache".to_string(), Vec::new());
    txn.execute(&stmt)
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DELETE_FAILED", e))?;
    txn.commit()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_TXN_COMMIT_FAILED", e))?;
    forget_master_key().map_err(|e| to_command_error("CHAT_CACHE_KEY_CLEAR_FAILED", e))?;
    Ok(())
}

#[tauri::command]
pub async fn chat_cache_get(key: String) -> CommandResult<Option<String>> {
    ensure_schema()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_INIT_FAILED", e))?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", e))?;
    let key = key.trim();
    if key.is_empty() {
        return Err(command_error("CHAT_CACHE_KEY_REQUIRED", "key is required"));
    }
    let stmt = RawStatement::new(
        "SELECT nonce_hex, value_hex FROM chat_cache WHERE key = ?".to_string(),
        vec![Value::String(Some(key.to_string()))],
    );
    let rows = conn
        .query_all(&stmt)
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_QUERY_FAILED", e))?;
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
    let key_bytes = master_key(false).map_err(|e| to_command_error("CHAT_CACHE_KEY_FAILED", e))?;
    let value = decrypt_value(&key_bytes, &nonce_hex, &value_hex)
        .map_err(|e| to_command_error("CHAT_CACHE_DECRYPT_FAILED", e))?;
    Ok(Some(value))
}

#[tauri::command]
pub async fn chat_cache_put(req: ChatCachePutRequest) -> CommandResult<()> {
    ensure_schema()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_INIT_FAILED", e))?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", e))?;
    let key = req.key.trim();
    if key.is_empty() {
        return Err(command_error("CHAT_CACHE_KEY_REQUIRED", "key is required"));
    }
    let key_bytes = master_key(true).map_err(|e| to_command_error("CHAT_CACHE_KEY_FAILED", e))?;
    let (nonce_hex, value_hex) = encrypt_value(&key_bytes, &req.value)
        .map_err(|e| to_command_error("CHAT_CACHE_ENCRYPT_FAILED", e))?;
    let txn = conn
        .begin()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_TXN_BEGIN_FAILED", e))?;
    let stmt = RawStatement::new(
        "INSERT INTO chat_cache (key, nonce_hex, value_hex, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET nonce_hex = excluded.nonce_hex, value_hex = excluded.value_hex, updated_at = excluded.updated_at".to_string(),
        vec![
            Value::String(Some(key.to_string())),
            Value::String(Some(nonce_hex)),
            Value::String(Some(value_hex)),
            Value::BigInt(Some(now_ms())),
        ],
    );
    txn.execute(&stmt)
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_WRITE_FAILED", e))?;
    txn.commit()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_TXN_COMMIT_FAILED", e))?;
    Ok(())
}

#[tauri::command]
pub async fn chat_cache_remove(req: ChatCacheRemoveRequest) -> CommandResult<()> {
    ensure_schema()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_INIT_FAILED", e))?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", e))?;
    let key = req.key.trim();
    if key.is_empty() {
        return Err(command_error("CHAT_CACHE_KEY_REQUIRED", "key is required"));
    }
    let stmt = RawStatement::new(
        "DELETE FROM chat_cache WHERE key = ?".to_string(),
        vec![Value::String(Some(key.to_string()))],
    );
    conn.execute(&stmt)
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DELETE_FAILED", e))?;
    Ok(())
}

#[tauri::command]
pub async fn chat_cache_remove_many(req: ChatCacheRemoveManyRequest) -> CommandResult<()> {
    ensure_schema()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_INIT_FAILED", e))?;
    let conn = db()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_DB_FAILED", e))?;
    let txn = conn
        .begin()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_TXN_BEGIN_FAILED", e))?;
    for key in req.keys {
        let key = key.trim().to_string();
        if key.is_empty() {
            continue;
        }
        let stmt = RawStatement::new(
            "DELETE FROM chat_cache WHERE key = ?".to_string(),
            vec![Value::String(Some(key))],
        );
        txn.execute(&stmt)
            .await
            .map_err(|e| to_command_error("CHAT_CACHE_DELETE_FAILED", e))?;
    }
    txn.commit()
        .await
        .map_err(|e| to_command_error("CHAT_CACHE_TXN_COMMIT_FAILED", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
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
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_millis();
        std::env::temp_dir().join(format!("carrypigeon-chat-cache-test-{millis}"))
    }

    fn reset_test_state() {
        if let Some(cell) = CHAT_CACHE_DB.get() {
            if let Ok(mut guard) = cell.lock() {
                *guard = None;
            }
        }
        let _ = forget_master_key();
    }

    #[tokio::test]
    async fn load_all_empty_db_without_master_key() {
        let _guard = test_lock();
        let prev = std::env::current_dir().expect("cwd");
        let dir = test_temp_dir();
        std::fs::create_dir_all(&dir).expect("temp dir");
        reset_test_state();
        std::env::set_current_dir(&dir).expect("set cwd");
        let result = chat_cache_load_all().await.expect("load all");
        assert!(result.is_empty());
        reset_test_state();
        std::env::set_current_dir(prev).expect("restore cwd");
    }

    #[tokio::test]
    async fn clear_all_removes_data_and_key() {
        let _guard = test_lock();
        let prev = std::env::current_dir().expect("cwd");
        let dir = test_temp_dir();
        std::fs::create_dir_all(&dir).expect("temp dir");
        reset_test_state();
        std::env::set_current_dir(&dir).expect("set cwd");

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
        std::env::set_current_dir(prev).expect("restore cwd");
    }

    #[test]
    fn encrypts_and_decrypts() {
        let key = [7u8; 32];
        let (nonce_hex, value_hex) = encrypt_value(&key, "hello world").expect("encrypt");
        assert_ne!(value_hex, hex::encode("hello world"));
        let plain = decrypt_value(&key, &nonce_hex, &value_hex).expect("decrypt");
        assert_eq!(plain, "hello world");
    }

    #[test]
    fn forget_master_key_is_idempotent() {
        let _guard = test_lock();
        reset_test_state();
        let _ = forget_master_key();
        let _ = forget_master_key();
        reset_test_state();
    }
}
