# 消息 Domain 与契约（草案）

## 1. 统一消息字段（P0）
- `mid, cid, uid, send_time`
- `domain, domain_version`
- `data`
- `reply_to_mid?`

## 2. Domain Contract（P0）
每个非 `Core:*` domain 必须有契约（schema + constraints），服务端必须校验：
- schema 校验（拒绝未知字段/非法结构）
- 最大 payload bytes
- 最大嵌套深度
- 频率限制

## 3. 删除语义（硬删除）
- 删除后 list/get 不得返回该消息
- delete 推送后客户端必须从内存与本地缓存移除

## 4. 降级展示
- 未安装对应插件时：
  - 优先展示服务端提供的 `preview`
  - 不展示原始 `data` 全量（避免刷屏/泄露）

