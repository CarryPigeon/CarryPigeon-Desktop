# CarryPigeon 客户端 API 文档（TCP/Netty + HTTP）

本文面向 CarryPigeon 客户端/机器人端开发者，是对接协议与接口的主文档，描述：

- TCP/Netty 连接、加密握手、帧格式
- 业务 JSON 协议（`CPPacket` / `CPResponse`）
- 服务端推送（通知）协议（`CPNotification`）
- 全量业务路由：介绍、请求、响应、与其他路由关系
- 文件上传/下载（HTTP）链路

> 重要约定
>
> - JSON 字段命名：`snake_case`（例如 `last_read_time`、`apply_time`）。
> - 所有时间字段均为：Unix epoch 毫秒（`long`）。
> - 绝大多数业务接口需要先完成「Token 登录」绑定当前 TCP 会话。

---

## 1. 术语与状态码

### 1.1 术语

- `session_id`：加密握手阶段由服务端下发的「连接会话 id」，写入 AES-GCM 的 AAD，用于连接级别校验。
- `token`：用户登录凭证（持久化），由注册/邮箱登录发放、由 token 登录刷新。
- `uid`：用户 id。
- `cid`：频道 id。
- `mid`：消息 id。

### 1.2 `CPResponse.code` 约定

- `200`：成功
- `100`：参数/业务错误（包括：找不到资源、不是管理员/所有者等业务失败）
- `300`：权限错误（典型：未登录）
- `404`：路由不存在
- `500`：服务器内部错误

推送通知特殊约定：

- `id = -1` 且 `code = 0`：服务端推送（见第 4 节）

---

## 2. TCP/Netty 连接与加密

### 2.1 TCP 端口

- TCP 协议：纯 TCP（非 HTTP）
- 端口：`connection.port`（Spring Boot 配置项）

### 2.2 Netty 帧格式（长度前缀）

在加密层之下，Netty 使用 2 字节长度前缀帧：

```
+--------------------+---------------------+
| 2 bytes length (n) | n bytes payload ... |
+--------------------+---------------------+
```

- `length`：无符号 short，表示后续 payload 字节数
- `payload`：握手阶段为明文 JSON；业务阶段为 AES-GCM payload（见 2.4）

### 2.3 握手（ECC -> AES）

握手流程整体是：**客户端本地生成 AES 会话密钥，用服务器 ECC 公钥加密后发给服务器，服务器解密后回发一条 `route="handshake"` 的加密通知表示握手成功。**

1) Server 侧：ECC 密钥对

- 服务端启动时会加载或生成 ECC 密钥对：
  - 优先从配置读取：
    - `connection.ecc-public-key`（Base64，X.509 公钥）
    - `connection.ecc-private-key`（Base64，PKCS#8 私钥）
  - 如果未配置，就在内存中生成新密钥对，并在日志里打印公钥/私钥 Base64 方便你拷贝到配置中。
- **客户端必须通过安全途径（例如打包写死、公钥 Pinning）拿到服务器公钥，不要从网络动态拉取。**

2) Client -> Server：发送 AES 会话密钥包（明文 JSON，`CPAESKeyPack`）

客户端示意流程：

- 本地生成随机 AES 会话密钥（字节数组）；
- Base64 编码成字符串 `aes_key_base64`；
- 使用服务器 ECC 公钥对 `aes_key_base64` 做 ECIES 加密，得到 `encrypted_aes_key_bytes`；
- 再对 `encrypted_aes_key_bytes` 做 Base64 编码得到字符串 `encrypted_aes_key_base64`；
- 发送 JSON：

```json
{
  "id": 1,
  "session_id": 0,
  "key": "<encrypted_aes_key_base64>"
}
```

字段说明：

- `id`：任意长整型请求 id，用于日志追踪；
- `session_id`：可选，当前连接会话 id（可以先填 0，服务器会自己分配）；
- `key`：对 `aes_key_base64` 进行 ECC 加密后的密文，再次 Base64 包装后的字符串。

3) Server：解密并保存 AES 密钥

- 服务器使用 ECC 私钥解密 `key`，得到原始的 `aes_key_base64`；
- 将 `aes_key_base64` 写入当前 Netty 会话的 `ENCRYPTION_KEY` 属性，并标记 `ENCRYPTION_STATE = true`；
- 后续所有业务包都使用这个 AES 密钥做 AES-GCM 加密/解密。

