# 任务单：为已接线补充 API 补齐产品 UI

任务名称：supplement-api-ui

任务目标：
在不改服务端的前提下，把已暴露 HTTP 的产品 UI 补齐：

1. 已接线的 discover / mentions / audit_logs：把协议里已有、界面还没用的查询与展示字段接到 UI
2. 联系人查找：按雪花 UID 打 `GET /api/users/{uid}` / `GET /api/users?ids=`
3. 「创建好友私聊」弹窗：查找用户后打 `POST /api/channels` 并切入新频道

任务背景：
上一轮已把 5 条 adapter 接到入口。用户要求为这些补充 API 增加 UI 支持。服务端仍未暴露昵称搜索、邀请、转让群主、mute、公告、reactions、文件库 list/delete，这些不造假入口。

影响模块：
- `src/features/chat/channel-discovery/`
- `src/features/chat/mention-inbox/`
- `src/features/chat/audit-logs/`
- `src/features/chat/presentation/patchbay/`
- i18n

允许修改范围：
- 仅客户端 `carrypigeon-desktop`
- 上述 UI / usecase / 测试 / 文案

禁止修改范围：
- 任何 `carrypigeon-server` 文件
- 调用未暴露 HTTP（`/users/search`、invites、ownership-transfer、mute、reactions、files list-delete）
- 提及点击走 `around_mid`
- 不改计划文件

依赖限制：不新增 npm/Cargo 依赖。

配置限制：不新增占位配置。

文档依据：
- 服务端 Controller/DTO
- `src/features/AGENTS.md`

验收标准：
1. Discover 可按 `type=public|private|system` 筛选并打到 query
2. 提及面板可切换未读、加载更多、单项标已读、展示发送者
3. 审计日志可按 action / actor_uid 筛选
4. 联系人非 UID 不打 `ids=`；UID 走 getUser
5. 私聊弹窗确认后会 `POST /api/channels`
6. typecheck 与相关 vitest 通过

完成定义：
产品可点到上述查询字段与 UID 查找/建频道路径；任务单改为 done；已提交并更新 PR。
