# CarryPigeon 频道社群型 IM 功能缺口设计

日期：2026-05-15

## 背景与目标

CarryPigeon 当前已经具备频道群聊 MVP 的主链路：服务器连接、登录、频道列表、消息收发、回复、删除、已读未读、成员治理、入群申请、禁言、插件消息 domain、文件上传基础入口以及 WS/polling 恢复策略。

这份设计聚焦“对标 Discord/QQ 频道社群型 IM 时还缺什么”。目标不是立即实现所有功能，而是明确下一阶段最值得补齐的社群基础能力、优先级、架构落点和协议扩展方向。

本设计参考的外部产品能力包括 Discord 的 roles/permissions、threads/forum channels、announcement channels、AutoMod、scheduled events，以及 QQ 频道/机器人生态中的频道、权限和机器人服务集成方向。它们共同说明：频道社群型 IM 的核心不是单纯发消息，而是频道结构、权限治理、通知控制、成员运营和生态扩展。

## 范围

本轮建议聚焦 6 个 P0 缺口：

1. 消息搜索。
2. @提及与提及收件箱。
3. 消息编辑、置顶、真正转发。
4. 频道分类与远端 discover。
5. 通知策略。
6. 审计日志基础版。

本轮明确不纳入：

1. 私聊和好友体系。
2. 语音、直播、舞台频道。
3. 论坛频道和完整 threads 系统。
4. 完整身份组与频道级权限矩阵。
5. AutoMod 完整规则引擎。
6. 机器人命令和 webhook 平台。

这些能力仍然重要，但会把范围从“补齐频道社群基础体验”扩大成平台级重构。

## 当前缺口总览

按 Discord/QQ 频道社群型产品对标，当前缺口可分成 7 组：

1. 社群结构缺口：缺频道分类、公告频道、论坛/帖子型频道、话题/线程、活动/舞台/语音频道。
2. 权限体系缺口：当前只有 owner/admin/member，缺身份组层级、频道级权限覆盖、可视化权限管理、审计日志。
3. 消息体验缺口：缺搜索、@提及、表情反应、消息编辑、置顶、消息链接、真正转发、收藏/稍后看、富媒体预览。
4. 通知缺口：缺服务器/频道静音、仅 @ 提醒、通知中心、提及收件箱、桌面系统通知细分策略。
5. 成员运营缺口：缺新成员 onboarding、欢迎页、规则确认、邀请链接、成员标签、活跃/在线状态。
6. 治理与安全缺口：缺 AutoMod、关键词/垃圾消息过滤、慢速模式、举报队列、封禁/踢人审计、管理员操作日志。
7. 平台生态缺口：已有插件基座，但缺机器人、命令、webhook、频道事件扩展、插件市场推荐、插件能力与社群权限联动。

下一阶段不应优先追私聊或全量音视频，而应先补频道社群运营能力。

## 优先级

### P0：补到可日常使用

P0 目标是让中小社群可以长期使用频道聊天，而不是只跑通演示链路。

1. 消息搜索：支持当前频道搜索、关键词结果、点击跳转消息上下文。
2. @提及与提及收件箱：支持用户提及、提及未读、集中入口和点击跳转。
3. 消息编辑、置顶、真正转发：补齐消息管理高频动作，替换当前 forward 复用 copy 的占位行为。
4. 频道分类与排序：把平铺频道变成可分组结构，接入真实远端 discover。
5. 通知策略：支持服务器默认、频道覆盖、静音、仅提及提醒。
6. 审计日志基础版：记录高风险治理动作，支持管理员追溯。

### P1：形成社群运营能力

1. 身份组与频道级权限。
2. 公告频道。
3. 线程/帖子型讨论。
4. 成员 onboarding。
5. AutoMod 基础版。
6. 邀请链接与成员来源追踪。

### P2：平台化与生态增强

1. 机器人、斜杠命令、webhook。
2. 活动、日程、舞台、语音频道。
3. 高级搜索：跨频道、按发送者、按时间、按附件/domain。
4. 收藏、稍后看、个人笔记。
5. 多端强一致：草稿、已读、通知偏好、收藏同步。
6. 插件市场推荐、评分、权限审核、自动更新策略。

## P0 能力设计