4) Server -> Client：握手成功通知（加密，`route="handshake"`）

- 一旦 AES 密钥解密成功，服务器会立刻发送一条 **已经使用该 AES 密钥加密的** `CPResponse`：

```json
{
  "id": -1,
  "code": 0,
  "data": {
    "route": "handshake",
    "data": {
      "session_id": 123456789
    }
  }
}
```

- 客户端解密后如果能看到：
  - `id == -1`；
  - `code == 0`；
  - `data.route == "handshake"`；
  就可以认为握手成功，后续可以开始发送正常业务 `CPPacket`。

### 2.4 业务包（AES-GCM + AAD）

握手完成后，每个业务包 payload：

```
+---------+---------+--------------+
| nonce   | AAD     | cipherText   |
+---------+---------+--------------+
  12 B      20 B       (n-32) B
```

- `nonce`：12 字节随机数（全 0 表示心跳）
- `AAD`（20 字节，Big-Endian）：
  - 4B：sequence（int，自增序号）
  - 8B：`session_id`（long）
  - 8B：timestamp（long，毫秒）
- `cipherText`：AES-GCM 加密后的业务 JSON 文本（即第 3 节的 `CPPacket` / `CPResponse`）

服务端会校验：

- sequence 单调递增
- `session_id` 匹配
- timestamp 在允许窗口内

---

## 3. 业务 JSON 协议（CPPacket / CPResponse）

### 3.1 请求：`CPPacket`

```json
{
  "id": 12345,
  "route": "/core/user/login/token",
  "data": {
    "token": "..."
  }
}
```

- `id`：请求 id（用于将响应与请求对应）
- `route`：业务路由（见第 6 节）
- `data`：请求参数对象

建议：

- 即使无参数也发送 `"data": {}`，避免 `data = null` 导致 VO 反序列化失败。

### 3.2 响应：`CPResponse`

```json
{
  "id": 12345,
  "code": 200,
  "data": { ... }
}
```

- `id`：与请求 `id` 一致
- `code`：状态码（见 1.2）
- `data`：响应数据对象；部分成功响应可能没有 `data` 字段（等价于 `null`）

错误响应通常为：

```json
{
  "id": 12345,
  "code": 100,
  "data": { "msg": "error args" }
}
```

---

## 4. 服务端推送（通知）

服务端推送使用 `CPResponse` 外层封装：

- `id = -1`
- `code = 0`
- `data` 为 `CPNotification`：

```json
{
  "id": -1,
  "code": 0,
  "data": {
    "route": "/core/message",
    "data": { ... }
  }
}
```

### 4.1 通知路由与 payload

> 说明：部分通知 `data = null`，表示“刷新提示”，客户端应按自己的上下文（当前打开的频道/页面）主动调用对应拉取接口刷新。

#### 4.1.1 `/core/message`（消息通知）

- 方向：Server -> Client
- payload：`CPMessageNotificationData`

```json
{
  "route": "/core/message",
  "data": {
    "type": "create",
    "s_content": "short summary",
    "cid": 12345,
    "uid": 67890,
    "send_time": 1700000000000
  }
}
```

用途：

- 新消息/删除消息都会通过该通知触发：
  - 新消息：`type = "create"`，`s_content` 为消息摘要
  - 删除消息：`type = "delete"`，`s_content = "message deleted"`
- 收到后通常需要调用 `/core/channel/message/list` 拉取增量或刷新列表

#### 4.1.1.1 `/core/message` 推送数据结构说明

`CPMessageNotificationData` 字段说明：

- `type`：字符串
  - `"create"`：新消息
  - `"delete"`：删除消息
- `s_content`：字符串，短文本摘要，用于列表预览或简单提示
- `cid`：long，频道 id
- `uid`：long，消息发送者/被删除消息的发送者 id
- `send_time`：long，消息发送时间（毫秒时间戳）

#### 4.1.2 `/core/channel/message/read/state`（读状态通知）

- 方向：Server -> Client（推送给同一用户的所有在线会话）
- payload：`CPChannelReadStateNotificationData`

```json
{
  "route": "/core/channel/message/read/state",
  "data": {
    "cid": 12345,
    "uid": 67890,
    "last_read_time": 1700000000000
  }
}
```

