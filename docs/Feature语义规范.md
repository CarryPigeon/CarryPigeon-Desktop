# Feature 语义规范

本文档定义仓库级的语义约束，目标不是“命名好看”，而是让公开 API、状态快照、错误、事件和生命周期具有稳定、可推理、可审查的语义。

## 1. 核心原则

- 公开结果优先返回 `Outcome`，而不是靠 `throw + UI 文案` 传递业务分支。
- 公开错误优先返回 `ErrorInfo`，而不是传播错误类实例或裸字符串。
- 公开状态优先返回 `Snapshot`，且必须是 plain immutable data。
- 生命周期 ownership 优先使用 `Lease`，不要暴露无 owner 的 `startRuntime()`。
- 事件必须区分“页面交互事件”“领域事件”“跨 feature 集成事件”三层，不允许裸字符串语义扩散。
- `domain` 是语义源与规则归属，不是跨 feature 的公共值入口；跨 feature 仍必须通过 `api.ts` / `api-types.ts` 获取 capability 与稳定 contract。

## 1.1 分层交互硬约束

以下规则用于约束 `presentation -> application -> domain/data` 的交互方向，违反时直接视为整洁架构回退。

### 1.1.1 domain / application 禁止依赖 Vue

- `domain` 与 `application` 只能依赖 plain type、query port、state port、mutation port、gateway port。
- `domain` 与 `application` 禁止导入 `vue`。
- `domain` 与 `application` 禁止出现 `Ref`、`computed`、`watch`、`reactive`、`.value` 驱动的业务编排。

### 1.1.2 application 禁止接收裸状态容器

- usecase / service / event-handler 不允许直接接收 `Ref<T>`、`WritableComputedRef<T>`、`reactive({})`、裸 `Record<string, T[]>` 等可写状态容器。
- 状态读写必须经由显式 port，例如：
  - `CurrentChannelStatePort`
  - `MessageTimelineStatePort`
  - `ChannelDirectoryMutationPort`
- application 只能表达“读什么、改什么”，不能知道底层状态容器是 Vue、signal 还是其他实现。

### 1.1.3 presentation 禁止深依赖 domain contract 路径

- `presentation` 默认只允许依赖：
  - `public/api-types.ts`
  - 子域 `api.ts` 暴露的 capability 类型
  - 本层 `presentation/contracts.ts`
- `presentation` 禁止直接依赖 `*/domain/contracts.ts` 作为页面模型、组件和跨模块交互的主契约来源。
- `domain/contracts.ts` 只允许被 `application`、`adapters`、runtime store 内部适配层消费。

### 1.1.4 composition 禁止经由 presentation 定义核心端口

- gateway、runtime port、state port 的契约源头必须位于 `application/ports/*` 或 `composition/contracts/*`。
- `presentation` 只能消费这些契约，不能反向成为契约定义源。
- 禁止出现 `composition -> presentation/* -> application` 的端口回指。

### 1.1.5 presentation 禁止手写领域错误

- 页面模型和组件只能消费：
  - `Outcome.error`
  - 专门的 `mapXxxOutcomeToUiError(...)`
- 禁止在页面模型里直接拼装 `code`、`message`、`retryable` 形式的领域错误对象。

### 1.1.6 跨层写入必须走命名 mutation port

- 禁止跨层直接修改领域对象或状态投影字段，例如 `channel.unread = 0`。
- 所有写入必须走具名动作口，例如：
  - `markChannelReadLocally(channelId)`
  - `replaceTimeline(channelId, messages)`
  - `incrementChannelUnread(channelId, amount)`

### 1.1.7 外部 feature 适配器只允许出现在 composition / workspace integration

- `presentation` 页面模型不应直接触碰其他 feature 的 runtime、workspace 或 session 对象。
- 外部 feature 交互应先收敛到：
  - composition 层 capability
  - workspace integration read model
  - 显式 bridge capability
- 禁止页面模型同时承担“UI 编排 + 跨 feature 集成装配”。

### 1.1.8 observer / snapshot / imperative query 必须分工明确

- 会驱动页面模板、长生命周期 composable、section model 或多个 computed 持续消费的状态，必须先通过
  `observeSnapshot()` 桥接为本地响应式状态，再继续做派生。
- `presentation` 禁止把 `find*()`、`getSnapshot()` 作为主要渲染数据源隐藏在 computed 内部，导致响应式来源不可见。
- 若页面需要“持续可见的当前频道、当前时间线、当前成员列表”，应先观察对应 snapshot，再在本地做 `find/filter/map`。

