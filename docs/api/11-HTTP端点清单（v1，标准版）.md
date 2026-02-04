# 11｜HTTP 端点清单（v1，标准版）

版本：v1.0（draft）  
日期：2026-02-01  

## 1. 约定与分类

- Base：`/api`
- 鉴权：除非标注“公开”，否则必须 `Authorization: Bearer <access_token>`
- 版本（推荐）：`Accept: application/vnd.carrypigeon+json; version=1`（详见 `docs/api/10-HTTP+WebSocket协议（v1，标准版）.md`）
- ID（重要）：除 `server_id/plugin_id/share_key` 等少数标识外，本协议的实体 ID（`uid/cid/mid/...`）均为服务端生成的雪花 ID，且在 JSON 中以**十进制字符串**编码（示例中的数字仅为可读性占位）。
- 响应错误：统一结构见 `docs/api/13-错误模型与Reason枚举（v1，标准版）.md`
- 分页与 cursor：见 `docs/api/14-分页与游标规范（v1，标准版）.md`

## 2. Server（公开）

### 2.1 获取服务器信息（必须先调用）

- 方法：`GET /api/server`
- 鉴权：公开
- 成功响应（示例）：

```json
{
  "server_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "CarryPigeon Server",
  "brief": "A self-hosted chat server",
  "avatar": "api/files/download/server_avatar",
  "api_version": "1.0",
  "min_supported_api_version": "1.0",
  "ws_url": "wss://example.com/api/ws",
  "required_plugins": ["mc-bind"],
  "capabilities": {
    "message_domains": true,
    "plugin_catalog": true,
    "event_resume": true
  },
  "server_time": 1700000000000
}
```

字段说明：
- `server_id`：服务端稳定 UUID（客户端用于插件安装与缓存隔离）
- `required_plugins`：required gate 列表（P0）
- `avatar`：服务端头像相对路径（不得包含域名；客户端按 `https://{server_host}/{avatar}` 拼接）

### 2.2 required gate 预检查（用于 Required 向导的 “Recheck”）

> 目的：让客户端在“无需登录”的情况下，把本地安装态（installed_plugins）提交给服务端做一次 required gate 的判定，避免把“重试检查”绑定到登录接口。

- 方法：`POST /api/gates/required/check`
- 鉴权：公开
- 请求：

```json
{
  "client": {
    "device_id": "a-stable-device-id",
    "installed_plugins": [
      { "plugin_id": "mc-bind", "version": "1.2.0" }
    ]
  }
}
```

- 成功响应（示例）：

```json
{ "missing_plugins": [] }
```

约定：
- 若 `missing_plugins` 非空，客户端应继续停留在 required 向导并引导安装/启用。
- 登录接口 `POST /api/auth/tokens` 仍必须执行 required gate 阻断（本预检查仅用于 UX）。

## 3. Plugins 与 Domains（公开）

### 3.1 获取插件目录（Server Catalog）

- 方法：`GET /api/plugins/catalog`
- 鉴权：公开（required gate 阶段必须可调用）
- 成功响应（示例）：

```json
{
  "required_plugins": ["mc-bind"],
  "plugins": [
    {
      "plugin_id": "math-formula",
      "name": "Math Formula",
      "version": "1.2.0",
      "min_host_version": "0.1.0",
      "required": false,
      "permissions": ["network"],
      "provides_domains": [
        { "domain": "Math:Formula", "domain_version": "1.0.0" }
      ],
      "download": {
        "url": "https://example.com/plugins/math-formula-1.2.0.zip",
        "sha256": "..."
      }
    }
  ]
}
```

约定：
- `provides_domains` 用于客户端在遇到未知 domain 时做“推荐安装插件”的映射。
- 插件生命周期（install/enable/disable/update/rollback）在客户端本地完成；服务端在此处主要承担“目录发现 + 下载指针 + required gate”的职责（详见 `design/client/PLUGIN-CENTER-FLOWS.md`）。

### 3.1.1 Repo Catalog（仓库源，客户端直连第三方）

> UI 规格中存在 “Source: Server / Repo” 切换（见 `docs/ui/方案A-插线板/06-页面规格-插件中心与必需插件门禁.md`）。
>
> 约定：Repo Catalog 不一定由聊天服务端提供；通常是“客户端配置的仓库 URL”，客户端直接以 HTTP 拉取其目录。
>
> 为了降低客户端实现复杂度，Repo Catalog 的响应结构建议与 `GET /api/plugins/catalog` 保持兼容（至少 `plugins[]` 的 item 结构一致）。