字段说明（`CPChannelReadStateNotificationData`）：

- `cid`：long，频道 id
- `uid`：long，用户 id
- `last_read_time`：long，最新读到的时间（毫秒时间戳）

#### 4.1.3 其他“刷新提示”类通知（`data = null`）

这些通知仅携带 `route`，用于提示客户端刷新对应数据：

- `/core/channel/list`：频道列表变化（创建/删除频道、频道资料更新等链路触发）
- `/core/channel/member/list`：频道成员变化（踢人、设/撤管理员、审批通过等链路触发）  
  同时，对于部分链路还会附带结构化 `data`，详见 4.1.4。
- `/core/channel/application/list`：频道申请列表变化（创建申请、处理申请触发）
- `/core/channel/ban/list`：频道禁言列表变化（创建/解除禁言触发）
- `/core/user/profile/get`：用户资料变化提示（资料更新触发；客户端可按需刷新本地缓存）

#### 4.1.4 `/core/channel/member/list`（成员变动通知）

当频道成员发生变化时，服务端会通过 `/core/channel/member/list` 路由推送通知。

payload：`CPChannelMemberNotificationData` 或 `data = null`（仅刷新提示）。

带结构化 `data` 的典型场景：

```json
{
  "route": "/core/channel/member/list",
  "data": {
    "type": "join",
    "cid": 12345,
    "uid": 67890
  }
}
```

`CPChannelMemberNotificationData` 字段说明：

- `type`：字符串，成员事件类型：
  - `"join"`：有新成员加入频道（入群申请被同意）
  - `"leave"`：成员被移除频道（被踢/删除）
  - `"admin_add"`：成员被设为管理员
  - `"admin_remove"`：成员被取消管理员
- `cid`：long，频道 id
- `uid`：long，受影响的成员 id

注意：

- 收到此类通知后，客户端可以：
  - 仅根据 `type/cid/uid` 做增量更新；或
  - 像之前一样，用 `/core/channel/member/list` 拉取最新成员列表进行全量刷新。

---

## 5. 典型业务链路（推荐调用顺序）

### 5.1 注册 / 登录链路

1) 发送验证码：`/core/service/email/send`
2) 注册（得到 token）：`/core/user/register`
3) 通过 token 登录并绑定当前 TCP 会话：`/core/user/login/token`
4) 后续所有需要登录的路由均可调用

邮箱登录同理：

1) `/core/service/email/send`
2) `/core/user/login/email`（得到 token）
3) `/core/user/login/token`（绑定会话）

### 5.2 频道创建与配置链路

1) 创建频道：`/core/channel/create`（当前实现不接收 name/brief/avatar）
2) 拉取频道列表：`/core/channel/list`（获取新频道 cid）
3) 更新频道资料：`/core/channel/profile/update`

### 5.3 入群申请链路

1) 普通用户提交申请：`/core/channel/application/create`
2) 管理员拉取申请列表：`/core/channel/application/list`
3) 管理员处理申请：`/core/channel/application/process`
4) 处理通过后：
   - 频道成员关系变化，通常需刷新：`/core/channel/member/list`

### 5.4 禁言链路（影响发消息）

1) 管理员创建禁言：`/core/channel/ban/create`
2) 被禁言用户在禁言期内调用 `/core/channel/message/create` 会失败（`code = 100`）
3) 管理员解除禁言：`/core/channel/ban/delete`
4) 禁言列表查看：`/core/channel/ban/list`

### 5.5 消息链路

1) 拉取历史消息：`/core/channel/message/list`
2) 发送消息：`/core/channel/message/create`
3) 收到 `/core/message` 通知后：
   - 视业务拉取新消息（`/core/channel/message/list`）或刷新 UI
4) 未读数：
   - 读状态获取：`/core/channel/message/read/state/get`
   - 读状态更新：`/core/channel/message/read/state/update`
   - 未读数统计：`/core/channel/message/unread/get`

### 5.6 文件上传/下载链路（Netty 申请 token + HTTP 传输）

上传：

1) Netty 申请上传 token：`/core/file/upload/token/apply`
2) HTTP 上传：`POST /file/upload/{token}`（multipart 表单字段名 `file`）
3) HTTP 返回 `file_id`（字符串，通常为数字 id），可作为消息 `data` 的引用（由业务约定）

