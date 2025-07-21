use crate::dao::SQLITE_POOL;
use crate::mapper::private_message::PrivateMessage;

struct PrivateMessageDataBase{
    pub to_id: u32,
}

impl PrivateMessageDataBase {
    fn new(to_id: u32) -> PrivateMessageDataBase {
        PrivateMessageDataBase {
            to_id,
        }
    }

    /// 获取用户排序后的id
    /// 数据库的 user_1, user_2 是从大到小的
    fn get_user_sort_id(&self, id_1:u32, id_2:u32) -> (u32, u32) {
        // 不采用 ```(id_1.min(id_2), id_1.max(id_2))```
        // 因为会判断两次数值大小，会浪费时间
        if id_1 >= id_2 {
            (id_2, id_1)
        } else {
            (id_1, id_2)
        }
    }

    async fn add_message(&self, message: PrivateMessage) -> anyhow::Result<()> {
            let (user_1, user_2) = self.get_user_sort_id(message.from_id, message.to_id);
            let _ = sqlx::query(format!("INSERT INTO private_message_{} (user_1, user_2, message_id, date, data, json, file_path) VALUES (?, ?, ?, ?, ?, ?, ?);", self.to_id).as_str())
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
    async fn get_message(&self, message_id: u32) -> anyhow::Result<PrivateMessage> {
        let v = Box::new(sqlx::query_as::<_, PrivateMessage>(format!("SELECT * FROM private_message_{} WHERE message_id = ?;", self.to_id).as_str())
            .bind(message_id)
            .fetch_one(SQLITE_POOL.get().unwrap())
            .await?);
        Ok(*v)
    }
    async fn remove_message(&self, message_id: u32) -> anyhow::Result<()> {
        let _ = sqlx::query(format!("DELETE FROM private_message_{} WHERE message_id = ?;", self.to_id).as_str())
            .bind(message_id)
            .execute(SQLITE_POOL.get().unwrap())
            .await?;
        Ok(())
    }
    async fn get_messages_from_id(&self, from_id: u32) -> anyhow::Result<Vec<PrivateMessage>> {
        let v = sqlx::query_as::<_, PrivateMessage>(format!("SELECT * FROM private_message_{} WHERE user_1 = ? OR user_2 = ?;", self.to_id).as_str())
            .bind(from_id)
            .bind(from_id)
            .fetch_all(SQLITE_POOL.get().unwrap())
            .await?;
        Ok(v)
    }
}
