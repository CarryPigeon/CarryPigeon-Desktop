# 10｜HTTP + WebSocket 协议（v1，标准版）

版本：v1.0（draft）  
日期：2026-02-01  

## 1. 目标与取舍

本 v1 设计以“标准化 + 灵活性优先”为目标，明确取舍：

- HTTP：承担“请求/响应”的资源访问（幂等/可缓存/易调试/易代理）。
- WebSocket：承担“事件流”的实时推送与低延迟交互（订阅、增量、回放）。
- 不考虑与现行 TCP/Netty 路由（`docs/客户端开发指南.md`）的向前兼容；v1 是一套全新对外协议。

## 1.1 与 UI 的阶段对齐（Handshake → Verify → Auth）

为了对齐 UI 规格中的阶段表达（`docs/design/ui/solution-a-patchbay/04-页面规格-登录与连接.md`），建议客户端把连接流程拆为：

- Handshake：建立 TLS 连接 + HTTP/WS 握手（网络可达性、证书校验等）
- Verify：`GET /api/server` 校验 API 版本兼容、获取 `server_id`、required 列表与 capabilities
- Auth：`POST /api/auth/tokens` 获取 token 并进入“已登录”状态，然后建立 WS 并 `auth`

## 2. Base URL 与版本

- HTTP Base：`https://{host}/api`
- WS 入口：`wss://{host}/api/ws`
- 版本区分：**不使用 URL 路径版本**（不采用 `/api/{version}/...` 形式）。

### 2.1 版本协商（推荐）

由于不使用路径版本，v1 推荐使用 **Media Type Versioning**（更标准的做法）：

```
Accept: application/vnd.carrypigeon+json; version=1
Content-Type: application/json; charset=utf-8
```

约定：
- 若客户端未显式提供 `Accept` 的 `version`，服务端可默认按 `version=1` 处理（或返回 406，由服务端策略决定）。
- 服务端应在 `GET /api/server` 返回 `api_version` 与 `min_supported_api_version`，便于客户端在升级/降级时做策略判断。

## 3. 通用约定（必须）

### 3.1 字段命名

- 所有 JSON 字段：`snake_case`

### 3.2 时间口径

- 所有时间字段：Unix epoch 毫秒（`int64`）

### 3.3 ID 类型

- `server_id`：UUID 字符串（服务端稳定不变）
- 雪花 ID（Snowflake）：除 `server_id` 等少数标识外，本协议中所有“实体 ID”均由服务端通过雪花算法生成（64-bit），用于：
  - `uid`（用户）
  - `cid`（频道）
  - `mid`（消息）
  - `application_id`（入群申请）
  - `file_id`（文件）
  - `event_id`（事件流序号）
  - `last_read_mid`（读状态锚点）

为避免 JS/TS 客户端发生 `Number` 精度丢失，本协议要求上述雪花 ID 在 JSON 中统一编码为**十进制字符串**：
- ✅ `"mid": "723155640365318144"`
- ❌ `"mid": 723155640365318144`

### 3.4 Content-Type

- 请求：`Content-Type: application/json; charset=utf-8`
- 响应（推荐）：`Content-Type: application/vnd.carrypigeon+json; version=1`
- 响应（兼容）：也可返回 `application/json; charset=utf-8`（客户端不应依赖 response Content-Type 做版本分支）

### 3.5 图片与文件 URL 规则（必须）

为保证“自建服务器可迁移/可换域名/可换端口”，API 返回的图片/文件地址必须为**相对路径**，不得包含 `https://<域名>`。

约定：
- 所有图片字段（例如 `avatar`）返回：`relative_path: string`
  - ✅ `avatars/u/123.png`
  - ✅ `api/files/download/server_avatar`
  - ❌ `https://example.com/avatars/u/123.png`
- 客户端拼接方式（示例）：`https://{server_host}/{relative_path}`
  - `server_host` 由客户端当前连接的 `server_socket`（或其解析后的 host:port）确定

## 4. 服务器信息与 required gate（P0）

### 4.1 获取服务器信息（不需要登录）

客户端必须在任何插件相关动作前获取 `server_id`（用于本地隔离与缓存命名空间），并拉取 required gate 信息：

- `GET /api/server`（见 `docs/api/11-http-endpoints-v1.md`）

