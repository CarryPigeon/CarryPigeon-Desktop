use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct GetHistoryMessageData{
    pub from_time: String,
    pub count : u32,
    pub channel_id: String,
}

pub struct GetMessageFromId{
    
}

#[derive(Serialize, Deserialize)]
pub struct GetHistoryMessage<T>{
    pub id: u64,
    pub route: String,
    pub data: T,
}

impl<T> GetHistoryMessage<T>{
    pub fn new(id: u64, from_time: String, count: u32, channel_id: String) /*-> Self*/{
        /*
        GetHistoryMessage{
            id,
            route: "get_history_message".to_string(),
            data: GetHistoryMessageData{
                from_time,
                count,
                channel_id,
            }
        }*/
    }
    pub fn get_history_message() {}
}