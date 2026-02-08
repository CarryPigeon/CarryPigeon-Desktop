# 14｜分页与游标规范（v1，标准版）

版本：v1.0（draft）  
日期：2026-02-01  

## 1. 目标

- 避免 offset 分页在插入/删除下的抖动与重复。
- 为“断线恢复/补拉”提供稳定锚点。
- 允许服务端自由选择底层实现（数据库游标/索引/事件表），对外只暴露不透明 cursor。

## 2. cursor 的基本规则（必须）

- cursor 为不透明字符串：客户端不得解析 cursor 内容
- cursor 只能用于同一个端点的后续分页请求：不得跨端点复用
- cursor 过期时服务端返回：
  - `404 not_found` 或
  - `422 validation_failed`
  - 并在 `error.reason` 给出可识别原因（如 `cursor_invalid`，可选扩展）

## 3. 响应统一结构（推荐）

```json
{
  "items": [],
  "next_cursor": "opaque_string_or_null",
  "has_more": true
}
```

字段说明：
- `items`：本页数据
- `next_cursor`：下一页 cursor；无更多时为 `null`
- `has_more`：是否还有更多（可与 `next_cursor` 互为冗余）

## 4. 消息列表的排序与一致性（P0）

对 `GET /api/channels/{cid}/messages`：

- 排序：必须以 `mid`（或 `send_time + mid`）作为稳定排序键
  - `mid` 为服务端雪花 ID（JSON 中为十进制字符串，详见 `docs/api/10-http-ws-protocol-v1.md`）
- 删除语义：硬删除后不得出现在任何分页结果中
- 客户端要求：
  - 必须按 `mid` 去重（WS 推送与 HTTP 补拉可能重叠）
  - 必须能处理“收到 message.deleted 但本地没有该 mid”的情况

## 5. 与 WS resume 的配合

推荐恢复流程（客户端重连）：

1) WS `auth` 携带 `resume.last_event_id`
2) 若服务端返回 `resume.failed`：
   - 以“最后打开的频道”为优先执行 `GET /api/channels/{cid}/messages` 补拉（或按业务需求全量补拉）
   - 同步调用 `GET /api/unreads` 与 `GET /api/channels` 纠正状态
