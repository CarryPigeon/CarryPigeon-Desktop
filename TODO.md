# 缺失 API 参数清单

> 目标：记录静态检查中确认的缺失/半缺失 API 参数，作为后续补齐 live 调用、页面接入和后端写入分发的跟踪入口。

## 1. 适用范围

- 覆盖当前已发现的 HTTP API、Tauri command 与页面调用参数缺口。
- 不覆盖输入校验类 `Missing ...`、mock catch-all、MVP 明确非目标且无契约的完整功能实现。
- 参数以现有文档、mock、端口类型和 data 层实现为准；未定 API 仅标注建议参数。
- `user id` 只在"目标用户"类接口中作为显式参数；`/users/me` 类接口通过 `accessToken` 表示当前用户，不额外传 `uid`。

## 2. 参数清单

### 2.1 获取频道资料

`GET /api/channels/{cid}`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `cid` | string | 是 | 频道 ID，path 参数，需 URL encode |
| `serverSocket` | string | 是 | 服务端地址上下文 |
| `accessToken` | string | 是 | Bearer 鉴权 token |

**状态**: 文档和 mock 已有，`ChatApiPort`/`httpChatApi` 缺 live 调用

---

### 2.2 好友私聊创建

API 待定

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `target_user_id` | string | 是 | 目标用户稳定 ID |
| `message` | string | 否 | 附言，可为空 |
| `serverSocket` | string | 是 | 服务端地址上下文 |
| `accessToken` | string | 是 | Bearer 鉴权 token |

**状态**: 契约未定，PRD 标注 MVP 非目标

---

### 2.3 更新当前用户资料

`PATCH /api/users/me`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `username` | string | 是 | 用户昵称 |
| `avatar` | number | 是 | 头像 ID；当前示例为 `0`，语义待确认（资源 ID/文件 ID/枚举值） |
| `sex` | number | 是 | 性别 |
| `brief` | string | 是 | 个人简介 |
| `birthday` | number | 是 | 生日时间戳 |

**状态**: 页面 `avatarUrl` 只写本地状态，请求中 `avatar` 硬编码为 `0`

---

### 2.4 更新当前用户背景图

`POST /api/users/me/background`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `background` | File | 是 | multipart/form-data，字段名固定 `background` |

**状态**: data 层已有上传能力，页面 `backgroundUrl` 只写本地状态未接入

---

### 2.7 消息搜索

`GET /api/channels/{cid}/messages/search`

Path:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `cid` | string | 是 | 目标频道 ID |

Query:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `q` | string | 是 | 搜索词，trim 后长度 1-100 |
| `cursor` | string | 否 | 不透明分页游标 |
| `limit` | number | 否 | 默认 20，最大 50 |
| `sender_uid` | string | 否 | 按发送者过滤（P0 可选） |
| `domain` | string | 否 | 按消息 domain 过滤（P0 可选） |
| `before_mid` | string | 否 | 只查该消息之前的结果（P1 可选） |
| `after_mid` | string | 否 | 只查该消息之后的结果（P1 可选） |

**状态**: ✅ 前端层已实现（`ChatMessageSearchQueryWire` → `httpSearchChannelMessages` → `searchChannelMessages`），待后端 HTTP 服务端接入

---

### 2.8 消息上下文定位

`GET /api/channels/{cid}/messages?around_mid=`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `cid` | string | 是 | 频道 ID，path 参数 |
| `around_mid` | string | 否 | 目标消息 ID，存在时返回目标消息及前后上下文 |
| `before` | number | 否 | 目标消息之前加载条数，默认 25，最大 50 |
| `after` | number | 否 | 目标消息之后加载条数，默认 25，最大 50 |

**状态**: ✅ 前端层已实现（`httpListChannelMessagesAround` → `listChannelMessagesAround`），待后端 HTTP 服务端接入

---

### 2.9 消息编辑

`PATCH /api/messages/{mid}`

Path:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `mid` | string | 是 | 目标消息 ID |

请求体:

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `domain` | string | 是 | P0 只要求 `Core:Text` |
| `domain_version` | string | 是 | domain 版本号 |
| `data` | object | 是 | domain payload，如 `{ "text": "..." }` |
| `mentions` | array | 否 | 候选提及列表，服务端重新校验和规范化 |
| `expected_edit_version` | number | 否 | 乐观并发版本，不匹配返回 `conflict` |

