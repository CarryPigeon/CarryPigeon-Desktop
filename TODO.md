# 缺失 API 参数清单

> 目标：记录静态检查中确认的缺失/半缺失 API 参数，作为后续补齐 live 调用、页面接入和后端写入分发的跟踪入口。

## 1. 适用范围

- 覆盖当前已发现的 HTTP API、Tauri command 与页面调用参数缺口。
- 不覆盖输入校验类 `Missing ...`、mock catch-all、MVP 明确非目标且无契约的完整功能实现。
- 参数以现有文档、mock、端口类型和 data 层实现为准；未定 API 仅标注建议参数。
- `user id` 只在“目标用户”类接口中作为显式参数；`/users/me` 类接口通过 `accessToken` 表示当前用户，不额外传 `uid`。

## 2. 参数清单

| 编号 | API / 调用 | 参数 | 位置 | 类型 | 必填 | 约束 / 示例 | 状态 | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `GET /api/channels/{cid}` | `cid` | path | `string` | 是 | 非空；需 URL encode；示例：`cid-ann` | 缺 live 接入 | 文档和 mock 已有，`ChatApiPort` / `httpChatApi` 缺 `getChannel` 调用。 |
| 2 | `GET /api/channels/{cid}` | `serverSocket` | client context | `string` | 是 | 非空服务端地址；示例：`https://example.com` / `socket://127.0.0.1:7777` | 缺 live 接入 | live HTTP 调用需要用它构造目标服务端地址。 |
| 3 | `GET /api/channels/{cid}` | `accessToken` | auth context | `string` | 是 | 非空 Bearer token；不写入 body/query | 缺 live 接入 | live HTTP 调用需要 Bearer 鉴权。 |
| 4 | 好友私聊创建（API 待定） | `target_user_id` / `friend_uid` | body | `string` | 是 | 目标用户稳定 ID；非展示名；示例：`67890` | 契约未定 | 当前弹窗只有 `name`，缺稳定用户 ID；PRD 标注“私聊/好友体系”为 MVP 非目标。 |
| 5 | 好友私聊创建（API 待定） | `message` / `reason` | body | `string` | 否 | 可为空；建议 trim；示例：`Hi, let's chat.` | 契约未定 | 当前弹窗已有 `message`，但主页面未监听，也没有 API 调用。 |
| 6 | 好友私聊创建（API 待定） | `serverSocket` | client context | `string` | 是 | 非空服务端地址；不写入 body | 契约未定 | 若后续接入 live API，需要服务端地址上下文。 |
| 7 | 好友私聊创建（API 待定） | `accessToken` | auth context | `string` | 是 | 非空 Bearer token；不写入 body/query | 契约未定 | 若后续接入 live API，需要鉴权上下文。 |
| 8 | `PATCH /api/users/me` | `avatar` | body | `number` / integer | 是 | 当前文档示例为 `0`；需明确是资源 ID、文件 ID 还是枚举值 | 页面未接入 | 页面有 `avatarUrl` 输入，但请求中 `avatar` 硬编码为 `0`；需明确 `avatar` 的真实语义。 |
| 9 | `POST /api/users/me/background` | `background` | multipart form-data | `File` | 是 | 表单字段名固定为 `background`；建议限制图片 MIME，如 `image/png` / `image/jpeg` / `image/webp` | 页面未接入 | 页面有 `backgroundUrl` 输入，但未接入文件上传；data 层已有背景上传能力。 |
| 10 | `update_config_u32` | `key` | command arg | `String` | 是 | 当前最小可支持值：`server_port` | data 层未接入 | command 已暴露，`config_store` 缺 `server_port` 写入分发。 |
| 11 | `update_config_u32` | `value` | command arg | `u32` | 是 | 写入 `server_port` 时需校验为 `1..=65535`，再转换为 schema 中的 `u16` | data 层未接入 | Rust command 入参是 `u32`，持久化模型字段是 `u16`。 |
| 12 | `update_config_u64` | `key` | command arg | `String` | 是 | 未定义可写 key | 无明确契约 | 当前没有明确可写 key，所有 key 都返回 `Unsupported config key`。 |
| 13 | `update_config_u64` | `value` | command arg | `u64` | 是 | 未定义取值范围 | 无明确契约 | 当前没有明确业务字段消费该数值。 |

## 3. 端点说明

### 3.1 获取频道资料

- 方法：`GET /api/channels/{cid}`
- 最小参数：

```ts
getChannel(serverSocket: string, accessToken: string, cid: string): Promise<ChatChannelRecord>
```

- 参数说明：
  - `serverSocket`：`string`，必填，服务端地址上下文。
  - `accessToken`：`string`，必填，Bearer 鉴权 token。
  - `cid`：`string`，必填，频道 ID，放入 path 前必须 URL encode。
- 当前状态：文档和 mock 已具备，live `ChatApiPort` / `httpChatApi` 缺调用。

### 3.2 好友私聊创建

- 方法：未定。
- 当前页面参数：

```ts
{ name: string; message: string }
```

- 建议后续契约至少使用稳定用户 ID：

```ts
{ target_user_id: string; message?: string }
```

- 参数说明：
  - `target_user_id`：`string`，必填，目标用户稳定 ID，不应使用展示名。
  - `message`：`string`，可选，创建私聊或好友请求的附言。
