use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct TcpMessageEvent {
    pub server_socket: String,
    pub payload: Vec<u8>,
}
