use crate::dao::SQLITE_POOL;
use crate::mapper::group_message::GroupMessage;

pub async fn add_message(message: GroupMessage) -> anyhow::Result<()> {
    let _ = sqlx::query(format!("INSERT INTO group_{} (from_id, to_id, date, data, json, file_path) VALUES (?,?,?,?,?,?);",message.to_id).as_str())
            .bind(message.from_id)
            .bind(message.date)
            .bind(message.data)
            .bind(message.json)
            .bind(message.file_path)
            .execute(SQLITE_POOL.get().unwrap())
            .await?;
    Ok(())
}
pub async fn remove_message(group_id: u32, message_id: u32) -> anyhow::Result<()> {
    let _ = sqlx::query(format!("DELETE FROM group_{group_id} WHERE message_id = ?;").as_str())
        .bind(message_id)
        .execute(SQLITE_POOL.get().unwrap())
        .await?;
    Ok(())
}
pub async fn get_message(group_id: u32, message_id: u32) -> anyhow::Result<GroupMessage> {
    let message = sqlx::query_as::<_, GroupMessage>(
        format!("SELECT * FROM group_{group_id} WHERE group_id = ?;").as_str(),
    )
    .bind(group_id)
    .bind(message_id)
    .fetch_one(SQLITE_POOL.get().unwrap())
    .await?;
    Ok(message)
}
pub async fn get_messages_from_target_message_id(
    group_id: u32,
    message_id: u32,
) -> anyhow::Result<Vec<GroupMessage>> {
    let messages = sqlx::query_as::<_, GroupMessage>(
        format!("SELECT * FROM group_{group_id} WHERE message_id > ?;").as_str(),
    )
    .bind(message_id)
    .fetch_all(SQLITE_POOL.get().unwrap())
    .await?;
    Ok(messages)
}
