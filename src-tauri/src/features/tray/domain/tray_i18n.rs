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
pub fn tray_labels(locale: &str) -> [(&str, &str); 2] {
    match locale {
        "zh_cn" => [("show_window", "显示主窗口"), ("quit", "退出")],
        _ => [("show_window", "Show Main Window"), ("quit", "Quit")],
    }
}
