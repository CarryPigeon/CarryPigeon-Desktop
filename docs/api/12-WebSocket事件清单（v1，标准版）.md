# 12｜WebSocket 事件清单（v1，标准版）

版本：v1.0（draft）  
日期：2026-02-01  

## 1. 连接入口

- URL：`wss://{host}/api/ws`
- 连接成功后必须先发 `auth`（见 `docs/api/10-HTTP+WebSocket协议（v1，标准版）.md`）。

## 2. 事件 envelope（服务端 -> 客户端）

服务端推送事件统一格式：

```json
{
  "type": "event",
  "data": {
    "event_id": "723155640365318144",
    "event_type": "message.created",
    "server_time": 1700000000000,
    "payload": {}
  }
}
```

字段说明：
- `event_id`：单调递增的事件序号（服务端雪花 ID，JSON 编码为十进制字符串；跨重连用于 resume）
- `event_type`：事件类型（见第 5 节）
- `payload`：事件数据

> 说明：`event_id` 的生成算法以服务端实现为准（推荐 Snowflake）。客户端只需要把它当作“不透明且单调递增”的字符串使用（用于 resume 与去重）。

## 3. 命令响应（服务端 -> 客户端）

对客户端命令（如 `auth`/`reauth`/`subscribe`）的响应使用“同名 ok/err”：

```json
{ "type": "auth.ok", "id": "1", "data": {} }
```

或：

```json
{ "type": "auth.err", "id": "1", "error": { "reason": "unauthorized", "message": "..." } }
```

约定：
- `id` 必须回显客户端请求的 `id`，用于匹配请求/响应。
- `data` 为命令响应数据（不同命令不同字段）。
- `error` 结构应与 HTTP `error` 模型一致（字段子集即可），详见 `docs/api/13-错误模型与Reason枚举（v1，标准版）.md`。

可选扩展（当需要显式订阅时）：

```json
{ "type": "subscribe", "id": "3", "data": { "cids": ["1", "2", "3"] } }
```

对应响应：

```json
{ "type": "subscribe.ok", "id": "3", "data": { "cids": ["1", "2", "3"] } }
```

## 4. resume（断线恢复）

### 4.1 客户端请求 resume

在 `auth.data.resume.last_event_id` 提供最后已处理的 `event_id`。

### 4.2 服务端行为

- 若可回放：服务端从 `last_event_id` 之后开始补发事件（按 `event_id` 顺序）
- 若不可回放：返回 `resume.failed`，客户端必须走 HTTP 补拉（频道列表/消息列表/未读等）

示例（不可回放）：

```json
{
  "type": "resume.failed",
  "data": { "reason": "event_too_old" }
}
```

## 5. 事件类型与 payload（P0）

### 5.0 `channels.changed`

触发：频道列表需要刷新（例如创建/删除频道，或当前用户被踢出/加入频道等导致列表变化）

```json
{ "hint": "refresh" }
```

### 5.1 `message.created`

触发：频道新消息产生（包括 Core:Text 与插件 domain）

```json
{
  "cid": "12345",
  "message": {
    "mid": "1",
    "cid": "12345",
    "uid": "67890",
    "sender": { "uid": "67890", "nickname": "Bob", "avatar": "avatars/u/67890.png" },
    "send_time": 1700000000000,
    "domain": "Core:Text",
    "domain_version": "1.0.0",
    "data": { "text": "hello" },
    "preview": "hello"
  }
}
```

### 5.2 `message.deleted`

触发：消息被硬删除（删除=消失）

```json
{
  "cid": "12345",
  "mid": "1",
  "delete_time": 1700000001000
}
```

客户端要求（必须）：
- 收到后必须从内存与本地缓存移除该消息。
- 若当前在该频道且 `mid` 不在本地列表，也应视为“状态已同步”而非报错。

### 5.3 `read_state.updated`

触发：同一 `uid` 的任一会话更新读状态后，推送给该 `uid` 的所有在线会话

```json
{
  "cid": "12345",
  "uid": "67890",
  "last_read_mid": "100",
  "last_read_time": 1700000000000
}
```

### 5.4 `channel.changed`

触发：频道资料/成员/管理员/禁言/申请等导致“频道视图需要刷新”的变更

```json
{ "cid": "12345", "scope": "members", "hint": "refresh" }
```

> 说明：v1 允许此类事件只给“刷新提示”，以减少事件面数量；客户端收到后按上下文调用对应 HTTP 接口补拉。

`scope` 建议枚举（便于客户端做更精确的刷新）：
- `profile`：频道资料（name/brief/avatar 等）
- `members`：成员/管理员变更（踢人、设/撤管理员等）
- `applications`：入群申请列表变更
- `bans`：禁言列表变更
- `messages`：消息相关（一般优先用 `message.created/deleted`，此处仅作为兜底提示）

## 6. 心跳

为了穿透代理与保持连接活性：

- 客户端每 30s 发送：`{ "type": "ping" }`
- 服务端回应：`{ "type": "pong" }`

若服务端在一定时间未收到心跳，可主动断开连接，客户端应指数退避重连并走 `resume`。
