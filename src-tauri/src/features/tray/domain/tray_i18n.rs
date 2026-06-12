//! 托盘菜单标签翻译表。
//!
//! 约定：注释中文，日志英文（tracing）。

/// 根据 locale 获取托盘菜单项 ID 到标签的映射。
///
/// # 参数
/// - `locale`: `"zh_cn"` 或 `"en_us"`。
///
/// # 返回值
/// 固定 2 个菜单项的 `[(id, label)]` 数组。
pub fn tray_labels(locale: &str) -> [(&str, String); 2] {
    let prev = rust_i18n::locale();
    rust_i18n::set_locale(locale);
    let show_label = rust_i18n::t!("tray.show_window").to_string();
    let quit_label = rust_i18n::t!("tray.quit").to_string();
    rust_i18n::set_locale(&prev);
    [("show_window", show_label), ("quit", quit_label)]
}