**新增错误 reason**: `message_not_editable`, `message_edit_window_expired`

**状态**: ✅ 前端层已实现（`ChatMessageEditWire` → `httpEditMessage` → `editMessage`），待后端 HTTP 服务端接入

---

### 2.10 频道置顶

`POST /api/channels/{cid}/pins/{mid}`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `cid` | string | 是 | 频道 ID，path 参数 |
| `mid` | string | 是 | 消息 ID，path 参数 |
| `note` | string | 否 | 置顶备注，最大 200 字符 |

**状态**: ✅ 前端层已实现（`httpPinMessage` → `pinMessage`），待后端 HTTP 服务端接入

---

### 2.11 取消置顶

`DELETE /api/channels/{cid}/pins/{mid}`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `cid` | string | 是 | 频道 ID，path 参数 |
| `mid` | string | 是 | 消息 ID，path 参数 |

**状态**: ✅ 前端层已实现（`httpUnpinMessage` → `unpinMessage`），待后端 HTTP 服务端接入。成功返回 `204 No Content`

---

### 2.12 置顶列表

`GET /api/channels/{cid}/pins`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `cid` | string | 是 | 频道 ID，path 参数 |
| `cursor` | string | 否 | 不透明分页游标 |
| `limit` | number | 否 | 默认 20，最大 50 |

**新增错误 reason**: `pin_limit_reached`

**状态**: ✅ 前端层已实现（`ChatPinListWire` → `httpListPins` → `listPins`），待后端 HTTP 服务端接入

---

### 2.13 消息转发

`POST /api/messages/{mid}/forward`

Path:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `mid` | string | 是 | 源消息 ID |

请求体:

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `target_cid` | string | 是 | 目标频道 ID |
| `comment` | string | 否 | 附言，P0 最大 500 字符 |
| `idempotency_key` | string | 否 | 幂等键，HTTP header 优先 |

**新增错误 reason**: `message_forward_forbidden`

**状态**: ✅ 前端层已实现（`ChatMessageForwardWire` → `httpForwardMessage` → `forwardMessage`），待后端 HTTP 服务端接入

---

### 2.14 提及收件箱列表

`GET /api/mentions`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `cursor` | string | 否 | 不透明分页游标 |
| `limit` | number | 否 | 默认 20，最大 50 |
| `unread_only` | boolean | 否 | 只返回未读提及 |
| `cid` | string | 否 | 限定频道 |

**状态**: ✅ 前端层已实现（`ChatMentionPageWire` → `httpListMentions` → `listMentions`），待后端 HTTP 服务端接入

---

### 2.15 标记单条提及已读

`PUT /api/mentions/{mention_id}/read`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `mention_id` | string | 是 | 目标提及 ID，path 参数 |

**状态**: ✅ 前端层已实现（`httpMarkMentionRead` → `markMentionRead`），待后端 HTTP 服务端接入

---

### 2.16 批量标记提及已读

`PUT /api/mentions/read_state`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `before_mention_id` | string | 否 | 标记该 mention 及之前的提及为已读 |
| `cid` | string | 否 | 只标记该频道内的提及 |
| 两者都缺省 | — | — | 标记当前用户所有提及为已读（应二次确认） |

**状态**: ✅ 前端层已实现（`httpBatchMarkMentionsRead` → `batchMarkMentionsRead`），待后端 HTTP 服务端接入

---

### 2.17 通知偏好查询

`GET /api/notification_preferences`

**复用点**: `cid` 复用 `ChatChannelWire.cid`
**新建**: `NotificationMode` 枚举（`all`/`mentions_only`/`muted`/`inherit`），`NotificationServerMode`（不含 `inherit`），`muted_until`（0=永久静音）

响应结构:

| 嵌套字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `server.mode` | string | 服务端级别，枚举: `all`, `mentions_only`, `muted` | 新建——服务端通知模式枚举 |
| `server.muted_until` | number | 服务端静音截止时间，0=永久 | 新建——静音时间戳 |
| `channels[].cid` | string | 频道 ID，复用 `ChatChannelWire.cid` | ✅ 复用 |
| `channels[].mode` | string | 频道级别，枚举: `all`, `mentions_only`, `muted`, `inherit` | 新建——频道通知模式枚举 |
| `channels[].muted_until` | number | 频道静音截止时间，0=永久 | 新建——静音时间戳 |