允许：

- 用户点击、快捷键、右键菜单、复制、路由跳转这类一次性动作里，直接调用 `find*()` / `getSnapshot()` 做即时读取。
- 命令执行前的前置校验、一次性 clipboard 文本提取、构造导航 query、格式化回复预览这类瞬时查询。

禁止：

- 页面依赖“某次调用 capability.query() 时碰巧读到了内部 computed/ref”来获得响应式更新。
- 在多个 composable 中重复直接拉 capability 当前值，而不是共享同一个 observed snapshot。

### 1.1.9 `watch` 只用于桥接 UI 生命周期，不替代 capability 观察协议

- `watch` 适用于：
  - route / query / DOM / 焦点 / 可见性等 Vue 或浏览器侧事件源；
  - 本地表单态、弹窗显隐、快捷键状态同步。
- `watch` 不应用来轮询或模拟领域状态订阅。
- 当状态本身已经由 capability 提供 `observeSnapshot()` 时，presentation 应优先使用 capability 观察协议，再在本地进行 Vue 派生。

## 2. 词汇表

### 2.1 `Capabilities`

- 表示某个 feature 或局部上下文对外公开的最小能力面。
- `Capabilities` 只描述外部能做什么，不描述内部怎么实现。
- 禁止重新回到 `Controller`、`View`、`Manager` 作为公共命名。

### 2.2 `Snapshot`

- 表示某一时刻的 plain immutable state projection。
- `Snapshot` 必须：
  - 可序列化；
  - 不包含 Vue `ref/computed/reactive`；
  - 不包含 `Set`、`Map`、class instance、函数或 DOM 对象。
- 索引集合优先使用：
  - `readonly string[]`
  - `Record<string, T>`
  - `readonly T[]`

### 2.3 `Outcome`

- 表示命令执行后的显式语义结果。
- `Outcome` 必须使用判别联合，至少包含：
  - `ok`
  - `kind`
- 失败态必须带 `error`，且 `error` 必须是 plain `ErrorInfo`。

推荐形态：

```ts
type ExampleOutcome =
  | { ok: true; kind: "example_completed"; value: string }
  | { ok: false; kind: "example_rejected"; error: SemanticErrorInfo<"example_failed"> };
```

治理命令示例：

```ts
type DeleteChannelOutcome =
  | { ok: true; kind: "channel_deleted"; channelId: string }
  | { ok: false; kind: "channel_deleted_rejected"; error: GovernanceCommandErrorInfo };
```

### 2.4 `ErrorInfo`

- `ErrorInfo` 是稳定错误语义，不是异常实例。
- 最小字段：
  - `code`
  - `message`
  - `retryable`
- 可选字段：
  - `details`
- 禁止把 `Error` / `ApiRequestError` / feature 错误类直接升级为跨边界公共契约。

### 2.5 `Lease`

- `Lease` 表示调用方持有某个 runtime 的生命周期 ownership。
- 公开 runtime 默认只允许：
  - `acquireLease()`
  - `lease.release()`
- 禁止在根公开面直接长期暴露 `startRuntime()` / `stopRuntime()`。

### 2.6 `Scope`

- `Scope` 表示局部上下文边界，例如当前 server、当前 workspace、当前 channel。
- `Scope` 只描述上下文归属，不表示业务动作结果。
- 不允许把 `scope` 当作模糊字符串扩散；需要稳定枚举时必须升级为明确类型。

### 2.7 `Policy`

- `Policy` 表示策略配置，例如 TLS 策略、重试策略。
- `Policy` 是只读约束，不表示状态，不表示命令。

## 3. 命令 / 查询命名约束

### 3.1 查询

查询必须无副作用，推荐使用：

- `getSnapshot`
- `observeSnapshot`
- `read*`
- `find*`
- `list*`
- `is*`
- `resolve*`

约束：

- `read*`：读取单一当前值或上下文值。
- `find*`：可能查不到，查不到返回 `null`。
- `list*`：读取集合，不做隐式刷新。
- `resolve*`：根据输入做纯推导或映射。

### 3.2 命令

命令表示副作用，推荐使用：

- `set*`
- `select*`
- `activate*`
- `refresh*`
- `ensure*`
- `send*`
- `delete*`
- `remove*`
- `retry*`
- `acquire*`

