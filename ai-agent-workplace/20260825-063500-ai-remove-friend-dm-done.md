# 任务单：删除添加单人好友

任务名称：remove-friend-dm

状态：done

任务目标：删除「创建好友私聊 / 联系人发消息」这条添加单人好友产品路径。

实际结果：
- 删除 `CreateFriendPrivateChatDialog.vue` 与 `CreateChatMenu.vue`
- 频道栏 `+` 直接打开「创建频道」
- 联系人页只保留 UID 查找与查看资料，去掉「发消息」
- 清理对应 i18n

验证：`pnpm run typecheck`、contacts / localeKeys vitest、`scripts/check-feature-boundaries.sh`
