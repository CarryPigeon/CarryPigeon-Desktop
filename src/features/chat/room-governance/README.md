## chat/room-governance

### 定位

`room-governance` 负责频道治理能力，关注成员与管理策略，不承载会话连接编排与消息语义渲染。

### 负责内容

- 成员治理：成员列表、踢人、管理员授予/撤销。
- 申请治理：入群申请查询与审批。
- 禁言治理：禁言列表、设置与解除。
- 频道治理：创建/删除频道与相关后置刷新。

### 当前模块

- `domain/contracts.ts`：room-governance 持有的治理模型与命令 Outcome 语义。
- `presentation/store-access/governanceStoreAccess.ts`：room-governance presentation 层内部使用的 store 访问面。
- `presentation/runtime/governanceState.ts`：room-governance 自身持有的响应式状态容器。
- `presentation/runtime/governanceStatePorts.ts`：把目录同步和成员侧栏状态适配成显式 port。
- `presentation/runtime/governanceRuntimePorts.ts`：room-governance runtime 对外契约与状态切片类型。
- `presentation/runtime/governanceRuntime.ts`：聚合治理命令与成员侧栏刷新的 room-governance runtime。
- `capability-source.ts`：子域内部 capability source，负责把 runtime store-access 适配为稳定 capability。
- `application/usecases/channelUserActions.ts`、`application/usecases/channelAdminActions.ts`：普通成员动作与管理员动作编排。
- `application/ports.ts`：room-governance 应用层依赖的最小输出端口。
- `application/usecases/admin-actions/*`：踢人、审批、封禁、频道生命周期等细粒度治理动作。
- `application/mappers/apiMappers.ts`、`application/policies/scopeGuard.ts`：DTO 映射与请求作用域防护。
- `application/outcomes/governanceCommandOutcome.ts`：治理命令失败结果与错误信息构造。
- `presentation/pages/*`：成员、申请、封禁等治理路由页面，按子域归档而不再挂在 chat 根页面目录。
- `internal.ts`：room-governance 内部装配出口，桥接 application 动作，仅供 chat application/runtime 装配根使用。

### 设计说明

- `room-governance` 不再直接持有 room-session 的 `Ref` 状态容器。
- 频道目录的局部同步通过 `application/ports.ts` 中的 `GovernanceChannelCatalogPort` 表达，避免治理动作和会话状态对象直接耦合。
- 第二阶段后，`contracts` 已进入 `domain/`，子域 capability 通过 `capability-source.ts` 组装，`store-access` 仅保留为 presentation/runtime 内部适配层。
- 第三阶段后，`application/` 再细分为 `usecases/mappers/policies/outcomes`，管理员细粒度动作继续收束在 `usecases/admin-actions/`。
- 频道治理相关的 WS 集成刷新路由已上提到 `chat/presentation/store/live/chatGovernanceEventRouter.ts`，避免把 chat 根运行时集成逻辑继续挂在治理页面 store 语义下。
