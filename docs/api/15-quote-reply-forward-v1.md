# 15｜引用回复与多消息转发 API 约束（v1）

版本：v1.2（draft）
日期：2026-07-26

## 1. 背景与目标

客户端（CarryPigeon Desktop）已实现「引用回复」「内联引用」「单条/合并转发」能力，但早期实现把关系元数据放在消息顶层（`reply_to_mid`、`reply_to`、`quote_reply`、`forwarded_from`、`forwarded_messages`）。这种设计把「消息关系」与「消息内容」混在同一层，导致：

- 任何 domain（文本、图片、插件消息）都要重复携带同样的关系字段。
- 转发消息丢失了「它是一条转发消息」的独立语义，只能依赖顶层字段是否存在。
- 服务端难以对「引用」「转发」做统一校验、索引、存储策略。

本文把这两类能力收口为两个独立的 **Core domain（包装域）**：

- `Core:ReplyText`：表示「这是一条回复/引用消息」。
- `Core:Forward`：表示「这是一条转发消息」。

包装域把「关系元数据」和「实际内容」封装进 `data`，让顶层消息结构保持通用，与 `docs/design/protocol/MESSAGE-DOMAINS.md` 的「统一消息字段」完全对齐。

> 聊天走远程 HTTP（非 Tauri command），故本文属于 `docs/api/` 协议真源，与 `11-http-endpoints-v1.md`、`12-ws-events-v1.md`、`13-error-model-and-reasons-v1.md` 对齐。

## 2. 适用范围

- 协议：HTTP + WebSocket（v1）。
- 受众：服务端负责人（据此实现/校验后端适配）。
- 本文仅描述服务端契约；前端代码会同步适配，但契约本身不依赖具体实现。

## 3. 全局约定（必须）

继承 `docs/api/00-versioning-and-compatibility.md`：

- 所有字段 **snake_case**。
- 所有时间字段为 **Unix epoch 毫秒**（`int64`）。
- 所有实体 ID（mid / cid / uid / file_id 等）为 Snowflake 64 位，**JSON 中以十进制字符串传输**（不可丢失精度）。
- 版本协商：`Accept: application/vnd.carrypigeon+json; version=1`（不使用 URL 路径版本）。
- 客户端忽略未知字段；v1 内只允许「只增不破坏」的演进。

## 4. 核心约定：包装域 data 结构

### 4.1 通用消息结构（对齐 `docs/design/protocol/MESSAGE-DOMAINS.md`）

```text
mid, cid, uid, send_time
domain, domain_version
data
```

包装域把「关系元数据」与「嵌套内容」分层表达：`Core:ReplyText` 的回复/引用元数据（`reply_to_mid` / `reply_to` / `quote_reply`）与 `link_preview` 封装在 `data` 内；`Core:Forward` 的 `forwarded_from` / `forwarded_messages` 同样封装在 `data` 内，`data` 还保留 `domain` / `domain_version` / `content` 用于表达可选转发附言。`Core:ReplyText` 的嵌套内容固定为 `Core:Text`，因此其 `data` 不再保留嵌套 domain/version。`mentions` 在两种包装域中均放在消息信封顶层为 `string[]`（snowflake UID），不放入 `data`，与 `Core:Text` 语义一致。

### 4.2 Core:ReplyText（引用回复 / 内联引用）

当一条消息需要表达「回复某条消息」或「内联引用某条消息」时，使用 `domain: "Core:ReplyText"`。回复/引用关系元数据与 `link_preview` 封装在 `data` 内；`mentions` 放在消息信封顶层为 `string[]`（与 `Core:Text` 语义一致，不放入 `data`）：

```json
{
  "domain": "Core:ReplyText",
  "domain_version": "1.0.0",
  "data": {
    "content": { "text": "回复内容" },
    "reply_to_mid": "10086",
    "reply_to": {
      "mid": "10086",
      "sender_name": "Bob",
      "preview": "原消息预览",
      "created_at": 1700000000000,
      "unavailable": false
    },
    "quote_reply": {
      "mid": "10087",
      "uid": "67890",
      "preview": "引用内容预览"
    },
    "link_preview": { "...": "..." }
  },
  "mentions": ["67890"]
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.content` | `unknown` | 嵌套内容 payload，固定为 `Core:Text` 的 `{ text: string }` |
| `data.reply_to_mid` | `string?` | 被回复消息 mid（存在即表示「回复关系」） |
| `data.reply_to` | `object?` | 被回复消息摘要快照，便于离线/跨频道渲染 |
| `data.reply_to.mid` | `string` | 同 `reply_to_mid` |
| `data.reply_to.sender_name` | `string` | 被回复者昵称 |
| `data.reply_to.preview` | `string` | 被回复内容预览 |
| `data.reply_to.created_at` | `int64` | 被回复消息的发送时间（epoch ms） |
| `data.reply_to.unavailable` | `bool?` | 原消息不可用时，客户端据此渲染「引用的消息已不存在」 |
| `data.quote_reply` | `object?` | 内联引用 |
| `data.quote_reply.mid` | `string` | 被引用消息 mid |
| `data.quote_reply.uid` | `string` | 被引用消息发送者 uid |
| `data.quote_reply.preview` | `string` | 被引用内容预览 |
| `data.link_preview` | `object?` | 链接预览（封装在 `data` 内） |
| `mentions` | `string[]?` | @ 提及的 snowflake UID 列表，放在消息信封顶层（与 `Core:Text` 一致，不放入 `data`） |

