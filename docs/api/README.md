# API 文档索引（精简版）

版本：v1.1（2026-02-07）

## 定位

- 本目录是 HTTP + WebSocket v1 设计真源。
- 当前实现链路（TCP/Netty）联调口径见：`docs/客户端开发指南.md`。
- 版本兼容策略见：`docs/api/00-versioning-and-compatibility.md`。

## 命名规范（本目录）

- 入口文件固定：`README.md`
- 主题文档命名：`NN-topic-vX.md`
- 示例：`10-http-ws-protocol-v1.md`

## 快速阅读路径

1. `docs/api/10-http-ws-protocol-v1.md`
2. `docs/api/11-http-endpoints-v1.md`
3. `docs/api/12-ws-events-v1.md`
4. `docs/api/13-error-model-and-reasons-v1.md`
5. `docs/api/14-pagination-and-cursor-v1.md`

## 协议口径（必须）

- Base Path：`/api`
- WS URL：`/api/ws`
- 版本协商：`Accept: application/vnd.carrypigeon+json; version=1`
- 不使用 URL 路径版本（如 `/v1/...`）

## 文档清单

- `docs/api/00-versioning-and-compatibility.md`：兼容与演进规则
- `docs/api/10-http-ws-protocol-v1.md`：协议总览与连接语义
- `docs/api/11-http-endpoints-v1.md`：资源端点
- `docs/api/12-ws-events-v1.md`：事件与恢复机制
- `docs/api/13-error-model-and-reasons-v1.md`：错误语义与映射
- `docs/api/14-pagination-and-cursor-v1.md`：游标与补拉策略
