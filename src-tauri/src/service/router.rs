use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

#[allow(clippy::type_complexity)]
pub struct Router {
    pub route_map: HashMap<
        String,
        Arc<dyn Fn(String) -> Pin<Box<dyn Future<Output = String> + Send + Sync>> + Send + Sync>,
    >,
}
