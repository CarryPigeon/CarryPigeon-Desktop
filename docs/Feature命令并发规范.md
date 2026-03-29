# Feature 命令并发规范

本文档补充 `Feature深层设计规范.md` 第 2 节，统一仓库级命令并发语义的命名、注释模板与落地方式。

## 1. 目标

- 让调用方一眼知道某个命令的并发语义。
- 避免同类命令在不同 feature 中使用不同名字、不同注释。
- 把并发规则收敛为可检查的显式约束，而不是散落在实现细节里。

## 2. 标准语义

- `latest-wins`
  - 新命令覆盖旧命令。
  - 典型场景：`workspace.activate`、`connectWithRetry`、即时搜索。
- `dedupe`
  - 相同语义的并发调用复用同一个 in-flight Promise。
  - 典型场景：`refreshInfo`、`refreshCatalog`、`list/load`。
- `busy-gate`
  - 资源忙时拒绝或忽略新命令。
  - 典型场景：插件 `install/enable/disable/switchVersion`。
- `queue`
  - 按顺序串行执行。
  - 典型场景：明确需要保序的批量写操作。

## 3. 命名规则

方法名只表达业务动作，不把并发语义直接塞进方法名。

推荐：

- `activate`
- `refreshInfo`
- `updateToLatest`
- `enable`

避免：

- `activateLatestWins`
- `refreshInfoDedupe`
- `enableIfNotBusy`

并发语义应写在：

- 类型注释
- 实现文件顶部或方法注释
- policy/controller 命名

推荐辅助命名：

- `createLatestAsyncController`
- `dedupeRefreshBySocket`
- `getPluginInstallOperationPolicy`
- `runBusyPluginOperation`

## 4. 注释模板

### `latest-wins`

```ts
/**
 * 切换到指定 workspace。
 *
 * 并发语义：
 * - `latest-wins`：新的切换命令会覆盖旧的切换流程；
 * - 调用方不应在外部手工拼装 `select + connect + refreshInfo`。
 */
```

### `dedupe`

```ts
/**
 * 刷新当前 server-info。
 *
 * 并发语义：
 * - `dedupe`：同一语义的并发刷新复用同一个 in-flight Promise。
 */
```

### `busy-gate`

```ts
/**
 * 启用插件。
 *
 * 并发语义：
 * - `busy-gate`：同一插件存在进行中操作时，不再接受新的启用命令。
 */
```

### `queue`

```ts
/**
 * 顺序执行待提交命令。
 *
 * 并发语义：
 * - `queue`：新命令进入队列，按提交顺序执行。
 */
```

## 5. 落地要求

- `latest-wins`
  - 使用共享控制器，例如 `createLatestAsyncController`。
  - 禁止手写分散的 generation 变量。
- `dedupe`
  - 使用共享去重器或明确的 in-flight cache。
- `busy-gate`
  - 使用显式 policy 或 gate helper，不在动作函数里零散判断。
- `queue`
  - 必须存在清晰的队列持有者，不能靠调用方循环 await 伪装成队列。

## 6. PR 检查点

1. 新增命令是否明确标注了并发语义？
2. 同类命令是否沿用了仓库现有命名？
3. 并发语义是否由共享 controller/policy 表达，而不是手写局部状态机？
4. 调用方是否仍在 feature 外部拼装本应由 feature 内部负责的顺序语义？
