use crate::dao::private_message;
use crate::mapper::private_message::PrivateMessage;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

pub type FunctionPointer =
    Arc<dyn Fn(String) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send>> + Send + Sync>;

pub struct Router {
    route_map: HashMap<String, FunctionPointer>,
}

impl Default for Router {
    fn default() -> Self {
        Self::new()
    }
}

impl Router {
    pub fn new() -> Self {
        let mut v = Router {
            route_map: HashMap::new(),
        };
        //TODO
        v.attach_route("private_message".to_string(), |x| {
            Box::pin(private_message::add_message(PrivateMessage::from_string(x)))
        });
        v
    }

    /**
    注册route，应只在初始化时被调用
    */
    pub fn attach_route(
        &mut self,
        route: String,
        handler: impl Fn(String) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send>>
            + Send
            + Sync
            + 'static,
    ) {
        self.route_map.insert(route, Arc::new(handler));
    }
    /**
    获取路径的引用
    */
    pub async fn dispatch(&self, path: String) -> Option<FunctionPointer> {
        self.route_map.get(&path).cloned()
    }
}
