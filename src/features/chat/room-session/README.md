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

- `presentation/store/sessionStoreApi.ts`：对外暴露 room-session 公开状态与动作。
- `application/ensureReady.ts`、`channelData.ts`、`channelViewActions.ts`：首屏就绪、频道数据读取与当前频道视图编排。
- `application/ports.ts`：room-session 应用层依赖的最小输出端口。
- `application/wsManager.ts`、`pollingFallback.ts`、`resumeFailedCatchUp.ts`：连接、降级轮询与恢复补拉。
- `application/readStateReporter.ts`、`readStateEventRouter.ts`、`resetState.ts`：读状态推进、事件同步与切服重置。
- `internal.ts`：room-session 内部装配出口，桥接 application 能力给 chat runtime 组合层使用。

### 说明

- 跨子域 WS 事件路由已提升到 `chat/presentation/store/live/chatEventRouter.ts`。
- `room-session` 只处理会话与读状态相关流程。
