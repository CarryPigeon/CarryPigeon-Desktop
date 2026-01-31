pub mod app;
pub mod features;
pub mod shared;

pub fn run() -> anyhow::Result<()> {
    app::run()
}