**状态**: ❌ 无 frontend 数据层。需新建 `NotificationPreferencesWire` 类型、Domain 模型、Port 方法、Http 函数和 Mapper。`cid` 可直接引用 `ChatChannelWire`

---

### 2.18 频道通知偏好设置

`PUT /api/channels/{cid}/notification_preference`

| 字段 | 类型 | 必填 | 用途 | 字段来源 |
| --- | --- | --- | --- | --- |
| `cid` | string | 是 | 频道 ID，path 参数 | ✅ 复用 `ChatChannelWire.cid` |
| `mode` | string | 是 | 枚举: `all`, `mentions_only`, `muted`, `inherit` | 新建——同 2.17 `NotificationMode` |
| `muted_until` | number | 否 | 0=永久静音 | 新建——同 2.17 |

**状态**: ❌ 无 frontend 数据层。新建 `ChannelNotificationPreferenceWire` 类型

---

### 2.19 服务端通知偏好设置

`PUT /api/notification_preferences/server`

| 字段 | 类型 | 必填 | 用途 | 字段来源 |
| --- | --- | --- | --- | --- |
| `mode` | string | 是 | 枚举: `all`, `mentions_only`, `muted`（不允许 `inherit`） | 新建——同 2.17 `NotificationServerMode` |
| `muted_until` | number | 否 | 0=永久静音 | 新建——同 2.17 |

**状态**: ❌ 无 frontend 数据层。新建 `ServerNotificationPreferenceWire` 类型

---

### 2.20 远端频道发现

`GET /api/channels/discover`

**复用点**: `q`/`cursor`/`limit` 复用 `ChatMessageSearchQueryWire` 查询参数模式；`cid`/`name`/`brief`/`avatar` 复用 `ChatChannelWire`；`next_cursor`/`has_more` 复用 `ChatMessagePageWire` 分页模式
**新建**: `type`（频道类型枚举），`member_count`（频道成员数），`requires_application`（需申请标记）

Query:

| 参数 | 类型 | 必填 | 说明 | 字段来源 |
| --- | --- | --- | --- | --- |
| `q` | string | 否 | 搜索词；缺省时返回推荐或公开频道 | ✅ 复用 `ChatMessageSearchQueryWire.q` |
| `cursor` | string | 否 | 不透明分页游标 | ✅ 复用通用分页模式 |
| `limit` | number | 否 | 默认 20，最大 50 | ✅ 复用通用分页模式 |
| `type` | string | 否 | 筛选: `text`, `announcement`, `management` | 新建——频道类型枚举 |

响应（`ChannelDiscoverItemWire`）:

| 字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `cid` | string | 频道 ID | ✅ 复用 `ChatChannelWire.cid` |
| `name` | string | 频道名 | ✅ 复用 `ChatChannelWire.name` |
| `brief` | string | 简介 | ✅ 复用 `ChatChannelWire.brief` |
| `avatar` | string | 头像 | ✅ 复用 `ChatChannelWire.avatar` |
| `member_count` | number | 频道成员数 | 新建——前 4 字段可引用 `ChatChannelWire` 后扩展 |
| `requires_application` | boolean | 是否需要申请加入 | 新建 |

分页响应复用 `ChatMessagePageWire`:
| `next_cursor` | string | 下一页游标 | ✅ 复用 `ChatMessagePageWire.next_cursor` |
| `has_more` | boolean | 是否还有更多 | ✅ 复用 `ChatMessagePageWire.has_more` |

**状态**: ❌ 无 frontend 数据层。需新建 `ChannelDiscoverItemWire` 类型。建议以 `ChatChannelWire` 为基类型扩展 `member_count` 和 `requires_application`

---

### 2.21 审计日志

`GET /api/audit_logs`

**复用点**: `cursor`/`limit` 复用通用分页模式；`cid` 复用 `ChatChannelWire.cid`；`created_at` 复用 `ChatMentionWire.created_at` 命名；`items`/`next_cursor`/`has_more` 复用 `ChatMessagePageWire` 分页响应结构
**新建**: `audit_id`（雪花 ID），`actor_uid`（操作者 UID，遵循 `from_uid` 命名），`action`（12 枚举值），`details`（扩展细节），`from_time`/`to_time`（时间范围筛选）