示例（仓库侧）：
- 方法：`GET {repo_base}/plugins/catalog`
- 鉴权：通常不需要（由仓库策略决定）
- 成功响应（示例）：

```json
{
  "plugins": [
    {
      "plugin_id": "math-formula",
      "name": "Math Formula",
      "version": "1.2.0",
      "min_host_version": "0.1.0",
      "required": false,
      "permissions": ["network"],
      "provides_domains": [
        { "domain": "Math:Formula", "domain_version": "1.0.0" }
      ],
      "download": {
        "url": "https://repo.example.com/plugins/math-formula-1.2.0.zip",
        "sha256": "..."
      }
    }
  ]
}
```

> Domains 的目的：让客户端/插件开发者能发现“服务端支持哪些 domain、哪些版本、以及契约/约束在哪里”。
>
> 注意：客户端在未安装对应 renderer 时依然不应展示 `data` 全量（只显示 `preview`）；契约发现主要用于插件协作与调试。

### 3.2 获取 Domain 目录（Domain Catalog）

- 方法：`GET /api/domains/catalog`
- 鉴权：公开（required gate 阶段必须可调用）
- 成功响应（示例）：

```json
{
  "items": [
    {
      "domain": "Core:Text",
      "supported_versions": ["1.0.0"],
      "recommended_version": "1.0.0",
      "constraints": {
        "max_payload_bytes": 4096,
        "max_depth": 10
      },
      "providers": [
        { "type": "core" }
      ]
    },
    {
      "domain": "Math:Formula",
      "supported_versions": ["1.0.0"],
      "recommended_version": "1.0.0",
      "constraints": {
        "max_payload_bytes": 8192,
        "max_depth": 20
      },
      "providers": [
        {
          "type": "plugin",
          "plugin_id": "math-formula",
          "min_plugin_version": "1.2.0"
        }
      ],
      "contract": {
        "schema_url": "https://example.com/contracts/math-formula/Math-Formula-1.0.0.schema.json",
        "sha256": "..."
      }
    }
  ]
}
```

字段说明（建议）：
- `supported_versions`：服务端可接受的 `domain_version` 列表（SemVer 字符串）
- `constraints`：服务端强校验约束（大小/深度/字段白名单等的抽象；字段可按实现扩展）
- `providers`：该 domain 的提供方（core 或 plugin）；用于客户端提示“缺哪个插件”
- `contract`：可选；JSON Schema（或等价描述）的下载指针，便于插件开发/调试

## 4. Auth（公开 / 半公开）

### 4.1 发送邮箱验证码

- 方法：`POST /api/auth/email_codes`
- 鉴权：公开
- 请求：

```json
{ "email": "user@example.com" }
```

- 成功：`204 No Content`

### 4.2 创建会话并签发 token（登录/注册合一）

> v1 推荐把“注册/登录”统一为“创建会话”：如果邮箱首次出现则视为注册，否则视为登录（服务端可在 `is_new_user` 暴露结果）。

- 方法：`POST /api/auth/tokens`
- 鉴权：公开（但受 required gate 阻断）
- 请求（邮箱验证码登录）：

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

- 成功响应（示例）：

```json
{
  "token_type": "Bearer",
  "access_token": "xxx",
  "expires_in": 1800,
  "refresh_token": "yyy",
  "uid": "123",
  "is_new_user": false
}
```

- required gate 失败：
  - `412 Precondition Failed`
  - `error.reason="required_plugin_missing"`

### 4.3 刷新 access token

- 方法：`POST /api/auth/refresh`
- 鉴权：公开（使用 refresh_token）
- 请求：

```json
{ "refresh_token": "yyy", "client": { "device_id": "a-stable-device-id" } }
```

- 成功响应：同 `POST /api/auth/tokens`（可轮换 refresh_token）

### 4.4 吊销 refresh token（登出）

- 方法：`POST /api/auth/revoke`
- 鉴权：公开（使用 refresh_token）
- 请求：

```json
{ "refresh_token": "yyy", "client": { "device_id": "a-stable-device-id" } }
```