### 消息搜索

缺陷：当前只有频道列表搜索，没有消息搜索。历史消息积累后，用户无法找回内容。

建议：

1. 先做频道内搜索。
2. 入口放在 ChatCenter 顶部。
3. 搜索结果按时间倒序展示。
4. 点击结果后选择目标频道、加载目标消息附近上下文、滚动并短暂高亮。
5. 后续扩展跨频道搜索、按用户/domain/附件筛选。

协议建议：

`GET /api/channels/{cid}/messages/search?q=&cursor=&limit=`

### @提及与提及收件箱

缺陷：当前消息是纯 draft + domain payload，没有提及解析、提及未读、集中入口。

建议：

1. Core:Text 先支持用户提及。
2. 客户端可做输入提示和局部渲染，但服务端必须负责规范化 uid 列表。
3. 发送请求携带 `mentions` 字段。
4. 服务端产生 mention unread，并通过事件通知目标用户。
5. 客户端提供提及收件箱，展示“谁在什么频道提到了我”，点击后跳转目标消息。
6. 协议预留 `mention_type`，后续支持用户、身份组、全体成员。

### 消息编辑、置顶、真正转发

缺陷：已有删除/回复，但消息不能编辑或置顶，转发只是复制文本。

建议：

1. 编辑：先限制为发送者编辑 Core:Text；消息模型增加 `edited_at`。
2. 置顶：频道维度维护 pinned messages；入口放在消息菜单和频道设置菜单。
3. 转发：提供选择目标频道流程；服务端生成一条引用原消息摘要的新消息，而不是简单复制文本。
4. 写操作都返回显式 Outcome，延续当前 message-flow/room-governance 风格。

### 频道分类与远端 discover

缺陷：频道列表平铺，discover 目前更像本地状态过滤，缺少真实未加入频道发现。

建议：

1. 频道模型增加 `category_id`、`order`、`type`。
2. 左侧频道栏按分类折叠展示。
3. 默认分类可使用 Text Channels、Announcements、Management。
4. P0 先做服务端排序和只读分类展示；拖拽排序留到 P1。
5. discover 接入远端搜索，避免未加入频道搜索长期停留在占位状态。

协议建议：

1. `GET /api/channels/discover?q=`
2. channel record 增加 `category_id/order/type`

### 通知策略

缺陷：已有未读和托盘闪烁基础，但缺少服务器/频道级通知偏好，用户不能控制提醒噪音。

建议：

1. 通知偏好模型包含 server default、channel override、muted、mentions_only。
2. 客户端根据事件和偏好决定托盘闪烁、系统通知、未读计数。
3. P0 可以先做本地持久化。
4. 后续如需要多端同步，再提升为服务端 API。

### 审计日志基础版

缺陷：治理功能已有，但管理员操作缺少可追溯记录。

建议：

1. 服务端提供频道/服务器审计事件列表。
2. 客户端在治理入口增加 Audit 页面。
3. P0 只记录高风险动作：创建/删除频道、踢人、禁言/解除、管理员变更、消息删除、频道资料修改。
4. 审计日志只读展示，不进入普通消息流。

协议建议：

`GET /api/audit_logs`

## 架构落点

P0 能力不应全部塞进 `message-flow`。推荐沿用现有 `chat` 三子域，并新增两个轻量子域。

### message-flow

负责消息本体能力：

1. 搜索结果到消息投影的映射。
2. 消息编辑。
3. 置顶和转发的消息菜单入口。
4. 转发 payload 构造。
5. mention 文本渲染。

不负责通知偏好和审计日志。

### room-session

负责频道目录与当前频道上下文：

1. 频道分类展示。
2. 远端 discover。
3. 选择频道。
4. 跳转到目标消息附近上下文。

搜索结果、mention、置顶点击都应复用同一类跳转流程：选择目标频道，加载目标消息窗口，滚动并高亮。

### room-governance

负责治理动作与入口：

1. 频道治理入口。
2. 置顶列表管理入口。
3. 分类管理动作。
4. 审计日志入口。

审计日志本身不应继续塞进 governance service，避免治理服务膨胀。

### chat/notifications

候选新增子域，负责：

1. 服务器/频道通知偏好。
2. 提及收件箱。
3. mention unread。
4. 桌面通知和托盘策略适配。