下载：

1) Netty 申请下载 token：`/core/file/download/token/apply`
2) HTTP 下载：`GET /file/download/{token}`

小图直链（无需 token）：

- `GET /file/raw/{file_id}`（仅允许 image/* 且大小 <= 3MB）

---

## 6. Netty 路由参考（全量）

本节按“路由”给出：简介、鉴权、请求、响应、与其他路由关系/通知。

> 说明：下面示例的 JSON 均为 `CPPacket.data` 或 `CPResponse.data` 的内容，不包含 AES 加密与长度帧。

### 6.1 Service

#### 6.1.1 发送邮箱验证码

- 路由：`/core/service/email/send`
- 鉴权：不需要登录
- 简介：向邮箱发送验证码；验证码用于注册、邮箱登录、更新邮箱

请求（`data`）：

```json
{
  "email": "user@example.com"
}
```

成功响应：
默认成功（`data` 为空）。

关联路由：

- `/core/user/register`
- `/core/user/login/email`
- `/core/user/profile/update/email`

### 6.2 User

#### 6.2.1 注册

- 路由：`/core/user/register`
- 鉴权：不需要登录
- 简介：使用邮箱 + 验证码注册用户并发放 `token`

请求（`data`）：

```json
{
  "email": "user@example.com",
  "code": 123456
}
```

成功响应（`data`）：

```json
{
  "token": "..."
}
```

关系：

- 注册成功后，需要调用 `/core/user/login/token` 才能在当前 TCP 连接上进入“已登录”状态

#### 6.2.2 邮箱登录

- 路由：`/core/user/login/email`
- 鉴权：不需要登录
- 简介：使用邮箱 + 验证码换取 `token`

请求（`data`）：

```json
{
  "email": "user@example.com",
  "code": 123456
}
```

成功响应（`data`）：

```json
{
  "token": "..."
}
```

#### 6.2.3 Token 登录（绑定会话）

- 路由：`/core/user/login/token`
- 鉴权：不需要登录（这是登录接口）
- 简介：使用 `token` 登录，并将当前 TCP 会话绑定到 `uid`；服务端可能刷新 token

请求（`data`）：

```json
{
  "token": "..."
}
```

成功响应（`data`）：

```json
{
  "token": "...",
  "uid": 12345
}
```

关系：

- 绝大多数路由都要求先调用本接口
- 多端场景：同一个 `uid` 可同时绑定多个在线会话，通知会推送到所有会话

#### 6.2.4 Token 登出（删除 token）

- 路由：`/core/user/login/token/logout`
- 鉴权：需要登录
- 简介：删除指定 token（使其失效）

请求（`data`）：

```json
{
  "token": "..."
}
```

成功响应：默认成功（`data` 为空）

建议：

- 登出后客户端通常应关闭 TCP 连接并重新握手/登录，避免连接级状态与 token 状态不一致

#### 6.2.5 获取用户资料

- 路由：`/core/user/profile/get`
- 鉴权：需要登录
- 简介：获取指定用户资料（可用于展示频道成员信息等）

请求（`data`）：

```json
{
  "uid": 12345
}
```

成功响应（`data`）：

```json
{
  "username": "name",
  "avatar": -1,
  "email": "user@example.com",
  "sex": 0,
  "brief": "",
  "birthday": 1700000000000
}
```

#### 6.2.6 更新用户资料

- 路由：`/core/user/profile/update`
- 鉴权：需要登录
- 简介：更新当前登录用户的资料

请求（`data`）：

```json
{
  "username": "new-name",
  "avatar": 1,
  "sex": 0,
  "brief": "hi",
  "birthday": 1700000000000
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 服务端会向“同频道相关用户”推送刷新提示通知：`/core/user/profile/get`（`data = null`）

注意：

- `avatar/sex/birthday` 为数值字段；若客户端不传，可能被反序列化为 `0` 并写入（建议总是传完整资料）。

#### 6.2.7 更新邮箱

- 路由：`/core/user/profile/update/email`
- 鉴权：需要登录
- 简介：通过邮箱验证码更新当前用户邮箱

请求（`data`）：

```json
{
  "new_email": "new@example.com",
  "code": 123456
}
```

成功响应：默认成功（`data` 为空）

关系：

- 需要先调用 `/core/service/email/send` 发送验证码到 `new_email`

### 6.3 Channel（频道）

#### 6.3.1 创建频道

- 路由：`/core/channel/create`
- 鉴权：需要登录
- 简介：创建频道，并将当前用户加入频道（成为成员）；频道的初始 name/brief/avatar 由服务端生成默认值

请求（`data`）：

```json
{}
```

成功响应：默认成功（`data` 为空）

关系：

- 创建后通常调用 `/core/channel/list` 获取新频道 `cid`
- 然后调用 `/core/channel/profile/update` 设置 name/brief/avatar 等

#### 6.3.2 删除频道

- 路由：`/core/channel/delete`
- 鉴权：需要登录且必须为频道 owner
- 简介：删除频道

请求（`data`）：

```json
{
  "cid": 12345
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 可能触发频道列表刷新提示：`/core/channel/list`（`data = null`）

#### 6.3.3 拉取频道列表

- 路由：`/core/channel/list`
- 鉴权：需要登录
- 简介：获取当前用户加入的所有频道

请求（`data`）：

```json
{}
```

成功响应（`data`）：

```json
{
  "count": 1,
  "channels": [
    {
      "cid": 12345,
      "name": "channel",
      "owner": 1000,
      "avatar": -1,
      "brief": ""
    }
  ]
}
```

#### 6.3.4 获取频道资料

- 路由：`/core/channel/profile/get`
- 鉴权：需要登录
- 简介：获取频道资料

请求（`data`）：

```json
{
  "cid": 12345
}
```

成功响应（`data`）：

```json
{
  "name": "channel",
  "owner": 1000,
  "brief": "",
  "avatar": -1,
  "create_time": 1700000000000
}
```

#### 6.3.5 更新频道资料

- 路由：`/core/channel/profile/update`
- 鉴权：需要登录且必须为频道 owner
- 简介：更新频道资料

请求（`data`）：

```json
{
  "cid": 12345,
  "name": "new-name",
  "owner": 1000,
  "brief": "new-brief",
  "avatar": 2
}
```

成功响应：默认成功（`data` 为空）

注意：

- `owner/avatar` 为数值字段；若客户端不传，可能被反序列化为 `0` 并写入（建议传完整字段或先拉取后修改）。

### 6.4 Channel Member（频道成员）

#### 6.4.1 获取单个成员

- 路由：`/core/channel/member/get`
- 鉴权：需要登录且必须为频道成员（调用方必须在该频道中）
- 简介：获取指定成员在频道中的信息

请求（`data`）：

```json
{
  "cid": 12345,
  "uid": 67890
}
```

成功响应（`data`）：

```json
{
  "uid": 67890,
  "name": "",
  "authority": 1,
  "join_time": 1700000000000
}
```

#### 6.4.2 成员列表

- 路由：`/core/channel/member/list`
- 鉴权：需要登录且必须为频道成员
- 简介：获取频道成员列表

请求（`data`）：

```json
{
  "cid": 12345
}
```

成功响应（`data`）：

```json
{
  "count": 2,
  "members": [
    { "uid": 1, "name": "", "authority": 0, "join_time": 1700000000000 },
    { "uid": 2, "name": "", "authority": 1, "join_time": 1700000000000 }
  ]
}
```

#### 6.4.3 删除成员（踢人）

- 路由：`/core/channel/member/delete`
- 鉴权：需要登录且必须为频道管理员
- 简介：将指定用户从频道中移除

请求（`data`）：

```json
{
  "cid": 12345,
  "uid": 67890
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 成功后会向频道所有成员推送刷新提示：`/core/channel/member/list`（`data = null`）

### 6.5 Channel Admin（频道管理员）

#### 6.5.1 设置管理员

- 路由：`/core/channel/admin/create`
- 鉴权：需要登录且必须为频道 owner
- 简介：将指定成员设为管理员

请求（`data`）：

```json
{
  "cid": 12345,
  "uid": 67890
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 成功后会向频道所有成员推送刷新提示：`/core/channel/member/list`

#### 6.5.2 取消管理员

- 路由：`/core/channel/admin/delete`
- 鉴权：需要登录且必须为频道 owner
- 简介：将指定成员从管理员降级为普通成员

请求（`data`）：

```json
{
  "cid": 12345,
  "uid": 67890
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 成功后会向频道所有成员推送刷新提示：`/core/channel/member/list`

### 6.6 Channel Application（入群申请）

#### 6.6.1 创建申请

- 路由：`/core/channel/application/create`
- 鉴权：需要登录
- 简介：提交入群申请

请求（`data`）：

```json
{
  "cid": 12345,
  "msg": "please"
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 成功后会向该频道所有管理员推送刷新提示：`/core/channel/application/list`

#### 6.6.2 处理申请

- 路由：`/core/channel/application/process`
- 鉴权：需要登录且必须为频道管理员
- 简介：审批入群申请

请求（`data`）：

```json
{
  "aid": 999,
  "result": 1
}
```

- `result`：申请状态，`1 = APPROVED`，`2 = REJECTED`

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 处理后会向管理员推送刷新提示：`/core/channel/application/list`
- 若审批通过，会创建成员关系，并向频道成员推送刷新提示：`/core/channel/member/list`

#### 6.6.3 申请列表

- 路由：`/core/channel/application/list`
- 鉴权：需要登录且必须为频道管理员
- 简介：分页获取申请列表

请求（`data`）：

```json
{
  "cid": 12345,
  "page": 0,
  "page_size": 20
}
```

成功响应（`data`）：

```json
{
  "count": 1,
  "applications": [
    { "id": 999, "uid": 67890, "state": 0, "msg": "please", "apply_time": 1700000000000 }
  ]
}
```

### 6.7 Channel Ban（禁言）

#### 6.7.1 创建禁言

- 路由：`/core/channel/ban/create`
- 鉴权：需要登录且必须为频道管理员
- 简介：对频道成员设置禁言（秒）

请求（`data`）：

```json
{
  "cid": 12345,
  "uid": 67890,
  "duration": 3600
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 成功后会向频道成员推送刷新提示：`/core/channel/ban/list`
- 禁言会影响 `/core/channel/message/create`

#### 6.7.2 解除禁言

- 路由：`/core/channel/ban/delete`
- 鉴权：需要登录且必须为频道管理员
- 简介：解除指定用户在频道的禁言

请求（`data`）：

```json
{
  "cid": 12345,
  "uid": 67890
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 成功后会向频道成员推送刷新提示：`/core/channel/ban/list`

#### 6.7.3 禁言列表

- 路由：`/core/channel/ban/list`
- 鉴权：需要登录且必须为频道成员
- 简介：获取频道当前有效禁言列表（过期记录会被清理）

请求（`data`）：

```json
{
  "cid": 12345
}
```

成功响应（`data`）：

```json
{
  "count": 1,
  "bans": [
    { "uid": 67890, "aid": 1000, "ban_time": 1700000000000, "duration": 3600 }
  ]
}
```

### 6.8 Message（消息）

#### 6.8.1 发送消息

- 路由：`/core/channel/message/create`
- 鉴权：需要登录且必须为频道成员，且未被禁言
- 简介：发送一条频道消息；消息体由 `type` 决定（插件可扩展）

请求（`data`）：

```json
{
  "type": "Core:Text",
  "cid": 12345,
  "data": { "text": "hello" }
}
```

成功响应（`data`）：

```json
{
  "mid": 1
}
```

关系 / 通知：

- 成功后会向频道成员推送 `/core/message`（包含 `cid/uid/send_time` 与简略内容 `s_content`）

#### 6.8.2 删除消息

- 路由：`/core/channel/message/delete`
- 鉴权：需要登录且满足删除权限（消息发送者或具备管理员权限等，具体由服务端校验）
- 简介：删除指定消息

请求（`data`）：

```json
{
  "mid": 1
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 成功后会推送 `/core/message`（`s_content = "message deleted"`）

#### 6.8.3 拉取消息列表

- 路由：`/core/channel/message/list`
- 鉴权：需要登录且必须为频道成员
- 简介：按时间倒序拉取历史消息

请求（`data`）：

```json
{
  "cid": 12345,
  "start_time": 1700000000000,
  "count": 50
}
```

语义：

- 返回 `send_time <= start_time` 的最近 `count` 条（当 `start_time <= 0` 时，等价于“从当前时间往前拉取”）

成功响应（`data`）：

```json
{
  "count": 2,
  "messages": [
    {
      "mid": 1,
      "domain": "Core:Text",
      "uid": 67890,
      "cid": 12345,
      "data": { "text": "hello" },
      "send_time": 1700000000000
    }
  ]
}
```

#### 6.8.4 获取单条消息

- 路由：`/core/channel/message/get`
- 鉴权：需要登录且必须为频道成员（调用方必须在该消息所属频道中）
- 简介：根据消息 id 获取单条消息详情

请求（`data`）：

```json
{
  "mid": 1
}
```

成功响应（`data`）：

```json
{
  "mid": 1,
  "domain": "Core:Text",
  "uid": 67890,
  "cid": 12345,
  "data": { "text": "hello" },
  "send_time": 1700000000000
}
```

#### 6.8.5 获取未读数量

- 路由：`/core/channel/message/unread/get`
- 鉴权：需要登录且必须为频道成员
- 简介：统计“某时间点之后”的未读消息数量

请求（`data`）：

```json
{
  "cid": 12345,
  "start_time": 1700000000000
}
```

成功响应（`data`）：

```json
{
  "count": 10
}
```

#### 6.8.6 更新读状态

- 路由：`/core/channel/message/read/state/update`
- 鉴权：需要登录且必须为频道成员
- 简介：更新当前用户在该频道的最新读到时间（只前进不后退）

请求（`data`）：

```json
{
  "cid": 12345,
  "last_read_time": 1700000000000
}
```

成功响应：默认成功（`data` 为空）

关系 / 通知：

- 成功后会向该用户所有在线会话推送 `/core/channel/message/read/state`

#### 6.8.7 获取读状态

- 路由：`/core/channel/message/read/state/get`
- 鉴权：需要登录且必须为频道成员
- 简介：获取当前用户在该频道的读状态（若无记录则 `last_read_time = 0`）

请求（`data`）：

```json
{
  "cid": 12345
}
```

成功响应（`data`）：

```json
{
  "cid": 12345,
  "uid": 67890,
  "last_read_time": 0
}
```

### 6.9 File（文件 token，仅用于授权 HTTP 传输）

#### 6.9.1 申请上传 token

- 路由：`/core/file/upload/token/apply`
- 鉴权：需要登录
- 简介：申请一次性上传 token（默认有效期约 5 分钟）

请求（`data`）：

```json
{}
```

成功响应（`data`）：

```json
{
  "token": "..."
}
```

关系：

- 使用该 token 调用 HTTP：`POST /file/upload/{token}`

#### 6.9.2 申请下载 token

- 路由：`/core/file/download/token/apply`
- 鉴权：需要登录
- 简介：申请一次性下载 token

请求（`data`）：

```json
{
  "file_id": "1234567890"
}
```

成功响应（`data`）：

```json
{
  "token": "..."
}
```

关系：

- 使用该 token 调用 HTTP：`GET /file/download/{token}`

---

## 7. HTTP API（配合文件与服务器信息）

HTTP 端口：

- Spring Boot `server.port`（未配置时默认 `8080`）

### 7.1 获取服务器信息

- 方法：`GET`
- 路径：`/core/server/data/get`
- 鉴权：无

响应：

```json
{
  "server_name": "CarryPigeonBackend",
  "avatar": "default-server-avatar",
  "brief": "CarryPigeon chat backend server",
  "time": 1733616000000
}
```

### 7.2 上传文件（一次性 token）

- 方法：`POST`
- 路径：`/file/upload/{token}`
- 鉴权：token（由 `/core/file/upload/token/apply` 获取）
- 请求：`multipart/form-data`，字段名固定为 `file`

成功响应（纯文本）：

- `200 OK`：body 为 `file_id`（字符串）

失败：

- `403`：token 无效或过期
- `400`：文件为空

### 7.3 下载文件（一次性 token）

- 方法：`GET`
- 路径：`/file/download/{token}`
- 鉴权：token（由 `/core/file/download/token/apply` 获取）
- 响应：流式下载（`Content-Disposition: attachment`）

### 7.4 小图直链下载（无需 token）

- 方法：`GET`
- 路径：`/file/raw/{file_id}`
- 限制：仅允许 `image/*` 且大小 <= 3MB；否则返回 `403`
