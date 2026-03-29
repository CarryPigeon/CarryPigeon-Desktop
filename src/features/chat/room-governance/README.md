## chat/room-governance

### 定位

`room-governance` 负责频道治理能力，关注成员与管理策略，不承载会话连接编排与消息语义渲染。

### 负责内容

- 成员治理：成员列表、踢人、管理员授予/撤销。
- 申请治理：入群申请查询与审批。
- 禁言治理：禁言列表、设置与解除。
- 频道治理：创建/删除频道与相关后置刷新。

### 当前模块

- `presentation/store/governanceStoreApi.ts`：对外暴露治理公开状态与动作。
- `application/channelUserActions.ts`、`application/channelAdminActions.ts`：普通成员动作与管理员动作编排。
- `application/ports.ts`：room-governance 应用层依赖的最小输出端口。
- `application/admin-actions/*`：踢人、审批、封禁、频道生命周期等细粒度治理动作。
- `application/apiMappers.ts`、`application/scopeGuard.ts`：DTO 映射与请求作用域防护。
- `presentation/store/governanceEventRouter.ts`：治理事件同步与局部刷新路由。
- `presentation/pages/*`：成员、申请、封禁等治理路由页面，按子域归档而不再挂在 chat 根页面目录。
- `internal.ts`：room-governance 内部装配出口，桥接 application 动作与治理事件路由，仅供 chat runtime 组合层使用。

### 设计说明

- `room-governance` 不再直接持有 room-session 的 `Ref` 状态容器。
- 频道目录的局部同步通过 `application/ports.ts` 中的 `GovernanceChannelCatalogPort` 表达，避免治理动作和会话状态对象直接耦合。