它依赖 session 当前服务器上下文和事件流，但不直接修改消息时间线。

### chat/audit-log

候选新增子域，负责：

1. 审计事件查询。
2. 筛选。
3. 只读列表和详情展示。

它消费服务端 API，不反向依赖治理页面内部状态。

## API 参数设计

本节是 P0 能力的准协议设计。正式落地时应拆入 `docs/api/*`，并保持错误模型、分页结构和 ID 约定与 `docs/api/13-error-model-and-reasons-v1.md`、`docs/api/14-pagination-and-cursor-v1.md` 一致。

### 公共约定

1. 所有实体 ID 继续使用字符串：`uid/cid/mid/category_id/pin_id/mention_id/audit_id`。
2. 时间统一使用 Unix epoch milliseconds。
3. 分页响应统一使用 `{ items, next_cursor, has_more }`。
4. `limit` 默认 20，最大 50；审计日志可默认 50，最大 100。
5. 客户端不得解析 cursor，不得跨端点复用 cursor。
6. 写操作需要服务端生成审计日志，除非该操作本身是通知偏好这类个人设置。
7. 写操作失败时客户端必须以 `error.reason` 分支，不解析 `message`。

### 扩展消息模型

现有 message record 建议增加以下可选字段：

```json
{
  "mid": "100",
  "cid": "10",
  "uid": "20",
  "send_time": 1700000000000,
  "domain": "Core:Text",
  "domain_version": "1.0.0",
  "data": { "text": "hello @Alice" },
  "preview": "hello @Alice",
  "reply_to_mid": "0",
  "edited_at": 1700000001000,
  "edit_version": 2,
  "mentions": [
    { "type": "user", "uid": "30" }
  ],
  "forwarded_from": {
    "mid": "90",
    "cid": "8",
    "uid": "31",
    "preview": "original message",
    "send_time": 1699999999000
  }
}
```

字段说明：

1. `edited_at`：消息最后一次编辑时间；未编辑时缺省。
2. `edit_version`：消息编辑版本，从 1 开始；客户端可用于乐观并发。
3. `mentions`：服务端规范化后的提及目标列表。
4. `forwarded_from`：转发消息的来源摘要；不要求客户端访问原频道时也能读取完整原消息。

`mentions[].type` P0 只要求 `user`，但预留：

```json
{ "type": "user", "uid": "30" }
{ "type": "role", "role_id": "moderator" }
{ "type": "everyone" }
```

### 发送消息扩展

现有 `POST /api/channels/{cid}/messages` 建议扩展请求字段：

```json
{
  "domain": "Core:Text",
  "domain_version": "1.0.0",
  "data": { "text": "hello @Alice" },
  "reply_to_mid": "0",
  "mentions": [
    { "type": "user", "uid": "30" }
  ],
  "client_message_id": "local_01H..."
}
```

字段说明：

1. `mentions` 可选；客户端传入的是候选提及目标，服务端必须重新校验、去重、按权限过滤并写回规范化结果。
2. `client_message_id` 可选；用于客户端把本地 optimistic message 与服务端返回消息关联，不参与服务端全局 ID 语义。
3. 发送幂等仍优先使用 HTTP `Idempotency-Key` header；`client_message_id` 不替代幂等键。
4. P0 不允许客户端通过 `mentions` 直接触发 `role` 或 `everyone` 提及；服务端应返回 `forbidden` 或降级忽略，具体策略必须稳定。

响应继续返回完整 message record，并带上服务端规范化后的 `mentions`。

新增错误：

1. `mention_target_invalid`：提及目标不存在、不可见或格式非法。
2. `mention_not_allowed`：当前用户无权使用该提及类型。

这两个 reason 可在 P0 先统一映射为 `validation_failed` / `forbidden`，但正式 API 文档应保留细分空间。

### 扩展频道模型

现有 channel record 建议增加：

```json
{
  "cid": "10",
  "name": "General",
  "brief": "",
  "avatar": "",
  "owner_uid": "20",
  "category_id": "cat_text",
  "category_name": "Text Channels",
  "order": 1000,
  "type": "text",
  "joined": true,
  "join_requested": false
}
```

字段说明：