约束：

- `ensure*`：必须幂等，只表示“补齐到可用状态”。
- `refresh*`：只表示重取远端或重建派生状态。
- `activate*`：表示把某个上下文切成当前活动对象，并可附带后续命令编排。
- `retry*`：只表示重试最近一次失败命令，不引入新目标输入。

## 4. 结果语义约束

以下流程优先返回 `Outcome`，不应把业务分支藏在异常里：

- 登录 / required-setup 判定
- 切服 / 连接 / 重试连接
- 消息发送 / 删除 / 批准 / 封禁等显式用户动作
- 原生桥接请求分发
- 频道治理动作，例如 create-channel / delete-channel / kick-member / set-ban

只有“真正的异常条件”才允许抛错，例如：

- 运行时编程错误
- 不可恢复的底层适配器异常
- 测试桩故障

## 5. 错误语义约束

- feature 内部可以保留错误类；
- 公开 capability / snapshot / outcome 只能暴露 `ErrorInfo`；
- UI 文案必须来自 `ErrorInfo.message` 或受控映射函数；
- 禁止在 snapshot 中长期保存“未建模 string 错误”。
- 禁止在 integration / facade 层通过 `.then(() => undefined)` 抹掉底层 capability 已建模的 `Outcome`。
- 禁止在 composition / coordinator / facade 层把已建模的 `Outcome` 再降级成 `boolean`、`void` 或“只写日志”的隐式失败。
- 禁止复用同一个错误码表达多个不同失败原因；例如不能用 `missing_domain` 代替“空消息载荷”，也不能用 `delete_failed` 代替“缺少 messageId”。

## 6. 事件语义约束

事件必须分层：

- 页面交互事件：
  - 仅限页面/组件本地协作；
  - 必须显式命名 `*Requested` / `*Changed` / `*Dismissed`。
- 领域事件：
  - 表示业务事实；
  - 例如 channel projection changed、message deleted。
- 跨 feature 集成事件：
  - 只能携带稳定 plain payload；
  - 不允许把组件状态、临时 UI 词汇或模糊 scope 直接作为 payload。

禁止：

- 只导出裸字符串事件名让外部手工 `addEventListener`；
- payload 没有稳定类型；
- 用 `scope: string` 表示多个不同语义层的状态。

推荐：

- 提供 `emit*` / `observe*` 成对 helper；
- payload 使用显式类型别名；
- 需要“局部刷新范围”时使用稳定枚举，例如 `ChannelProjection = "messages" | "members" | "applications" | "bans" | "profile"`。

## 7. 快照语义约束

- `Snapshot` 中禁止 `Set/Map`；
- 对外 busy 集合必须转成 `readonly string[]`；
- 对外索引表允许 `Record<string, T>`；
- 对外数组必须声明为 `readonly T[]`；
- 对外嵌套对象必须是 plain object。

## 8. 本次审查后的强制回归清单

后续若再次出现，直接视为设计回退：

1. `throw + banner` 承担正常业务分支。
2. public capability 返回 `Promise<void>`，但实际存在明确成功/拒绝语义。
3. public snapshot 中出现 `Set`、`Map` 或错误类实例。
4. 使用 `Controller/View/Manager` 命名公开 capability。
5. 通过裸字符串 `scope` 或事件名驱动跨页面协作。
6. 查询方法混入副作用，或命令方法伪装成查询。
7. 在 integration / facade 包装层把 `Outcome` 再次降级成 `Promise<void>`。
8. 在 composition / coordinator 层把 `Outcome` 再次降级成 `boolean`、`void` 或 `onAsyncError(...)`。
9. 跨 feature 绕过根 capability，直接依赖低层子域 `api.ts`。
10. 低层子域公开面长期保留比根 capability 更弱的语义协议。
11. `domain` / `application` 重新引入 Vue `Ref`、`computed`、`watch`。
12. usecase 重新接收裸 `Ref<T>`、裸 `Record<string, T[]>` 或其他可写响应式容器。
13. `presentation` 重新深依赖 `*/domain/contracts.ts` 作为公共页面契约。
14. `composition` 通过 `presentation/*` 回指定义 gateway 或 runtime port。
15. 页面模型重新手写 `ErrorInfo`，而不是消费 `Outcome.error` 或专门映射函数。
16. 跨层再次通过直接字段赋值修改状态，而不是通过命名 mutation port。
