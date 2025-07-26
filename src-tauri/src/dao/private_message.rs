use crate::dao::SQLITE_POOL;
use crate::mapper::private_message::PrivateMessage;

/// 获取用户排序后的id
/// 数据库的 user_1, user_2 是从大到小的
fn get_user_sort_id(id_1: u32, id_2: u32) -> (u32, u32) {
    // 不采用 ```(id_1.min(id_2), id_1.max(id_2))```
    // 因为会判断两次数值大小，会浪费时间
    if id_1 >= id_2 {
        (id_2, id_1)
    } else {
        (id_1, id_2)
    }
}

pub async fn add_message(message: PrivateMessage) -> anyhow::Result<()> {
    let (user_1, user_2) = get_user_sort_id(message.from_id, message.to_id);
    let _ = sqlx::query(format!("INSERT INTO private_message_{} (user_1, user_2, message_id, date, data, json, file_path) VALUES (?, ?, ?, ?, ?, ?, ?);", message.to_id).as_str())
                .bind(user_1)
                .bind(user_2)
                .bind(message.message_id)
                .bind(message.date)
                .bind(message.data)
                .bind(message.json)
                .bind(message.file_path)
                .execute(SQLITE_POOL.get().unwrap())
                .await?;
    Ok(())
}
pub async fn get_message(message_id: u32) -> anyhow::Result<PrivateMessage> {
    let v = Box::new(
        sqlx::query_as::<_, PrivateMessage>(
            format!("SELECT * FROM private_message_{message_id} WHERE message_id = ?;",).as_str(),
        )
        .bind(message_id)
        .fetch_one(SQLITE_POOL.get().unwrap())
        .await?,
    );
    Ok(*v)
}
pub async fn remove_message(to_id: u32, message_id: u32) -> anyhow::Result<()> {
    let _ =
        sqlx::query(format!("DELETE FROM private_message_{to_id} WHERE message_id = ?;",).as_str())
            .bind(message_id)
            .execute(SQLITE_POOL.get().unwrap())
            .await?;
    Ok(())
}
pub async fn get_messages_from_id(to_id: u32, from_id: u32) -> anyhow::Result<Vec<PrivateMessage>> {
    let v = sqlx::query_as::<_, PrivateMessage>(
        format!("SELECT * FROM private_message_{to_id} WHERE user_1 = ? OR user_2 = ?;").as_str(),
    )
    .bind(to_id)
    .bind(from_id)
    .fetch_all(SQLITE_POOL.get().unwrap())
    .await?;
    Ok(v)
}
