use std::fmt::Display;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CommonNoticeMessage {
    pub route: String,
    pub data: String, // json
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum CommonNoticeMessageRoute {
    CorePrivateMessage,
    CoreGroupMessage,
}

impl Display for CommonNoticeMessageRoute {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommonNoticeMessageRoute::CorePrivateMessage => {
                write!(f, "/core/message/private_message")
            }
            CommonNoticeMessageRoute::CoreGroupMessage => write!(f, "/core/message/group"),
        }
    }
}
