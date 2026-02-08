# 前端调试与 Mock（精简版）

## 1. 环境变量

```env
VITE_USE_MOCK_API=true
VITE_MOCK_MODE=store
VITE_MOCK_LATENCY_MS=120
VITE_MOCK_SERVER_SOCKET=mock://handshake
```

- `VITE_USE_MOCK_API=false` 时，`VITE_MOCK_MODE` 被忽略（即 `off`）。
- 运行时解析真源：`src/shared/config/runtime.ts`。

## 2. 三种模式语义

- `off`：真实后端链路。
- `store`：feature 内存 mock，优先用于 UI 预览。
- `protocol`：HTTP/WS 协议 mock，优先用于联调；不访问真实网络。

## 3. 关键行为矩阵（核心结论）

- `auth/user/chat/files/servers`：`protocol` 下走真实 adapter + 协议 mock transport。
- `network`：`store/protocol` 下不走真实 TCP。
- `plugins manager`：`protocol` 下 catalog 走 HTTP 协议 mock；生命周期走 mock manager。
- `plugins runtime`：`store/protocol` 下默认禁用动态加载（避免误触桌面 runtime 依赖）。

## 4. 常见排查

- 模式异常：先看 `MOCK_MODE`、`IS_STORE_MOCK`、`USE_MOCK_TRANSPORT`。
- 请求未命中：检查 `src/shared/mock/protocol/protocolMockTransport.ts` 路由覆盖。
- 登录/会话异常：检查 `startupSession` 编排与 token 存储。

## 5. 提交前最小自检

- `npm run lint`
- `npx vue-tsc --noEmit`
- 手动验证 `off / store / protocol` 三模式关键流程

## 6. 深入文档

- feature 接入与 DI：`./新Feature接入检查清单.md`
- 架构总览：`./架构设计.md`
- API 细节：`./api/README.md`
