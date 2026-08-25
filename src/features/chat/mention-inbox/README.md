# mention-inbox

提及收件箱子功能模块。

## 定位

- **负责：** `GET /api/mentions`、单条/批量已读，以及聊天顶栏收件箱 UI。
- **不负责：** 消息时间线定位（禁止走 `around_mid`）、本地 notifications store。

## 阅读顺序

1. `api.ts`
2. `domain/contracts.ts`
3. `domain/usecases/mentionInboxService.ts`
4. `presentation/components/MentionInboxBell.vue`