Query:

| 参数 | 类型 | 必填 | 说明 | 字段来源 |
| --- | --- | --- | --- | --- |
| `cursor` | string | 否 | 不透明分页游标 | ✅ 复用通用分页模式 |
| `limit` | number | 否 | 默认 50，最大 100 | ✅ 复用通用分页模式 |
| `cid` | string | 否 | 限定频道 | ✅ 复用 `ChatChannelWire.cid` |
| `actor_uid` | string | 否 | 操作者 UID | 新建——遵循 `from_uid`/`uid` 命名模式 |
| `action` | string | 否 | 动作类型枚举 | 新建——12 个 P0 枚举值 |
| `from_time` | number | 否 | 起始时间，epoch ms | 新建——时间范围筛选 |
| `to_time` | number | 否 | 结束时间，epoch ms | 新建——时间范围筛选 |

响应（`AuditLogItemWire`）:

| 字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `audit_id` | string | 雪花 ID | 新建——遵循通用雪花 ID（同 `mid`/`cid`） |
| `cid` | string | 频道 ID | ✅ 复用 `ChatChannelWire.cid` |
| `actor_uid` | string | 操作者 UID | 新建——遵循 `from_uid` 模式 |
| `action` | string | 动作类型 | 新建——12 枚举值 |
| `details` | unknown | 扩展细节 | 新建——预留扩展 |
| `created_at` | number | 创建时间 | 新建——复用 `ChatMentionWire.created_at` 命名模式 |

分页响应复用 `ChatMessagePageWire` 结构（`items`/`next_cursor`/`has_more`）

P0 action 枚举（全部新建）:
`channel.create`, `channel.delete`, `channel.update`, `channel.member.kick`, `channel.admin.grant`, `channel.admin.revoke`, `channel.ban.create`, `channel.ban.delete`, `message.delete`, `message.edit`, `message.pin`, `message.unpin`

**状态**: 新能力，待实现。❌ **无 frontend 数据层**

---

### 2.22 发送消息扩展字段

`POST /api/channels/{cid}/messages` 扩展字段

**复用点**: `mentions` 完全复用 `ChatMessageEditWire.mentions` 的 `Array<{ type: string; uid: string }>` 类型
**新建**: `client_message_id`（客户端本地消息 ID）

| 字段 | 类型 | 必填 | 用途 | 字段来源 |
| --- | --- | --- | --- | --- |
| `mentions` | array | 否 | 候选提及列表 `[{ type, uid }]`，服务端校验/去重/过滤后写回规范化结果 | ✅ 复用 `ChatMessageEditWire.mentions`（chatWireModels.ts:126） |
| `client_message_id` | string | 否 | 客户端本地消息 ID，用于 optimistic 关联，不参与全局 ID 语义 | 新建——无现有等效标识符 |

新增错误 reason: `mention_target_invalid`, `mention_not_allowed`（P0 可先映射为 `validation_failed`/`forbidden`）

**状态**: 需扩展 `ChatSendMessageWire`、`ChatSendMessageInput`、`ChatApiPort.sendChannelMessage` 和 `mapChatSendMessageInput`

---

### 2.23 扩展消息模型

消息 record 新增字段

**复用点**: `forwarded_from` 内部 5 个字段均复用现有 Wire 类型；`mentions` 复用 `ChatMessageEditWire.mentions`；`edited_at`/`edit_version` 类型与 `send_time`/`expected_edit_version` 对应

| 字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `edited_at` | number | 消息最后编辑时间，未编辑时缺省 | 新建——复用 `send_time` 类型（epoch ms） |
| `edit_version` | number | 编辑版本号，从 1 开始；用于乐观并发 | 新建——与 `expected_edit_version`（ChatMessageEditWire）对应 |
| `mentions` | array | 服务端规范化后的提及目标列表 `[{ type, uid }]` | ✅ 复用 `ChatMessageEditWire.mentions` 类型 |
| `forwarded_from` | object | 转发来源摘要 `{ mid, cid, uid, preview, send_time }` | 容器新建，内部 5 个字段均复用现有模式 |

