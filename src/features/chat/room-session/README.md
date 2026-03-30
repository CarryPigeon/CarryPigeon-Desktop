## chat/room-session

### 定位

`room-session` 负责聊天会话上下文编排，关注“连接就绪、恢复补拉、会话切换”，不承载消息语义渲染。

### 负责内容

- 会话就绪编排：频道初始化、首屏加载、WS/polling 选择与接入。
- 连接生命周期：WS 连接复用、重鉴权、降级轮询。
- 恢复与补拉：`resume.failed` 后的最小 HTTP catch-up。
- 读状态上报与频道会话动作（切换频道、读进度推进）。
- 频道切换结果语义：`selectChannel()` 对外返回显式 `Outcome`，不再依赖异常表达正常业务失败。

### 不负责内容

- 消息语义与渲染（归属 `message-flow`）。
- 成员治理、申请、禁言、管理员策略（归属 `room-governance`）。

### 当前模块

- `domain/contracts.ts`：room-session 持有的频道与频道切换结果语义。
- `presentation/store-access/sessionStoreAccess.ts`：room-session presentation 层内部使用的 store 访问面。
- `presentation/runtime/sessionState.ts`：room-session 自身持有的响应式状态容器与派生视图。
- `presentation/runtime/sessionStateAdapters.ts`：directory/read-marker 两类局部状态适配 helper，供 sessionStatePorts 与 sessionSharedContext 复用。
- `presentation/runtime/sessionStatePorts.ts`：把 session 状态容器适配成 application 可消费的显式状态写口/投影口。
- `presentation/runtime/sessionRuntimePorts.ts`：room-session runtime 对外契约与状态切片类型。
- `presentation/runtime/sessionSharedContext.ts`：session / message-flow / governance 共享的 scope、目录刷新与读状态上下文。
- `presentation/runtime/sessionConnectionRuntime.ts`：只负责连接生命周期、WS/polling 与 catch-up。
- `presentation/runtime/sessionRuntime.ts`：聚合连接子系统与频道视图动作，形成 room-session 公开 runtime。
- `capability-source.ts`：子域内部 capability source，负责把 runtime store-access 适配为稳定 capability。
- `domain/usecases/roomSessionCatalogService.ts`：目录与未读刷新 application service。
- `domain/usecases/roomSessionViewService.ts`：频道切换、消息定位与读状态上报 application service。
- `domain/usecases/roomSessionConnectionService.ts`：会话就绪、WS/polling 选择与 session hook 生命周期业务服务。
- `domain/usecases/resetSessionState.ts`：切服后的本地状态复位动作。
- `domain/services/*`：可复用会话服务（`wsManager`、`pollingFallback`、`readStateReporter`）。
- `domain/event-handlers/readStateEventRouter.ts`：`read_state.updated` 事件路由与本地状态同步。
- `domain/recovery/resumeFailedCatchUp.ts`：`resume.failed` 后的最小补拉恢复策略。
- `domain/ports.ts`：room-session 业务层依赖的最小输出端口。
- `internal.ts`：room-session 内部装配出口，桥接 room-session 能力给 chat composition 装配根使用。

### 说明

- 跨子域 WS 事件路由已提升到 `chat/composition/createChatEventRouter.ts`。
- `room-session` 只处理会话与读状态相关流程。
- 第二阶段后，`contracts` 已进入 `domain/`，子域 capability 通过 `capability-source.ts` 组装，`store-access` 仅保留为 presentation/runtime 内部适配层。
- 当前版本里，room-session 的主要用例已经从零散函数工厂收束为几个聚合类，runtime 只负责实例化与拼接。