- 当前状态：PRD 标注“私聊/好友体系”为 MVP 非目标，因此这里只记录参数建议，不视为已定义端点缺失。

### 3.3 更新当前用户资料

- 方法：`PATCH /api/users/me`
- 文档请求：

```json
{ "username": "Alice", "avatar": 0, "sex": 0, "brief": "hello", "birthday": 0 }
```

- 参数说明：
  - `username`：`string`，必填，当前用户昵称。
  - `avatar`：`number`，必填，文档示例为 `0`；真实语义仍需确认。
  - `sex`：`number`，必填，文档示例为 `0`。
  - `brief`：`string`，必填，个人简介。
  - `birthday`：`number`，必填，文档示例为 `0`。
- 当前状态：页面 `avatarUrl` 只写本地状态，真实请求仍发送 `avatar: 0`。

### 3.4 更新当前用户背景图

- 方法：`POST /api/users/me/background`
- 请求：`multipart/form-data`，字段名 `background`
- 参数说明：
  - `background`：`File`，必填，multipart 字段名固定为 `background`。
- 当前状态：data 层已有上传能力，页面 `backgroundUrl` 只写本地状态，未传 `File`。

### 3.5 Settings 数值写入

- 方法：Tauri command `update_config_u32` / `update_config_u64`
- 当前参数：

```rust
key: String
value: u32 | u64
```

- 参数说明：
  - `key`：`String`，必填；`update_config_u32` 当前最小应支持 `server_port`。
  - `value`：`u32` / `u64`，必填；写入 `server_port` 时应校验为有效端口范围并转换为 `u16`。
- 当前状态：command 已暴露，data 层没有 u32/u64 写入分发；至少应补齐 `server_port` 的 `u32` 写入路径。

## 4. 相关链接

- `docs/api/11-http-endpoints-v1.md`
- `docs/design/PRD.md`
- `src/features/chat/domain/ports/chatApiPort.ts`
- `src/features/chat/data/chat-api/httpChatApi.ts`
- `src/features/account/profile/presentation/pages/UserInfoPage.vue`
- `src/features/account/profile/data/httpUserApi.ts`
- `src-tauri/src/features/settings/di/commands.rs`
- `src-tauri/src/features/settings/data/config_store.rs`

---

## 5. 语音通话/会议（voice-call）— 待实现模块

> 当前完成：`chat/voice-call/` 前端子域骨架 + Rust `voice_call` feature 模块和桩命令 + cpal 音频设备枚举 + WebRTC 管理器骨架。以下为后续迭代需补齐的模块。

### 5.1 Rust 后端待实现

| 编号 | 模块 | 文件 | 说明 | 优先级 |
| --- | --- | --- | --- | --- |
| 1 | WebSocket 信令客户端 | `data/signaling/ws_client.rs` | 基于 `tokio-tungstenite` 的独立 WS 连接，用于 SDP/ICE 消息交换 | high |
| 2 | 音频管线（编解码） | `data/audio/pipeline.rs` | PCM (i16, 48kHz) → Opus 编码/解码，20ms 帧 | high |
| 3 | 降噪/AEC | `data/audio/noise_suppress.rs` | 可选降噪（如 RNNoise）+ 回声消除（AEC）开关，用户可手动切换 | medium |
| 4 | 语音活动检测（VAD） | `data/audio/vad.rs` | 检测参与者是否在说话，输出 `audioLevel` + `isSpeaking` | medium |
| 5 | LiveKit SFU 客户端 | `data/sfu/livekit_client.rs` | SFU Room 连接、音轨发布/订阅、参与者事件 | high |
| 6 | 信令 TCP 中继 | `data/signaling/tcp_relay.rs` | 通过 Chat TCP 通道发送/接收 `call:*` 业务事件 | high |
| 7 | Tauri 命令真实实现 | `di/commands.rs` | 替换所有 `Err("VOICE_NOT_IMPLEMENTED")` 桩为真实调用 | high |

### 5.2 前端待补齐

| 编号 | 模块 | 文件/位置 | 说明 | 优先级 |
| --- | --- | --- | --- | --- |
| 8 | 事件路由 store 注入 | `createChatEventRouter.ts` | 将 `call:*` 事件分发到 voiceCall store（当前 deps 为空桩） | high |
| 9 | 多窗口通话状态同步 | Tauri event 全局广播 | 多窗口同房间场景下 banner 同步关闭/状态一致 | medium |
| 10 | capability-source 动作方法 | `capability-source.ts` | `startDirectCall` 等 throw stub 需实现或从契约移除 | low |
| 11 | 参会者列表 UI | `ParticipantList.vue` | 多人会议参与者列表 + 说话状态动画（VAD 就绪后） | medium |

### 5.3 服务端前置依赖

| 编号 | 依赖 | 用途 | 备注 |
| --- | --- | --- | --- |
| 12 | 信令 WebSocket 中继服务 | 转发 SDP/ICE 消息 | 可用自研轻量 relay |
| 13 | SFU 服务器（LiveKit 优先） | 多人会议音频流转发 | 3 人以上需 SFU |
| 14 | Chat TCP `call:*` 事件协议扩展 | 呼叫邀请/接听/挂断等业务事件 | 现有 Chat 协议上扩展 |
