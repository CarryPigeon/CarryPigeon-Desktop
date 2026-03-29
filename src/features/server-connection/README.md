# `server-connection`

## 定位

`server-connection` 负责“当前服务器工作区”的公开能力，统一承载：

- 服务器目录与当前 server 选择
- 连接状态与重试动作
- 当前 server 的信息查询
- 按 server scope 隔离的本地清理流程

它替代历史上的 `network + servers` 分散职责，对外提供单一 feature 公共面。

## 公开面

- capability 入口（首选）：`createServerConnectionCapabilities()` / `getServerConnectionCapabilities()`
- 动作与状态入口：`src/features/server-connection/api.ts`
- 稳定公共类型：`src/features/server-connection/api-types.ts`

推荐依赖顺序：

1. 跨 feature 默认优先使用 capability 的 `workspace` 高层分组能力（`capabilities.workspace.*`），也就是当前 server workspace 的 snapshot/observer/command 入口。
2. 若页面需要 Vue 响应式视图，应在本 feature 自己的 `integration/` 层把 snapshot/observer 包装成 composable，而不是把 `server-connection` 的内部 `ref/computed` 直接透传出去。
3. 如需服务器目录写操作，使用 capability 的 `rack` 分组。
4. 若只需要类型，优先从 `api-types.ts` 引入，避免调用方深路径依赖子域实现文件。

## capability 约定

- `ServerConnectionCapabilities` 以 `workspace` 为主语义分组，并以 `rack` / `scopeLifecycle` 补充必要的目录管理与生命周期能力。
- `createServerConnectionCapabilities()` 返回新的能力对象，适合测试或局部装配。
- `getServerConnectionCapabilities()` 返回应用级共享能力对象，适合 app/process 统一入口。

示例：

```ts
import { getServerConnectionCapabilities } from "@/features/server-connection/api";

const serverConnection = getServerConnectionCapabilities();
const lease = await serverConnection.runtime.acquireLease();
await serverConnection.workspace.activate("example.com:11443", {
  connect: true,
  refreshInfo: true,
  connectOptions: { maxAttempts: 3 },
});
await lease.release();
```

## 子域边界

- `workspace`
  - 高层公开入口。
  - 面向 app/processes 与跨 feature 调用者，组合 `rack + connectivity + server-info + scope-lifecycle`。
  - 负责表达“当前 server workspace”的 plain 查询快照、订阅与命令，不承载底层 TCP 细节。
- `rack`
  - 服务器目录管理能力。
  - 负责 server 录入与目录维护；当前激活 workspace 的读取仍优先走 `workspace`。
  - 服务器管理页同时承载当前 workspace 的本地维护入口（例如清理当前 server 的本地缓存/会话数据）。
- `connectivity`
  - 连接链路与连接状态。
  - 负责连接阶段、失败原因、重试动作，以及 TCP runtime 的生命周期。
- `server-info`
  - 当前 server 的身份与能力信息。
  - 负责 `/api/server` 查询、缓存与刷新。
- `scope-lifecycle`
  - 当前 server scope 的本地生命周期动作。
  - 负责“切换/退出某个 server workspace 时要清理什么”。
  - 若需要清理其它 feature 的内存状态，应通过 cleanup handler 由 app/composition root 注入，而不是在该子域里静态 import 其它 feature。

## runtime 关系

- `capabilities.runtime.acquireLease()`
  - 启动 `rack -> server-info -> connectivity`。
  - 只有最后一个 lease 释放后，底层 runtime 才允许停止。
  - 这是 app 层应优先使用的总入口。

## connectivity 内部说明

`connectivity` 的公共面只暴露连接状态与动作；下列对象属于内部实现协作，不应被跨 feature 直接依赖：

- `TcpService`：握手、解密、入站帧分发编排
- `TcpRequestCallbackRegistry`：request/response 回调注册与清理
- `HandshakeWaitState`：握手等待状态管理
- `TcpRequestResponseSender`：请求发送、超时与失败清理

命名约定：

- `serverSocketKey`
  - 作为 registry 与 scope 隔离使用的稳定 key
- `transportSocket`
  - 实际交给底层连接器的 socket 地址
  - 某些场景下可以与 `serverSocketKey` 不同

## 何时用哪一层

- “我要切换当前 server、连上它、顺手刷新它的信息”
  - 优先用 `capabilities.workspace.activate(serverSocket, { connect: true, refreshInfo: true })`
- “我要在本 feature 页面里响应式展示当前 server 状态”
  - 在本 feature 的 `integration/` 层包装 `capabilities.workspace.getSnapshot()/observeSnapshot()`
- “我要录入一个新的 server”
  - 用 `capabilities.rack.addServer(...)`
- “我要在切服/登出时注册本地清理动作”
  - 用 `capabilities.scopeLifecycle.registerCleanupHandler(...)`

补充约束：

- `workspace.selectSocket()` 只负责更新当前选择，不负责后续连接/刷新。
- 若调用方真正意图是“切换工作区并进入可用状态”，应优先使用 `workspace.activate(...)`，避免在外部手工拼装 `selectSocket + connect + refreshInfo`。
