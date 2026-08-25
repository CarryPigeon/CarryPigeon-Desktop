# 任务单：为已接线补充 API 补齐产品 UI

任务名称：supplement-api-ui

状态：done

任务目标：
在不改服务端的前提下，把已暴露 HTTP 的产品 UI 补齐：

1. 已接线的 discover / mentions / audit_logs：把协议里已有、界面还没用的查询与展示字段接到 UI
2. 联系人查找：按雪花 UID 打 `GET /api/users/{uid}` / `GET /api/users?ids=`
3. 「创建好友私聊」弹窗：查找用户后打 `POST /api/channels` 并切入新频道

影响模块：
- `src/features/chat/channel-discovery/`
- `src/features/chat/mention-inbox/`
- `src/features/chat/audit-logs/`
- `src/features/chat/presentation/patchbay/`
- i18n

允许修改范围：仅客户端 `carrypigeon-desktop`

禁止修改范围：
- 任何 `carrypigeon-server` 文件
- 调用未暴露 HTTP
- 提及点击走 `around_mid`
- 不改计划文件

## 实际结果

Discover：
- 频道栏「未加入频道」增加类型下拉（全部 / 公开 / 私有 / 系统），`setType` 写入 `GET /api/channels/discover?type=`
- 已加入频道会从发现列表去掉；本环境 `public` 已加入，选「公开」为空是协议正确行为

Mentions：
- 面板芯片「只看未读」「当前频道」；加载更多；单项已读；`GET /users?ids=` 解析发送者

Audit：
- 动作下拉 + 操作者 UID + 筛选；非雪花操作者本地拦截，不打接口

Contacts / 私聊：
- 服务器栏「联系人」入口
- 昵称不打 `ids=`；雪花 UID 走 `GET /users/{uid}`
- token 刷新为空时回退 `readAuthToken`
- 私聊弹窗按 UID 查找后 `POST /api/channels`；诚实提示无邀请接口
- 真服验证时取消了私聊确认，未实际创建新频道

## 验证

自动化：
- `pnpm run typecheck`
- 相关 vitest（discover / mentions / audit / contacts / snowflake）
- `scripts/check-feature-boundaries.sh`

真服（`http://127.0.0.1:8080`，账号 `ui_alice_0825`）：
- Discover 全部类型看到未加入 `room-ws-*`；公开为空；私有列出房间
- 提及铃看到未读 / 当前频道芯片
- 创建好友私聊弹窗看到 UID 字段后取消
- `public` 频道审计日志：动作筛选 + 非法操作者提示
- 联系人输入 `alice` 提示需 UID；输入 `2092085802191425536` 出现 `ui_alice_0825` 资料卡
