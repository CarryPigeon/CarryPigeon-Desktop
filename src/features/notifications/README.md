# notifications

应用内通知功能模块。

## 定位

- **负责：** 应用内通知列表、未读计数、通知铃铛 UI 组件。
- **不负责：** 托盘图标闪烁与桌面通知（由 `tray-notification` feature 负责）、通知偏好设置（由 `chat/notification-preferences` 负责）。

## 阅读顺序

1. `domain/contracts.ts` — 领域模型
2. `data/notificationStore.ts` — 持久化存储实现
3. `api.ts` — 公共 API 入口

## 入口

- `api.ts` — `getNotificationCapabilities()`
- `components.ts` — `NotificationBell`（跨 feature 组件边界）