1. `category_id`：频道分类 ID；无分类时可为 `"default"`。
2. `category_name`：分类展示名，P0 可随频道返回，后续可拆成独立 categories API。
3. `order`：服务端排序键，数值越小越靠前。
4. `type`：P0 支持 `text`、`announcement`、`management`；其他类型客户端降级为 `text` 展示。
5. `joined`：当前用户是否已加入；`GET /api/channels` 通常只返回已加入频道，此字段用于 discover 复用同一模型。
6. `join_requested`：当前用户是否已提交待处理申请。

现有 `GET /api/channels` 无需新增 query 参数即可返回这些字段。客户端必须能兼容旧服务端缺省字段：

1. `category_id` 缺省时归入 `"default"`。
2. `category_name` 缺省时展示为 `"Channels"`。
3. `order` 缺省时按服务端返回顺序展示。
4. `type` 缺省时按 `"text"` 处理。

### 消息搜索

`GET /api/channels/{cid}/messages/search`

Path：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cid` | string | 是 | 目标频道 ID |

Query：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 搜索词，trim 后长度 1-100 |
| `cursor` | string | 否 | 不透明分页游标 |
| `limit` | number | 否 | 默认 20，最大 50 |
| `sender_uid` | string | 否 | 按发送者过滤，P0 可选 |
| `domain` | string | 否 | 按消息 domain 过滤，P0 可选 |
| `before_mid` | string | 否 | 只查该消息之前的结果，P1 可选 |
| `after_mid` | string | 否 | 只查该消息之后的结果，P1 可选 |

响应：

```json
{
  "items": [
    {
      "message": {
        "mid": "100",
        "cid": "10",
        "uid": "20",
        "sender": { "uid": "20", "nickname": "Alice", "avatar": "avatars/u/20.png" },
        "send_time": 1700000000000,
        "domain": "Core:Text",
        "domain_version": "1.0.0",
        "data": { "text": "search target" },
        "preview": "search target"
      },
      "match": {
        "snippet": "search target",
        "ranges": [
          { "start": 0, "end": 6 }
        ]
      }
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

错误：

1. `validation_failed`：`q` 为空、过长或 `limit` 越界。
2. `not_channel_member`：当前用户不在频道中。
3. `not_found`：频道不存在。
4. `cursor_invalid`：cursor 无效或过期。

### 消息上下文定位

搜索、提及、置顶列表点击后都需要加载目标消息附近上下文。建议扩展现有消息列表端点：

`GET /api/channels/{cid}/messages?around_mid={mid}&before={n}&after={n}`

Query：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `around_mid` | string | 否 | 目标消息 ID |
| `before` | number | 否 | 目标消息之前加载条数，默认 25，最大 50 |
| `after` | number | 否 | 目标消息之后加载条数，默认 25，最大 50 |

响应仍使用现有 `ChatMessagePage`，但当 `around_mid` 存在时，`items` 应包含目标消息；若目标消息已删除或不可访问，返回 `not_found`。

### 消息编辑

`PATCH /api/messages/{mid}`

Path：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mid` | string | 是 | 目标消息 ID |

请求：

```json
{
  "domain": "Core:Text",
  "domain_version": "1.0.0",
  "data": { "text": "updated text" },
  "mentions": [
    { "type": "user", "uid": "30" }
  ],
  "expected_edit_version": 1
}
```

字段说明：

1. P0 只要求 `Core:Text` 可编辑。
2. `mentions` 可由客户端传入候选列表，但服务端必须重新校验和规范化。
3. `expected_edit_version` 可选；提供后服务端用于乐观并发，版本不匹配返回 `conflict`。

响应：

```json
{
  "message": {
    "mid": "100",
    "cid": "10",
    "uid": "20",
    "send_time": 1700000000000,
    "domain": "Core:Text",
    "domain_version": "1.0.0",
    "data": { "text": "updated text" },
    "preview": "updated text",
    "edited_at": 1700000001000,
    "edit_version": 2,
    "mentions": [
      { "type": "user", "uid": "30" }
    ]
  }
}
```

错误：

1. `message_not_editable`：消息类型或服务端策略不允许编辑。
2. `message_edit_window_expired`：超过允许编辑时间。
3. `forbidden`：非发送者或无管理权限。
4. `conflict`：`expected_edit_version` 过期。
5. `schema_invalid`：domain payload 不符合契约。

新增 reason 建议：

1. `message_not_editable`
2. `message_edit_window_expired`

### 频道置顶

`POST /api/channels/{cid}/pins/{mid}`

请求：

```json
{
  "note": "important context"
}
```

字段说明：

1. `note` 可选，最大 200 字符。
2. 重复置顶同一消息应返回既有 pin 结果，或返回 `conflict`；推荐返回既有结果以保持幂等。

响应：

```json
{
  "pin": {
    "pin_id": "pin_1",
    "cid": "10",
    "mid": "100",
    "pinned_by_uid": "20",
    "pinned_at": 1700000002000,
    "note": "important context",
    "message": {
      "mid": "100",
      "cid": "10",
      "uid": "21",
      "send_time": 1700000000000,
      "domain": "Core:Text",
      "domain_version": "1.0.0",
      "data": { "text": "important" },
      "preview": "important"
    }
  }
}
```

`DELETE /api/channels/{cid}/pins/{mid}`

成功：`204 No Content`

`GET /api/channels/{cid}/pins?cursor=&limit=`

响应：

```json
{
  "items": [
    {
      "pin_id": "pin_1",
      "cid": "10",
      "mid": "100",
      "pinned_by_uid": "20",
      "pinned_at": 1700000002000,
      "note": "important context",
      "message": {}
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

错误：

1. `channel_admin_required`：置顶或取消置顶需要管理员权限。
2. `not_found`：频道或消息不存在。
3. `pin_limit_reached`：频道置顶数量达到上限。

新增 reason 建议：

1. `pin_limit_reached`

### 消息转发

`POST /api/messages/{mid}/forward`

请求：

```json
{
  "target_cid": "11",
  "comment": "see this",
  "idempotency_key": "8e4e7b2b-6a20-4d2a-b1bb-3f7d1d67e83b"
}
```

字段说明：

1. `target_cid`：目标频道 ID。
2. `comment`：可选附言，P0 最大 500 字符。
3. `idempotency_key`：推荐，也可继续使用 HTTP `Idempotency-Key` header；两者同时存在时 header 优先。
4. 服务端应生成新的消息，`forwarded_from` 携带来源摘要。

响应：

```json
{
  "message": {
    "mid": "120",
    "cid": "11",
    "uid": "20",
    "send_time": 1700000003000,
    "domain": "Core:Text",
    "domain_version": "1.0.0",
    "data": { "text": "see this" },
    "preview": "see this",
    "forwarded_from": {
      "mid": "100",
      "cid": "10",
      "uid": "21",
      "preview": "original message",
      "send_time": 1700000000000
    }
  }
}
```

错误：

1. `not_found`：源消息不存在或已被硬删除。
2. `not_channel_member`：不是源频道或目标频道成员。
3. `forbidden`：源消息策略禁止转发。
4. `user_muted`：当前用户在目标频道被禁言。
5. `rate_limited`：转发频率过高。

新增 reason 建议：

1. `message_forward_forbidden`

### 提及收件箱

`GET /api/mentions?cursor=&limit=&unread_only=&cid=`

Query：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cursor` | string | 否 | 不透明分页游标 |
| `limit` | number | 否 | 默认 20，最大 50 |
| `unread_only` | boolean | 否 | 只返回未读提及 |
| `cid` | string | 否 | 限定频道 |

响应：

```json
{
  "items": [
    {
      "mention_id": "men_1",
      "cid": "10",
      "mid": "100",
      "from_uid": "21",
      "target": { "type": "user", "uid": "20" },
      "created_at": 1700000000000,
      "read_at": null,
      "message": {
        "mid": "100",
        "cid": "10",
        "uid": "21",
        "send_time": 1700000000000,
        "domain": "Core:Text",
        "domain_version": "1.0.0",
        "preview": "@you please check"
      }
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

`PUT /api/mentions/{mention_id}/read`

成功响应：

```json
{
  "mention_id": "men_1",
  "read_at": 1700000004000
}
```

`PUT /api/mentions/read_state`

批量标记请求：

```json
{
  "before_mention_id": "men_100",
  "cid": "10"
}
```

字段说明：

1. `before_mention_id` 可选；存在时标记该 mention 及之前的提及为已读。
2. `cid` 可选；存在时只标记该频道内的提及。
3. 两者都缺省时表示标记当前用户所有提及为已读，客户端应二次确认。

错误：

1. `not_found`：mention 不存在。
2. `forbidden`：mention 不属于当前用户。
3. `cursor_invalid`：分页游标无效。

### 通知偏好

P0 可先本地实现；如果进入服务端同步，建议使用以下协议。

`GET /api/notification_preferences`

响应：

```json
{
  "server": {
    "mode": "all",
    "muted_until": 0
  },
  "channels": [
    {
      "cid": "10",
      "mode": "mentions_only",
      "muted_until": 0
    }
  ]
}
```

`PUT /api/channels/{cid}/notification_preference`

请求：

```json
{
  "mode": "mentions_only",
  "muted_until": 0
}
```

`PUT /api/notification_preferences/server`

请求：

```json
{
  "mode": "muted",
  "muted_until": 1700003600000
}
```

字段说明：

1. `mode` 枚举：`all`、`mentions_only`、`muted`、`inherit`。
2. 频道级 `inherit` 表示使用 server 默认。
3. server 级不允许 `inherit`。
4. `muted_until = 0` 表示一直静音；缺省或 null 表示不设置时间边界。

错误：

1. `validation_failed`：mode 非法或 `muted_until` 非法。
2. `not_found`：频道不存在。
3. `not_channel_member`：不是频道成员。

### 远端频道发现

`GET /api/channels/discover?q=&cursor=&limit=`

Query：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | 否 | 搜索词；缺省时返回推荐或公开频道 |
| `cursor` | string | 否 | 不透明分页游标 |
| `limit` | number | 否 | 默认 20，最大 50 |
| `type` | string | 否 | `text`、`announcement`、`management` |

响应：

```json
{
  "items": [
    {
      "cid": "12",
      "name": "Rules",
      "brief": "server rules",
      "avatar": "",
      "owner_uid": "20",
      "category_id": "cat_info",
      "category_name": "Information",
      "order": 100,
      "type": "announcement",
      "joined": false,
      "join_requested": true,
      "member_count": 120,
      "requires_application": true
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

错误：

1. `validation_failed`：查询参数非法。
2. `cursor_invalid`：分页游标无效。

### 审计日志

`GET /api/audit_logs?cursor=&limit=&cid=&actor_uid=&action=&from_time=&to_time=`

Query：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `cursor` | string | 否 | 不透明分页游标 |
| `limit` | number | 否 | 默认 50，最大 100 |
| `cid` | string | 否 | 限定频道 |
| `actor_uid` | string | 否 | 操作者 |
| `action` | string | 否 | 动作类型 |
| `from_time` | number | 否 | 起始时间，epoch ms |
| `to_time` | number | 否 | 结束时间，epoch ms |

响应：

```json
{
  "items": [
    {
      "audit_id": "aud_1",
      "server_id": "550e8400-e29b-41d4-a716-446655440000",
      "cid": "10",
      "actor_uid": "20",
      "target": {
        "type": "message",
        "id": "100"
      },
      "action": "message.delete",
      "created_at": 1700000005000,
      "reason": "spam",
      "metadata": {
        "preview": "deleted message preview"
      }
    }
  ],
  "next_cursor": null,
  "has_more": false
}
```

P0 `action` 建议枚举：

1. `channel.create`
2. `channel.delete`
3. `channel.update`
4. `channel.member.kick`
5. `channel.admin.grant`
6. `channel.admin.revoke`
7. `channel.ban.create`
8. `channel.ban.delete`
9. `message.delete`
10. `message.edit`
11. `message.pin`
12. `message.unpin`

错误：

1. `channel_admin_required`：无查看审计日志权限。
2. `validation_failed`：筛选参数非法。
3. `cursor_invalid`：分页游标无效。

### WS 事件扩展

WS 事件只作为增量刷新和实时提示。关键状态必须能通过 HTTP 重新拉取恢复。

`message.updated`

```json
{
  "cid": "10",
  "message": {
    "mid": "100",
    "cid": "10",
    "uid": "20",
    "send_time": 1700000000000,
    "domain": "Core:Text",
    "domain_version": "1.0.0",
    "data": { "text": "updated text" },
    "preview": "updated text",
    "edited_at": 1700000001000,
    "edit_version": 2
  }
}
```

`message.pinned`

```json
{
  "cid": "10",
  "mid": "100",
  "pin_id": "pin_1",
  "pinned_by_uid": "20",
  "pinned_at": 1700000002000
}
```

`message.unpinned`

```json
{
  "cid": "10",
  "mid": "100",
  "pin_id": "pin_1",
  "unpinned_by_uid": "20",
  "unpinned_at": 1700000003000
}
```

`mention.created`

```json
{
  "mention_id": "men_1",
  "cid": "10",
  "mid": "100",
  "from_uid": "21",
  "target": { "type": "user", "uid": "20" },
  "created_at": 1700000000000
}
```

`audit_log.created`

```json
{
  "audit_id": "aud_1",
  "cid": "10",
  "actor_uid": "20",
  "action": "message.delete",
  "created_at": 1700000005000
}
```

`channel.category_changed`

```json
{
  "cid": "10",
  "category_id": "cat_text",
  "category_name": "Text Channels",
  "order": 1000,
  "type": "text"
}
```

### 新增错误 reason 汇总

建议在正式 API 文档中补充：

1. `message_not_editable`
2. `message_edit_window_expired`
3. `message_forward_forbidden`
4. `pin_limit_reached`

其余错误优先复用现有 `validation_failed`、`forbidden`、`not_found`、`conflict`、`cursor_invalid`、`rate_limited`、`not_channel_member`、`channel_admin_required`、`user_muted`。

## 页面落点

1. ChatCenter 顶部增加搜索入口和置顶入口。
2. 消息菜单扩展 edit、pin、forward。
3. ChannelRail 增加分类分组、折叠状态、远端 discover 状态。
4. MembersRail 暂不扩展，避免右栏变重。
5. ChannelSettingsMenu 增加 pins、audit、notification preferences 入口。
6. Mention Inbox 可先放在 QuickSwitcher 或左侧顶部，作为轻入口，不做复杂独立页面。

## 错误处理与恢复

新增能力继续使用显式 Outcome，不把业务失败藏在异常字符串里。

建议错误码覆盖：

1. 搜索失败。
2. 目标消息不存在或不可访问。
3. 消息不可编辑。
4. 消息编辑失败。
5. 置顶失败。
6. 转发失败。
7. 提及列表拉取失败。
8. 通知偏好保存失败。
9. 审计日志拉取失败。
10. 远端 discover 失败。

恢复策略：

1. 搜索、mentions、pins、audit logs 都必须支持 HTTP 重拉。
2. WS 断线恢复失败时，session catch-up 后应刷新 mentions 和 pins 摘要。
3. 通知偏好本地持久化失败时，UI 应保留原偏好并展示错误。

## 验收口径

这份 spec 的验收不是“所有功能都实现”，而是清楚回答：

1. CarryPigeon 当前作为频道社群型 IM 缺哪些关键能力。
2. 哪些能力属于 P0/P1/P2。
3. P0 能力应放在哪个 chat 子域或新增子域。
4. 哪些能力必须扩协议/服务端，哪些客户端可先做壳或本地实现。
5. 后续实现不会把 ChatCenter、message-flow 或 runtime store 重新堆成大杂烩。

## 相关链接

1. `docs/design/PRD.md`
2. `docs/api/11-http-endpoints-v1.md`
3. `docs/api/12-ws-events-v1.md`
4. `src/features/chat/README.md`
5. `src/features/chat/message-flow/README.md`
6. `src/features/chat/room-session/README.md`
7. `src/features/chat/room-governance/README.md`
8. Discord Roles and Permissions: https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions
9. Discord Threads FAQ: https://support.discord.com/hc/en-us/articles/4403205878423-Threads-FAQ
10. Discord Forum Channels FAQ: https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ
11. Discord AutoMod FAQ: https://support.discord.com/hc/en-us/articles/4421269296535-AutoMod-FAQ
12. QQ 机器人官方文档: https://bot.q.qq.com/wiki/