- 成功：`204 No Content`

## 5. Users（需登录）

### 5.1 获取当前用户

- 方法：`GET /api/users/me`
- 成功响应（示例）：

```json
{ "uid": "123", "email": "user@example.com", "nickname": "Alice", "avatar": "avatars/u/123.png" }
```

### 5.2 获取用户公开资料（用于消息列表/成员列表头像与昵称）

- 方法：`GET /api/users/{uid}`
- 成功响应（示例）：

```json
{ "uid": "67890", "nickname": "Bob", "avatar": "avatars/u/67890.png" }
```

### 5.3 批量获取用户公开资料（推荐）

> 目的：避免消息列表渲染产生 N+1 请求。

- 方法：`GET /api/users?ids=123,456,789`
- 成功响应（示例）：

```json
{
  "items": [
    { "uid": "123", "nickname": "Alice", "avatar": "avatars/u/123.png" }
  ]
}
```

## 6. Channels（需登录）

> 频道型聊天基座（PRD P0）建议服务端至少提供一个默认频道（如 `General`），避免出现“用户登录后无可进入频道”的死路。

### 6.1 获取频道列表

- 方法：`GET /api/channels`
- 成功响应（示例）：

```json
{
  "channels": [
    { "cid": "1", "name": "General", "brief": "", "avatar": "", "owner_uid": "123" }
  ]
}
```

### 6.2 创建频道（owner）

- 方法：`POST /api/channels`
- 请求：

```json
{ "name": "General", "brief": "", "avatar": "" }
```

- 成功：`201 Created`（建议返回创建后的频道对象）

### 6.3 删除频道（owner）

- 方法：`DELETE /api/channels/{cid}`
- 成功：`204 No Content`

语义（建议）：
- 删除频道后，该频道不应再出现在任何用户的 `GET /api/channels` 列表中。
- 服务端应推送 `channels.changed` 或 `channel.changed`（hint=refresh），提示客户端刷新频道列表（见 `docs/api/12-WebSocket事件清单（v1，标准版）.md`）。

### 6.4 获取频道资料

- 方法：`GET /api/channels/{cid}`

### 6.5 更新频道资料（owner/admin）

- 方法：`PATCH /api/channels/{cid}`
- 请求（示例）：

```json
{ "name": "New Name", "brief": "..." }
```

### 6.6 获取频道成员

- 方法：`GET /api/channels/{cid}/members`
- 成功响应（示例）：

```json
{
  "items": [
    {
      "uid": "123",
      "role": "owner",
      "nickname": "Alice",
      "avatar": "avatars/u/123.png",
      "join_time": 1700000000000
    }
  ]
}
```

字段说明（建议）：
- `role` 枚举：`owner` / `admin` / `member`

### 6.7 踢出成员（admin/owner）

> 用 REST 语义表达“把某个 uid 从 members 集合移除”。

- 方法：`DELETE /api/channels/{cid}/members/{uid}`
- 成功：`204 No Content`

### 6.8 设为管理员（owner）

- 方法：`PUT /api/channels/{cid}/admins/{uid}`
- 成功：`204 No Content`

### 6.9 撤销管理员（owner）

- 方法：`DELETE /api/channels/{cid}/admins/{uid}`
- 成功：`204 No Content`

### 6.10 申请加入频道（非成员）

- 方法：`POST /api/channels/{cid}/applications`
- 请求：

```json
{ "reason": "hi" }
```

### 6.11 获取入群申请列表（admin/owner）

- 方法：`GET /api/channels/{cid}/applications`
- 成功响应（示例）：

```json
{
  "items": [
    {
      "application_id": "1",
      "cid": "12345",
      "uid": "67890",
      "reason": "hi",
      "apply_time": 1700000000000,
      "status": "pending"
    }
  ]
}
```

### 6.12 审批入群申请（admin/owner）

- 方法：`POST /api/channels/{cid}/applications/{application_id}/decisions`
- 请求：

```json
{ "decision": "approve" }
```

约定（建议）：
- `decision` 枚举：`approve` / `reject`
- 重复审批需返回可识别错误（例如 `conflict` + `error.reason="conflict"` 或更细 `application_already_processed`）

### 6.13 禁言/解除禁言（admin/owner）

