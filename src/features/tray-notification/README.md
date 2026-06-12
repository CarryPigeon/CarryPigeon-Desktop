# tray-notification

托盘通知功能模块。

## 定位

- **负责：** 托盘图标闪烁、悬停弹窗、桌面通知、托盘菜单语言同步、`close_to_tray` 行为
- **不负责：** 托盘图标本身的创建（由 `src-tauri/src/app/mod.rs` 初始化）、未读计数计算（由 `chat` feature 提供）、设置持久化（由 `settings` feature 提供）

## 阅读顺序

1. `domain/model.ts` — 领域模型
2. `domain/ports.ts` — 端口接口
3. `data/tauri/` — Tauri 适配器实现
4. `composition/createTrayNotificationRuntime.ts` — 运行时装配
5. `api.ts` — 公共 API 入口