`forwarded_from` 内部字段:
| `mid` | string | 源消息 ID | ✅ 复用 `ChatMessageWire.mid` |
| `cid` | string | 源频道 ID | ✅ 复用 `ChatChannelWire.cid` |
| `uid` | string | 源发送者 UID | ✅ 复用 `ChatUserWire.uid` |
| `preview` | string | 源消息预览 | ✅ 复用 `ChatMessageWire.preview` |
| `send_time` | number | 源发送时间 | ✅ 复用 `ChatMessageWire.send_time` |

**状态**: 需扩展 `ChatMessageWire`、`ChatMessageRecord`、`mapChatMessageWire`，新增 `ChatForwardedFromRecord` Domain 类型

---

### 2.24 扩展频道模型

channel record 新增字段

**复用点**: `joined`/`join_requested` 已存在于 `ChannelSummary` 共享内核
**新建**: `category_id`（分类 ID），`category_name`（分类名），`order`（排序键），`type`（频道类型枚举）

| 字段 | 类型 | 必填 | 用途 | 字段来源 |
| --- | --- | --- | --- | --- |
| `category_id` | string | 否 | 频道分类 ID；缺省归入 `"default"` | 新建——无现有分类模型 |
| `category_name` | string | 否 | 分类展示名；缺省展示 `"Channels"` | 新建——无现有分类模型 |
| `order` | number | 否 | 服务端排序键，越小越靠前 | 新建——无现有排序字段 |
| `type` | string | 否 | P0 支持 `text`, `announcement`, `management` | 新建——频道类型枚举（与 2.20 复用同类型） |
| `joined` | boolean | 否 | 当前用户是否已加入 | ✅ 直接复用 `ChannelSummary.joined`（shared-kernel/channelSummary.ts:15） |
| `join_requested` | boolean | 否 | 当前用户是否已提交申请 | ✅ 直接复用 `ChannelSummary.joinRequested`（shared-kernel/channelSummary.ts:16） |

**状态**: 需扩展 `ChatChannelWire`、`ChatChannelRecord`、`mapChatChannelWire`；`joined`/`join_requested` 可直接引用 `ChannelSummary` 的现成类型

---

### 2.25 WS 事件扩展

**复用点**: `message.updated` 完全复用 `ChatMessageCreatedEventPayloadWire`；`mention.created` 完全复用 `ChatMentionWire`；`message.pinned` 复用 `ChatPinWire` 3/5 字段
**新建**: `pin_id`（置顶记录 ID），`unpinned_by_uid`（对称命名），`unpinned_at`（对称命名），`audit_log.created` 载荷（全部新建），`channel.category_changed` 载荷（与 2.24 同步）

#### `message.updated`

| 字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `cid` | string | 频道 ID | ✅ 复用 `ChatMessageCreatedEventPayloadWire.cid` |
| `message` | object | 完整消息对象（含 `edited_at`, `edit_version`） | ✅ 复用 `ChatMessageCreatedEventPayloadWire.message` |

**复用率**: 100%。可定义为 `type ChatMessageUpdatedEventPayloadWire = ChatMessageCreatedEventPayloadWire;`

#### `message.pinned` / `message.unpinned`

| 字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `cid` | string | 频道 ID | ✅ 复用 `ChatPinWire.cid` |
| `mid` | string | 消息 ID | ✅ 复用 `ChatPinWire.mid` |
| `pin_id` | string | 置顶记录 ID | 新建——雪花 ID，`ChatPinWire` 无此字段 |
| `pinned_by_uid` / `unpinned_by_uid` | string | 操作者 UID | ✅ 复用 `ChatPinWire.pinned_by_uid` / `unpinned_by_uid` 为对称新建 |
| `pinned_at` / `unpinned_at` | number | 操作时间 | ✅ 复用 `ChatPinWire.pinned_at` / `unpinned_at` 为对称新建 |

**复用率**: `pinned` 3/5 复用，`unpinned` 2/5 复用

#### `mention.created`

| 字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `mention_id` | string | 提及 ID | ✅ 复用 `ChatMentionWire.mention_id` |
| `cid` | string | 频道 ID | ✅ 复用 `ChatMentionWire.cid` |
| `mid` | string | 消息 ID | ✅ 复用 `ChatMentionWire.mid` |
| `from_uid` | string | 提及者 | ✅ 复用 `ChatMentionWire.from_uid` |
| `target` | object | `{ type, uid }` | ✅ 复用 `ChatMentionWire.target` |
| `created_at` | number | 创建时间 | ✅ 复用 `ChatMentionWire.created_at` |