语义：

- `data.reply_to_mid` 是回复关系的锚点；`data.reply_to` 是可选摘要快照。
- 被回复消息不存在时，客户端以 `data.reply_to.unavailable=true` 渲染。服务端可**不强制失败**（推荐），保留 `data.reply_to_mid`，由客户端标记 unavailable。
- `data.quote_reply` 与 `data.reply_to` 可同时存在，也可单独存在。
- `mentions` 仅承载 UID 字符串；服务端不回传 `display_name` / `type`，由客户端通过 members 等接口自行解析回填展示名。

### 4.3 Core:Forward（单条 / 合并转发）

当一条消息需要表达「转发一条或多条消息」时，使用 `domain: "Core:Forward"`。关系元数据（`forwarded_from` / `forwarded_messages`）封装在 `data` 内，`data` 同时保留 `domain` / `domain_version` / `content` 用于表达可选转发附言：

```json
{
  "domain": "Core:Forward",
  "domain_version": "1.0.0",
  "data": {
    "domain": "Core:Text",
    "domain_version": "1.0.0",
    "content": { "text": "转发附言" },
    "forwarded_from": { "mid": "10086", "cid": "99999", "uid": "54321", "preview": "原消息", "send_time": 1699999999000 }
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `data.domain` | `string` | 嵌套评论内容的 domain（目前只要求支持 `Core:Text`） |
| `data.domain_version` | `string` | 嵌套评论内容的 domain_version |
| `data.content` | `unknown?` | 转发附言（`Core:Text` 时为 `{ text: string }`），可空 |
| `data.forwarded_from` | `ForwardSource?` | 单条转发的原消息来源（封装在 `data` 内） |
| `data.forwarded_messages` | `ForwardSource[]?` | 合并转发的原消息来源列表（封装在 `data` 内） |

`ForwardSource` 结构：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `mid` | `string` | 原消息 mid |
| `cid` | `string` | 原消息所属频道 cid |
| `uid` | `string` | 原消息发送者 uid |
| `preview` | `string` | 原消息内容预览 |
| `send_time` | `int64` | 原消息发送时间（epoch ms） |

语义：

- **单条转发**：`data.forwarded_from` 存在，`data.forwarded_messages` 不存在。
- **合并转发**：`data.forwarded_messages` 存在（≥2 条），`data.forwarded_from` 不存在。
- `data.content` 为可选附言。若为空，`preview` 缺省为 `"转发 N 条消息"`（N 为 `data.forwarded_messages` 长度）。
- `data.forwarded_messages` 顺序必须与客户请求顺序一致。
- ⚠️ **服务端必须填充 `cid` 与 `send_time` 的真实值**，不得留空。
- `forwarded_from` / `forwarded_messages` 必须放在 `data` 内，**不得**放在消息顶层。

### 4.4 与旧结构的兼容

过渡期内（v1.0 到 v1.x）：

- 服务端实现本文新契约即可，不需要同时回显旧结构。
- 客户端在发送时只发送新契约；接收 `Core:ReplyText` 时从 `data` 读取 reply/quote/link_preview 字段，接收 `Core:Forward` 时从 `data` 读取 forwarded 关系字段；`mentions` 在两种包装域中均从消息信封顶层 `string[]` 读取。
- 后端可保留内部表字段 `reply_to_mid` 用于索引，但对外协议中 `Core:ReplyText` 的关系元数据须封装在 `data` 内，`Core:Forward` 的关系元数据同样须封装在 `data` 内。

## 5. HTTP 端点契约

### 5.1 发送消息（引用 / 回复）

- 方法：`POST /api/channels/{cid}/messages`
- 幂等（推荐）：客户端可发送 `Idempotency-Key: <uuid>`，服务端在窗口内对重复 key 返回同一结果。

#### 5.1.1 普通消息（无引用）

与 `docs/api/11-http-endpoints-v1.md` §7.2 一致：

```json
{
  "domain": "Core:Text",
  "domain_version": "1.0.0",
  "data": { "text": "hello" }
}
```

#### 5.1.2 引用回复 / 内联引用

```json
{
  "domain": "Core:ReplyText",
  "domain_version": "1.0.0",
  "data": {
    "content": { "text": "确实如此" },
    "reply_to_mid": "10086",
    "reply_to": {
      "mid": "10086",
      "sender_name": "Bob",
      "preview": "今天 meeting 改到 3 点",
      "created_at": 1700000000000,
      "unavailable": false
    },
    "quote_reply": {
      "mid": "10087",
      "uid": "67890",
      "preview": "下午 3 点"
    },
    "link_preview": { "url": "https://example.com" }
  },
  "mentions": ["67890"],
  "client_message_id": "client-abc"
}
```

- 成功：`201 Created`，返回完整 message（`domain: "Core:ReplyText"`，`data` 与请求一致并补全服务端字段如 `send_time`）。
- 服务端必须保证：
  - 列表/拉取接口（`GET /api/channels/{cid}/messages`）回显 `domain: "Core:ReplyText"`、完整 `data`（含 `reply_to_mid` / `reply_to` / `quote_reply` / `link_preview`）；`mentions` 在信封顶层为 `string[]`。

### 5.2 转发

- 方法：`POST /api/messages/{mid}/forward`
- 鉴权：Bearer access token；可选 `Idempotency-Key` 头。
- 请求体（`ChatMessageForwardWire`）：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `target_cid` | `string` | 是 | 目标频道 cid |
| `comment` | `string?` | 否 | 转发附言（放入 `data.content.text`） |
| `merged_mids` | `string[]?` | 否 | 存在且非空 ⇒ 合并转发；否则单条转发 |
| `idempotency_key` | `string?` | 否 | 同时以 `Idempotency-Key` HTTP 头传递，二选一即可 |

#### 5.2.1 单条转发

请求：

```json
{
  "target_cid": "12345",
  "comment": "看看这条"
}
```

响应（`201 Created`，新消息 `domain: "Core:Forward"`；服务端 canonical 信封不携带 `sender`，作者信息由客户端通过 members 等接口解析）：

```json
{
  "mid": "20001",
  "cid": "12345",
  "uid": "67890",
  "send_time": 1700000005000,
  "domain": "Core:Forward",
  "domain_version": "1.0.0",
  "data": {
    "domain": "Core:Text",
    "domain_version": "1.0.0",
    "content": { "text": "看看这条" },
    "forwarded_from": {
      "mid": "10086",
      "cid": "99999",
      "uid": "54321",
      "preview": "original message",
      "send_time": 1699999999000
    }
  },
  "preview": "看看这条"
}
```

#### 5.2.2 合并转发

请求：

```json
{
  "target_cid": "12345",
  "comment": "三则重要通知",
  "merged_mids": ["10086", "10087", "10088"]
}
```

响应（`201 Created`，`domain: "Core:Forward"`，`data.forwarded_messages` 顺序与 `merged_mids` 一致）：

```json
{
  "mid": "20002",
  "cid": "12345",
  "uid": "67890",
  "send_time": 1700000006000,
  "domain": "Core:Forward",
  "domain_version": "1.0.0",
  "data": {
    "domain": "Core:Text",
    "domain_version": "1.0.0",
    "content": { "text": "三则重要通知" },
    "forwarded_messages": [
      { "mid": "10086", "cid": "99999", "uid": "54321", "preview": "msg a", "send_time": 1699999999000 },
      { "mid": "10087", "cid": "99998", "uid": "54322", "preview": "msg b", "send_time": 1699999999100 },
      { "mid": "10088", "cid": "99998", "uid": "54322", "preview": "msg c", "send_time": 1699999999200 }
    ]
  },
  "preview": "转发 3 条消息"
}
```

合并转发语义补充：

- 新消息 `data.content.text = comment`；若 `comment` 为空，则 `data.content` 整体为空，`preview` 缺省为 `"转发 N 条消息"`（N 为 `data.forwarded_messages` 长度）。
- `merged_mids` 中无法解析的项：后端可保留其 `mid` 并在 `preview` 留空，但**不得丢弃整体请求**。
- URL 的 `{mid}` 为锚点（首个选中消息），后端以 `merged_mids` 内容为准；单条转发时 `{mid}` 即原消息。
- `forwarded_from` / `forwarded_messages` 必须放在 `data` 内，而非消息顶层。

## 6. WS 事件契约

复用 `message.created`（frame 结构见 `docs/api/12-ws-events-v1.md`）：

```json
{
  "type": "message.created",
  "id": "<event_id>",
  "ts": 1700000006000,
  "data": {
    "cid": "12345",
    "message": {
      "mid": "20002",
      "cid": "12345",
      "uid": "67890",
      "send_time": 1700000006000,
      "domain": "Core:Forward",
      "domain_version": "1.0.0",
      "data": {
        "domain": "Core:Text",
        "domain_version": "1.0.0",
        "content": { "text": "三则重要通知" },
        "forwarded_messages": [
          { "mid": "10086", "cid": "99999", "uid": "54321", "preview": "msg a", "send_time": 1699999999000 }
        ]
      },
      "preview": "转发 3 条消息"
    }
  }
}
```

- `Core:ReplyText` / `Core:Forward` 消息创建后，服务端**必须推送 `message.created`**，且 `data.message` 须完整携带第 4 节定义的 `data`（关系元数据封装在 `data` 内，`mentions` 在信封顶层为 `string[]`）。
- 无需新增 WS 事件类型。

## 7. 错误语义

对齐 `docs/api/13-error-model-and-reasons-v1.md`：

| reason | HTTP | 触发场景 |
| --- | --- | --- |
| `unauthorized` | 401 | 缺 access token |
| `validation_failed` | 400 | 请求字段校验失败，如 `data` 内缺少 `reply_to_mid`、`target_cid` 缺失、`merged_mids` 非法 |
| `not_found` | 404 | `target_cid` 不存在；单条转发的 `{mid}` 原消息不存在 |
| `forbidden` | 403 | 调用者对 `target_cid` 无发送权限 |

字段级错误示例：

```json
{
  "error": {
    "status": 400,
    "reason": "validation_failed",
        "message": "Missing reply_to_mid",
        "request_id": "req-...",
        "details": {
          "field_errors": [
            { "field": "reply_to_mid", "reason": "required", "message": "reply_to_mid is required for Core:ReplyText" }
          ]
        }
  }
}
```

## 8. 服务端校验与边界要求

1. `Core:ReplyText` 必须校验：
   - `data.content` 必须是 `Core:Text` 的合法 payload（目前为 `{ text: string }`）。
   - `data.reply_to_mid` 与 `data.reply_to.mid` 必须一致（若两者同时存在）。
   - 顶层 `mentions` 必须为 `string[]`（snowflake UID），不得是对象数组。
2. `Core:Forward` 必须校验：
   - `data.forwarded_from` 与 `data.forwarded_messages` 不能同时存在。
   - 若 `data.forwarded_messages` 存在，长度须 ≥ 2。
   - `data.forwarded_messages` 顺序须与请求 `merged_mids` 一致。
   - 必须填充 `cid` 与 `send_time` 真实值。
   - 关系元数据必须放在 `data` 内，不得放在消息顶层。
3. 跨频道转发：服务端必须校验调用者对 `target_cid` 有发送权限，否则返回 `403 forbidden`。
4. 幂等：`Idempotency-Key` 重复时返回同一结果，不产生重复消息。

## 9. 变更记录

| 日期 | 版本 | 说明 |
| --- | --- | --- |
| 2026-07-16 | v1.0 draft | 初版：采用顶层字段模型 |
| 2026-07-17 | v1.1 draft | 重构为 `Core:ReplyText` / `Core:Forward` 包装域：`Core:ReplyText` 的关系元数据封装在 `data` 内，`mentions` / `link_preview` 保留在顶层；`Core:Forward` 的关系元数据放在顶层 |
| 2026-07-26 | v1.2 draft | 收口契约以对齐前端实现：`Core:ReplyText` 的 `link_preview` 改放 `data` 内（仅 `mentions` 在顶层为 `string[]`）；`Core:Forward` 的 `forwarded_from` / `forwarded_messages` 改放 `data` 内；canonical 信封不再携带 `sender`；移除已下线的 `DELETE /api/messages/{mid}` 与 `message.deleted` 事件相关引用（由 `POST .../recall` + `message.recalled` 取代，见 `11-http-endpoints-v1.md` §7.3 / `12-ws-events-v1.md` §5.2） |

## 10. 相关链接

- `docs/api/00-versioning-and-compatibility.md`：兼容与演进规则（snake_case、epoch ms、字符串 ID）
- `docs/api/11-http-endpoints-v1.md`：资源端点（§7 Messages）
- `docs/api/12-ws-events-v1.md`：`message.created` 事件帧
- `docs/api/13-error-model-and-reasons-v1.md`：错误 `reason` 与 `field_errors`
- `docs/api/14-pagination-and-cursor-v1.md`：游标与补拉
- `docs/design/protocol/MESSAGE-DOMAINS.md`：统一消息字段定义
- 前端 wire 模型：`src/features/chat/data/protocol/chatWireModels.ts`
