use crate::dao::SQLITE_POOL;
use sqlx::sqlite::SqliteQueryResult;

pub async fn insert(plugin_name: String, order: String) {
    let sql = format!("insert {order} into {plugin_name} ");
    let _ = sqlx::query(&sql).execute(SQLITE_POOL.get().unwrap()).await;
}

pub async fn update(plugin_name: String, order: String) {
    let sql = format!("update {order} into {plugin_name} ");
    let _ = sqlx::query(&sql).execute(SQLITE_POOL.get().unwrap()).await;
}

pub async fn delete(plugin_name: String, order: String) {
    let sql = format!("delete {order} from {plugin_name} ");
    let _ = sqlx::query(&sql).execute(SQLITE_POOL.get().unwrap()).await;
}

pub async fn select<T>(plugin_name: String, order: String) -> Box<Result<Vec<T>, sqlx::Error>>
where
    for<'r> T: sqlx::FromRow<'r, sqlx::sqlite::SqliteRow> + std::marker::Unpin + std::marker::Send,
{
    let sql = format!("select {order} from {plugin_name} ");
    Box::new(
        sqlx::query_as(&sql)
            .fetch_all(SQLITE_POOL.get().unwrap())
            .await,
    )
}

pub async fn create_table(
    plugin_name: String,
    table_name: String,
    columns: String,
) -> Box<Result<SqliteQueryResult, sqlx::Error>> {
    let sql = format!("create table {plugin_name}_{table_name} ({columns})");
    Box::new(sqlx::query(&sql).execute(SQLITE_POOL.get().unwrap()).await)
}