### 4.2 required gate 的核心规则（P0）

- 未满足 required 时：
  - 允许：获取 server 信息、获取插件目录、下载插件包、查看公共信息
  - 禁止：创建会话/发 token（即“登录相关动作”）
- “是否满足 required”由服务端根据客户端上报的 `installed_plugins[]` 判定（见 5.3）。

> 说明：required gate 属于产品策略（强制引导安装插件），本质是“认证前置条件”，不等同于权限校验。

## 5. 鉴权（HTTP + WS）

### 5.1 token 模型

- `access_token`：短期（建议 5–30 分钟），用于 HTTP `Authorization` 与 WS 会话绑定
- `refresh_token`：长期（建议 7–30 天），仅用于换发 access token；服务端必须支持吊销与轮换

### 5.2 HTTP 鉴权方式

业务请求携带：

```
Authorization: Bearer <access_token>
```

### 5.3 required gate 与登录的交互（关键）

为了让服务端能判断 required 是否满足，创建会话（获取 token）的请求必须包含客户端“已安装插件声明”：

```json
{
  "grant_type": "email_code",
  "email": "user@example.com",
  "code": "123456",
  "client": {
    "device_id": "a-stable-device-id",
    "installed_plugins": [
      { "plugin_id": "mc-bind", "version": "1.2.0" }
    ]
  }
}
```

若 required 未满足，服务端必须拒绝发 token，并返回统一错误：

- HTTP：`412 Precondition Failed`
- `error.reason = "required_plugin_missing"`
- `error.details.missing_plugins = ["mc-bind"]`

详见 `docs/api/13-error-model-and-reasons-v1.md`。

## 6. WebSocket：连接、鉴权与订阅

### 6.1 连接策略（推荐）

- 先用 HTTP 获取/刷新 `access_token`
- 再建立 WS 连接：`wss://{host}/api/ws`
- 连接成功后第一帧发送 `auth` 消息完成鉴权（浏览器/桌面端都兼容；无需自定义 Header）

### 6.2 WS 帧统一格式

所有 WS 消息（客户端->服务端、服务端->客户端）统一为 JSON：

```json
{
  "type": "message_type",
  "id": "client_generated_request_id",
  "ts": 1700000000000,
  "data": {}
}
```

字段说明：
- `type`：消息类型（命令或事件）
- `id`：可选；用于命令请求与响应关联（建议 UUID）；事件推送通常不带 `id`
- `ts`：可选；客户端可填本地时间用于日志对齐，服务端不可信任该值
- `data`：payload

### 6.3 WS 鉴权（auth / reauth）

客户端连接后发送：

```json
{
  "type": "auth",
  "id": "1",
  "data": {
    "api_version": 1,
    "access_token": "xxx",
    "device_id": "a-stable-device-id",
    "resume": { "last_event_id": "723155640365318144" }
  }
}
```

服务端响应（成功）：

```json
{
  "type": "auth.ok",
  "id": "1",
  "data": {
    "uid": "123",
    "expires_at": 1700000300000,
    "server_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

当 `access_token` 将过期或已刷新，客户端可发送：

```json
{ "type": "reauth", "id": "2", "data": { "access_token": "new_token" } }
```

### 6.4 订阅模型（推荐最小化）

为保持客户端实现简单，v1 推荐：

- 登录后服务端默认推送与“当前用户有关”的事件：
  - 其加入的频道消息/删除
  - 其账号读状态变更
  - 频道/成员的变更提示
- 若未来需要减少带宽，可扩展为显式订阅（`subscribe` / `unsubscribe`）。

## 7. 事件恢复（resume）与一致性

IM 的真实一致性通常依赖“推送 + 补拉”的组合：

- WS 用于降低延迟（实时事件）
- HTTP 用于兜底一致性（断线重连、丢包、客户端崩溃恢复）

v1 约定：
- 所有服务端推送事件必须携带单调递增 `event_id`（服务端雪花 ID，JSON 编码为十进制字符串）。
- 客户端重连时通过 `resume.last_event_id` 请求服务端补发丢失事件。
- 若服务端无法回放（例如事件已过期），服务端返回 `resume.failed`，客户端必须执行一次“全量/增量补拉”。

事件细节见 `docs/api/12-ws-events-v1.md`。