- 方法：`PUT /api/channels/{cid}/bans/{uid}`
- 请求（禁言）：

```json
{ "until": 1700003600000, "reason": "spam" }
```

- 解除禁言：`DELETE /api/channels/{cid}/bans/{uid}`

### 6.14 获取禁言列表（admin/owner）

- 方法：`GET /api/channels/{cid}/bans`
- 成功响应（示例）：

```json
{
  "items": [
    {
      "cid": "12345",
      "uid": "67890",
      "until": 1700003600000,
      "reason": "spam",
      "create_time": 1700000000000
    }
  ]
}
```

## 7. Messages（需登录）

### 7.1 拉取频道消息（cursor）

- 方法：`GET /api/channels/{cid}/messages?cursor=...&limit=50`
- 成功响应示例：

```json
{
  "items": [
    {
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
  ],
  "next_cursor": "msg_000000000000000100",
  "has_more": true
}
```

### 7.2 发送消息

- 方法：`POST /api/channels/{cid}/messages`
- 幂等（推荐）：客户端可发送 `Idempotency-Key: <uuid>`，服务端在一定窗口内对重复 key 返回同一结果，避免重试导致重复消息
- 请求：

```json
{
  "domain": "Core:Text",
  "domain_version": "1.0.0",
  "data": { "text": "hello" },
  "reply_to_mid": "0"
}
```

- 成功：`201 Created`（返回完整 message）

### 7.3 删除消息（硬删除=消失）

- 方法：`DELETE /api/messages/{mid}`
- 成功：`204 No Content`

约定（必须）：
- 删除成功后，任何历史拉取接口不得再返回该消息。
- 服务端必须推送 `message.deleted` 事件（见 `docs/api/12-WebSocket事件清单（v1，标准版）.md`）。

## 8. Read State（需登录）

### 8.1 更新已读（只前进不后退）

- 方法：`PUT /api/channels/{cid}/read_state`
- 请求（建议以 mid 为准，避免“同毫秒多消息”的边界）：

```json
{ "last_read_mid": "100", "last_read_time": 1700000000000 }
```

- 成功响应（示例）：

```json
{ "cid": "12345", "uid": "67890", "last_read_mid": "100", "last_read_time": 1700000000000 }
```

### 8.2 获取当前用户对各频道未读

- 方法：`GET /api/unreads`
- 成功响应（示例）：

```json
{
  "items": [
    { "cid": "1", "unread_count": 3, "last_read_time": 1700000000000 }
  ]
}
```

## 9. Files（P1）

> P1 文件上传/下载：先“申请上传凭证”，再走 HTTP 上传下载，避免把大文件塞进 WS/事件流。

### 9.1 申请上传（生成上传凭证）

- 方法：`POST /api/files/uploads`
- 鉴权：需要登录
- 请求（示例）：

```json
{
  "filename": "image.png",
  "mime_type": "image/png",
  "size_bytes": 123456,
  "sha256": "optional_hex_string"
}
```

- 成功响应（示例）：

```json
{
  "file_id": "1",
  "share_key": "shr_01H...",
  "upload": {
    "method": "PUT",
    "url": "https://example.com/upload/file_01H...",
    "headers": { "x-cp-upload-token": "..." },
    "expires_at": 1700000100000
  }
}
```

约定：
- `upload.headers` 为必须随上传请求携带的 header 集合（有些部署可能使用 query token，也可扩展字段表示）。
- 上传完成后，文件如何被“绑定到消息”（生成文件类 domain 消息）由插件定义（PRD 4.7 / 5.1）。
- `share_key` 为下载与分享的稳定标识；客户端应通过 `GET /api/files/download/{share_key}` 下载文件（见 9.2）。
- `share_key="server_avatar"` 为保留值：固定用于下载服务端头像（即 `GET /api/files/download/server_avatar`）。

### 9.2 获取下载信息

> 下载 URL 统一为：`https://{server_host}/api/files/download/{share_key}`
>
> - `share_key` 由上传后返回
> - 返回为文件二进制（`Content-Type` 为文件类型；建议带 `Content-Disposition`）

- 方法：`GET /api/files/download/{share_key}`
- 鉴权：按服务端策略：
  - 若文件为公开分享：可不需要登录
  - 若文件为私有附件：需要登录（并通过服务端校验访问权限）
