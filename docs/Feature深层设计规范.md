# Feature 深层设计规范

本文档补充 `Feature模块设计规范.md` 与 `Feature API公开约束.md` 之外的深层设计要求，关注长期可维护性，而不只关注“数据流正确”和“公开边界干净”。

## 1. 生命周期 Ownership

适用对象：

- feature runtime
- 长驻事件订阅
- server-scoped registry
- 插件运行时、连接运行时、轮询/监听任务

要求：

- 跨 feature 公开的长生命周期能力默认使用 lease ownership。
- 同一 feature 不应在多个入口各自维护一套 lease 计数与 start/stop 状态机。
- lease 控制器应收敛为共享机制，保证：
  - 多调用方共享同一底层 runtime
  - 最后一个 lease 释放后才真正停止
  - 启动/停止中的并发调用可复用同一 Promise
  - start/stop 状态机不允许散落复制

禁止：

- 在多个 feature 中复制粘贴 `leaseCount + running + startPromise + stopPromise` 模板。
- 对外只暴露 `startRuntime()`，没有 ownership 协议。

## 2. 命令并发语义

每个命令必须显式选择一种并发语义：

- `latest-wins`
  - 新命令到来时，旧命令结果即使稍后返回，也不得覆盖当前状态。
- `dedupe`
  - 相同语义的并发请求复用同一个 in-flight Promise。
- `busy-gate`
  - 某资源忙碌时拒绝新命令。
- `queue`
  - 新命令进入顺序队列执行。

要求：

- feature 内不得使用“隐式并发语义”。
- 若命令采用 `latest-wins`，必须通过共享控制器表达，而不是手写分散的 generation 变量。
- `latest-wins` 适合：
  - connect / reconnect
  - workspace switch
  - 搜索/筛选即时刷新
- `dedupe` 适合：
  - refresh
  - list/load snapshot
- `busy-gate` 适合：
  - install/enable/disable/switchVersion

详细命名与注释模板见：

- `docs/Feature命令并发规范.md`

## 3. 局部 Capability

object-capability 不应止步于 `forServer(serverSocket)`。

要求：

- 当能力天然依赖更小上下文时，应继续向下收敛局部 capability。
- 根 capability 只负责暴露稳定分组与上下文绑定入口。
- 子 capability 应只保留该上下文真正需要的最小能力面。

推荐形式：

- `forServer(serverSocket)`
- `forChannel(channelId)`
- `forPlugin(pluginId)`
- `forCurrentSession()`

禁止：

- 把明显属于局部上下文的命令继续堆在根 capability 上。

## 4. 状态协议一致性

所有对外可观察状态统一使用下列协议：

```ts
type ReadableCapability<T> = {
  getSnapshot(): T;
  observeSnapshot(observer: (snapshot: T) => void): () => void;
};
```

要求：

- 首次订阅后立即推送一次当前快照。
- 快照必须是 plain data。
- 写操作通过显式 command 暴露，不暴露可写句柄。

## 5. 领域规则内聚

要求：

- 业务规则优先沉到 domain/application policy，不留在 composable/store 的流程细节里。
- presentation 只做：
  - 状态投影
  - 用户交互编排
  - 生命周期绑定

禁止：

- 在页面模型或 store 中长期保存“领域规则决策树”。

## 6. 组合根约束

要求：

- feature 应存在明确 composition root。
- `composition` 负责装配 adapter、port、usecase、runtime。
- `usecases` 只依赖 `domain/ports` 与 `domain/types`。
- `data` 负责实现 `domain/ports`。

Rust 侧同样适用：

```text
commands -> usecases -> domain/ports <- data adapters
```

允许：

- `di/commands` 直接装配 data adapter。

禁止：

- `usecases` 直接 import `data/*`。

Rust 侧结构审核清单见：

- `docs/Rust Feature Ports-Adapter检查清单.md`

## 7. 身份可信等级

适用对象：

- account/current-user snapshot
- session-derived identity
- profile-derived identity

要求：

- 展示态身份快照必须显式表达可信等级，例如：
  - `anonymous`
  - `authenticated`
  - `authority_profile`
- “认证链路确认的最小身份”与“从权威 profile 拉回的资料”不得混为同一种无标签快照。
- 若只拿到登录返回的 uid / email，只能写入 `authenticated` 快照。
- 只有权威 profile 读取成功后，才能提升到 `authority_profile`。
- 本地 UI patch 只允许修改展示字段，不得隐式提升可信等级。

禁止：

- 对外暴露无约束的 `setSnapshot(partial)`，使任意调用方可直接伪造更高可信等级。
- 用“是否有 username / email”去推断快照可信等级。

## 8. 检查清单

涉及 feature 深层设计变更的 PR，至少回答：

1. 长生命周期对象是否已有统一 ownership？
2. 命令并发语义是否明确标注为 `latest-wins` / `dedupe` / `busy-gate` / `queue`？
3. 是否还能继续收敛为更小的局部 capability？
4. 规则是否仍残留在 composable/store，而不是 application/domain？
5. 身份快照是否显式区分了 `authenticated` 与 `authority_profile`？
6. Rust/前端 usecase 是否仍直接依赖 data？
