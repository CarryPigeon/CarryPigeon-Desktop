use crate::dao::SQLITE_POOL;
use crate::mapper::friends::Friend;

pub async fn get_friend_table() -> anyhow::Result<Vec<Friend>> {
    let v = Box::new(
        sqlx::query_as::<_, Friend>("SELECT * from friend;")
            .fetch_all(SQLITE_POOL.get().unwrap())
            .await?,
    );
    Ok(*v)
}
pub async fn get_friend_by_id(id: u32) -> anyhow::Result<Friend> {
    let v = Box::new(
        sqlx::query_as::<_, Friend>("SELECT * from friend where id = ?;")
            .bind(id)
            .fetch_one(SQLITE_POOL.get().unwrap())
            .await?,
    );
    Ok(*v)
}
pub async fn get_friend_by_name(name: &str) -> anyhow::Result<Friend> {
    let v = Box::new(
        sqlx::query_as::<_, Friend>("SELECT * from friend where id = ?;")
            .bind(name)
            .fetch_one(SQLITE_POOL.get().unwrap())
            .await?,
    );
    Ok(*v)
}