**复用率**: 100%。可定义为 `type MentionCreatedEventPayloadWire = ChatMentionWire;`

#### `audit_log.created`

| 字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `audit_id` | string | 审计记录 ID | 新建——同 2.21 |
| `cid` | string | 频道 ID | ✅ 复用 `ChatChannelWire.cid` |
| `actor_uid` | string | 操作者 | 新建——同 2.21 |
| `action` | string | 动作类型 | 新建——同 2.21 |
| `created_at` | number | 创建时间 | 新建——复用 `ChatMentionWire.created_at` 命名 |

#### `channel.category_changed`

| 字段 | 类型 | 用途 | 字段来源 |
| --- | --- | --- | --- |
| `cid` | string | 频道 ID | ✅ 复用 `ChatChannelWire.cid` |
| `category_id` | string | 分类 ID | 新建——与 2.24 同步 |
| `category_name` | string | 分类名 | 新建——与 2.24 同步 |
| `order` | number | 排序值 | 新建——与 2.24 同步 |
| `type` | string | 频道类型 | 新建——与 2.24 同步 |

**状态**: 需扩展 `chatWireEvents.ts`、`chatEventModels.ts`、`chatWireMappers.ts`。`message.updated` 和 `mention.created` 可 100% 复用现有类型

---

### 2.26 Voice Call Rust 后端（全部 11 个 command 已实现为真实逻辑，非桩）

文件: `src-tauri/src/features/voice_call/di/commands.rs`

| 编号 | Command | 签名参数 | 当前状态 |
| --- | --- | --- | --- |
| 1 | `start_direct_call` | `session_id: String, target_user_id: String, room_id: String` | ✅ 真实实现: 创建 `CallSession`(CallKind::Direct, CallState::Dialing)，插入 `sessions` HashMap |
| 2 | `start_conference` | `session_id: String, room_id: String` | ✅ 真实实现: 创建 `CallSession`(CallKind::Conference, CallState::Dialing) |
| 3 | `accept_call` | `session_id: String` | ✅ 真实实现: 查找 session 并设置 `state = CallState::Active` |
| 4 | `reject_call` | `session_id: String, reason: Option<String>` | ✅ 真实实现: 设置 `state = CallState::Ended`，带 `ended_at` 时间戳 |
| 5 | `hangup_call` | `session_id: String` | ✅ 真实实现: 设置 `state = CallState::Ended` |
| 6 | `toggle_mute` | `session_id: String` | ✅ 真实实现: 翻转 `participant.is_muted`，返回 `bool` |
| 7 | `toggle_noise_suppression` | `session_id: String` | ✅ 真实实现: 翻转 `media_settings.noise_suppression`，返回 `bool` |
| 8 | `enumerate_input_devices` | 无参数 | ✅ 真实实现: 调用 `AudioDeviceManager::enumerate_input_devices()` |
| 9 | `enumerate_output_devices` | 无参数 | ✅ 真实实现: 调用 `AudioDeviceManager::enumerate_output_devices()` |
| 10 | `select_input_device` | `session_id: String, device_id: String` | ✅ 真实实现: 写入 `selected_input` |
| 11 | `select_output_device` | `session_id: String, device_id: String` | ✅ 真实实现: 写入 `selected_output` |

**状态**: ✅ 全部 command 已有真实逻辑（`VoiceCallService` 含 `AudioDeviceManager`、`sessions` HashMap、`selected_input/output` 状态管理）。TODO.md 此前记录为 `VOICE_NOT_IMPLEMENTED` 桩——已不准确。

---

### 2.27 Voice Call 前端 action 方法（全部 9 个已实现，非桩）

文件: `src/features/chat/voice-call/capability-source.ts`

