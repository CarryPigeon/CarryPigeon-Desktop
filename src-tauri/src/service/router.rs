use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

pub type FunctionPointer =
    Arc<dyn Fn(String) -> Pin<Box<dyn Future<Output = String> + Send + Sync>>>;

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
        let v = Router {
            route_map: HashMap::new(),
        };
        //TODO
        //v.attach_route()
        v
    }

    fn attach_route(&mut self, route: String, function: FunctionPointer) {
        self.route_map.insert(route, function);
    }

    pub async fn dispatch(&self, path: String) -> Option<&FunctionPointer> {
        self.route_map.get(&path)
    }
}
