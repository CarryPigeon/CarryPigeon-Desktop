use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TextData {
    pub to_id: u32,
    pub text: String,
}

#[derive(Serialize, Deserialize)]
pub struct MessageData {
    pub to_id: u32,
    pub domain: String,
    pub _type: u16,
    pub data: Box<MessageData>,
}
#[derive(Serialize, Deserialize)]
pub struct SendMessage<T> {
    pub id: u64,
    pub route: String,
    pub data: T,
}

impl SendMessage<TextData> {
    pub fn new(id: u64, to_id: u32, data: TextData) -> Self {
        SendMessage {
            id,
            route: "/core/msg/text/send".to_string(),
            data,
        }
    }
}

impl SendMessage<MessageData> {
    pub fn new(id: u64, to_id: u32, domain: String, _type: u16, data: MessageData) -> Self {
        SendMessage {
            id,
            route: "/core/msg/send".to_string(),
            data: MessageData {
                to_id,
                domain,
                _type,
                data: Box::new(data),
            },
        }
    }
}