| 编号 | Method | 签名参数 | 当前状态 |
| --- | --- | --- | --- |
| 1 | `startDirectCall` | `targetUserId: string` | ✅ 真实实现: 生成 `sessionId`/`roomId`，调用 `invoke("start_direct_call", ...)`，返回映射后的 `CallSession` |
| 2 | `startConference` | 无参数 | ✅ 真实实现: 生成 `sessionId`/`roomId`，调用 `invoke("start_conference", ...)` |
| 3 | `acceptCall` | 无参数 | ✅ 真实实现: 从 `activeSession` 读取 sessionId 并调用 `invoke("accept_call", ...)` |
| 4 | `rejectCall` | `reason?: string` | ✅ 真实实现: 调用 `invoke("reject_call", { session_id, reason })` |
| 5 | `hangup` | 无参数 | ✅ 真实实现: 调用 `invoke("hangup_call", ...)` |
| 6 | `toggleMute` | 无参数 | ✅ 真实实现: 调用 `invoke("toggle_mute", ...)`，返回 `boolean` |
| 7 | `toggleNoiseSuppression` | 无参数 | ✅ 真实实现: 调用 `invoke("toggle_noise_suppression", ...)` |
| 8 | `selectInputDevice` | `deviceId: string` | ✅ 真实实现: 调用 `invoke("select_input_device", { session_id, device_id })` |
| 9 | `selectOutputDevice` | `deviceId: string` | ✅ 真实实现: 调用 `invoke("select_output_device", { session_id, device_id })` |

**状态**: ✅ snapshot/observer 为真实实现，且全部 9 个 action 方法已通过 Tauri `invoke` 调用 Rust command（内有真实业务逻辑）。mock 层（`mock/index.ts`）也提供完整后备实现。TODO.md 此前记录为 `throw Error("not implemented")`——已不准确。

---

### 2.28 Files: `listFiles`

文件: `src/features/files/composition/fileServices.ts`

| 字段 | 类型 | 必填 | 用途 |
| --- | --- | --- | --- |
| `serverSocket` | string | 是 | 服务端地址上下文 |
| `query` | FileListQuery | 是 | 查询参数（过滤/分页等） |

**状态**:
- `off` 模式: 返回空数组 `[]`
- `protocol` 模式: 返回空数组 `[]`
- `store` 模式: 有 mock 数据（6 条硬编码记录）
- 无真实 HTTP 后端实现

---

## 3. 相关链接

- `docs/api/11-http-endpoints-v1.md`
- `docs/design/PRD.md`
- `docs/superpowers/specs/2026-05-15-im-community-gap-analysis-design.md`
- `src/features/chat/domain/ports/chatApiPort.ts`
- `src/features/chat/data/chat-api/httpChatApi.ts`
- `src/features/account/profile/presentation/pages/UserInfoPage.vue`
- `src/features/account/profile/data/httpUserApi.ts`
- `src-tauri/src/features/settings/di/commands.rs`
- `src-tauri/src/features/settings/data/config_store.rs`
- `src-tauri/src/features/voice_call/di/commands.rs`
- `src/features/chat/voice-call/capability-source.ts`
- `src/features/chat/voice-call/mock/index.ts`
- `src/features/files/composition/fileServices.ts`

---

## 4. 状态汇总

| 分类 | 数量 | 说明 |
| --- | --- | --- |
| HTTP 端点，前端层已实现 | 10 | 消息搜索、上下文定位、编辑、置顶 x3、转发、@提及 x3（Wire+Http+Port+Domain 已全，待后端接入） |
| HTTP 端点，无 frontend 数据层 | 5 | 通知偏好 x3、频道发现、审计日志 |
| 模型/Wire 类型，需扩展 Wire+Domain+Mapper | 4 | 发送消息扩展字段、消息模型、频道模型、WS 事件 |
| Settings，待补充前端分发 | 2 | `update_config_u32`（仅 `server_port`）、`update_config_bool`（6 个 bool key） |
| Settings，无可用 key | 1 | `update_config_u64`（始终返回错误） |
| Settings，发现但先前未记录 | 2 | `update_config_bool`、`update_config_string`（均在 backend 已实现） |
| Voice Call Rust | 11 | ✅ 已全部实现为真实逻辑（非桩） |
| Voice Call Frontend | 9 | ✅ 已全部实现为真实 invoke 调用（非桩） |
| Files | 1 | `listFiles` 无真实 HTTP 后端 |
| 好友私聊 | 1 | MVP 非目标，API 待定 |
| **总计** | **46** | +2 先前未记录的 Settings command |
