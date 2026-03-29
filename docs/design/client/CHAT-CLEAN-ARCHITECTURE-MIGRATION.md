# Chat Clean Architecture 迁移表

本文档定义 `src/features/chat` 从“混合技术分层 + 子域目录”迁移到“公开边界 / composition root / shared kernel / 子域 / outbound adapters”结构的目标形态。

本次迁移是 **非向前兼容** 的：

- 旧路径不保留兼容转发文件。
- 仓库内所有引用应直接改到新路径。
- `chat` 对外稳定边界改为 `public/*`。

## 目标结构

```text
src/features/chat/
  public/
    api.ts
    api-types.ts
    routes.ts
    styles.ts
  composition/
    createChatPorts.ts
    createChatUsecases.ts
    createChatGateways.ts
    createChatRuntime.ts
    runtimeAccess.ts
    createChatWorkspaceCoordinator.ts
  shared-kernel/
    channelSummary.ts
  adapters/
    outbound/
      account-session.ts
      plugin-access.ts
      plugin-runtime.ts
      server-workspace.ts
      chat-api/
      chat-events/
      protocol/
  domain/
  room-session/
  message-flow/
  room-governance/
  presentation/
  mock/
  typechecks/
```

## 顶层规则

- `public/`
  - feature 对外唯一稳定入口。
  - 只允许放跨 feature 或 app composition root 需要消费的公开能力与公开类型。
- `composition/`
  - feature 最外层装配点。
  - 允许连接具体 adapter、domain usecase、runtime store、mock/live 分流。
- `shared-kernel/`
  - 只放 chat 内多个子域共享的稳定核心语义。
  - 禁止放 Vue、HTTP、WS、插件宿主对象。
- `adapters/outbound/`
  - chat 访问外部世界的出口适配器。
  - 包括协议适配、其他 feature 适配、插件 runtime 适配。
- `room-session/` / `message-flow/` / `room-governance/`
  - 继续按业务子域维持高内聚。
  - 子域内部后续再继续向 `domain / application / adapters` 收敛。

## 迁移表

| 现状路径 | 目标路径 | 迁移理由 |
| --- | --- | --- |
| `src/features/chat/api.ts` | `src/features/chat/public/api.ts` | 明确 feature 对外公开边界，避免根目录继续混放 public surface 与内部实现。 |
| `src/features/chat/api-types.ts` | `src/features/chat/public/api-types.ts` | 公共类型与内部 contract 分离，作为唯一稳定公开类型入口。 |
| `src/features/chat/routes.ts` | `src/features/chat/public/routes.ts` | 页面路由属于 feature 对 app 的公开入口。 |
| `src/features/chat/styles.ts` | `src/features/chat/public/styles.ts` | 样式入口属于 app composition root 可见边界。 |
| `src/features/chat/di/chatPorts.ts` | `src/features/chat/composition/createChatPorts.ts` | ports 组装属于 composition root，而不是业务核心层。 |
| `src/features/chat/di/chatUsecases.ts` | `src/features/chat/composition/createChatUsecases.ts` | usecase 实例装配属于最外层对象组装，不是 domain。 |
| `src/features/chat/di/chatGatewayFactory.ts` | `src/features/chat/composition/createChatGateways.ts` | gateway 只是 adapter/usecase 到 runtime 的装配桥，不应继续伪装成 domain 层。 |
| `src/features/chat/di/chatRuntime.ts` | `src/features/chat/composition/createChatRuntime.ts` | 聚合 runtime 是 feature composition root。 |
| `src/features/chat/di/chat.di.ts` | `src/features/chat/composition/runtimeAccess.ts` | 内部 runtime 访问入口属于 composition 访问器，而不是对外 API。 |
| `src/features/chat/application/createChatWorkspaceCoordinator.ts` | `src/features/chat/composition/createChatWorkspaceCoordinator.ts` | workspace 编排横跨多个 feature，属于 outer orchestration，不应放在核心 application。 |
| `src/features/chat/contracts/channelSummary.ts` | `src/features/chat/shared-kernel/channelSummary.ts` | `ChannelSummary` 是 chat 子域共享核心语义，适合 shared kernel。 |
| `src/features/chat/integration/accountSession.ts` | `src/features/chat/adapters/outbound/account-session.ts` | account 是外部依赖，应明确为 outbound adapter。 |
| `src/features/chat/integration/pluginAccess.ts` | `src/features/chat/adapters/outbound/plugin-access.ts` | plugins 目录读取是对外部 feature 的适配。 |
| `src/features/chat/integration/pluginRuntime.ts` | `src/features/chat/adapters/outbound/plugin-runtime.ts` | plugin runtime 宿主桥接是典型 outbound adapter。 |
| `src/features/chat/integration/serverWorkspace.ts` | `src/features/chat/adapters/outbound/server-workspace.ts` | server workspace 来源于外部 feature，应显式建模为 outbound adapter。 |
| `src/features/chat/data/httpChatApi.ts` | `src/features/chat/adapters/outbound/chat-api/httpChatApi.ts` | HTTP 协议访问属于 driven adapter。 |
| `src/features/chat/data/httpChatApiPort.ts` | `src/features/chat/adapters/outbound/chat-api/httpChatApiPort.ts` | HTTP port adapter 归入 chat-api outbound adapter。 |
| `src/features/chat/data/wsChatEvents.ts` | `src/features/chat/adapters/outbound/chat-events/wsChatEvents.ts` | WS 事件连接属于 outbound event adapter。 |
| `src/features/chat/data/wsChatEventsPort.ts` | `src/features/chat/adapters/outbound/chat-events/wsChatEventsPort.ts` | 同上。 |
| `src/features/chat/data/wire/*` | `src/features/chat/adapters/outbound/protocol/*` | wire DTO 只属于协议适配层，不属于 feature 核心。 |

## 本次迁移范围

本次落地范围：

- 调整 `public/` 公开边界。
- 调整 `composition/` 顶层装配目录。
- 调整 `shared-kernel/` 共享语义目录。
- 调整 `adapters/outbound/` 外部适配目录。
- 修复 `chat` 内外部所有受影响 import。

本次不做：

- 不改动 chat 业务行为语义。
- 不保留旧路径兼容文件。

## 第二阶段（已完成）

第二阶段继续对子域内部做目录级 clean-architecture 收束，目标是把“子域公开语义”与“inbound presentation facade”从 application 中剥离出来。

已完成调整：

- `room-session/contracts.ts` → `room-session/domain/contracts.ts`
- `room-session/presentation/store/sessionStoreApi.ts` → `room-session/adapters/inbound/presentation/store/sessionStoreApi.ts`
- `room-session/application/sessionState.ts` → `room-session/adapters/inbound/presentation/sessionState.ts`
- `message-flow/contracts.ts` → `message-flow/domain/contracts.ts`
- `message-flow/presentation/store/messageFlowStoreApi.ts` → `message-flow/adapters/inbound/presentation/store/messageFlowStoreApi.ts`
- `message-flow/application/messageFlowState.ts` → `message-flow/adapters/inbound/presentation/messageFlowState.ts`
- `room-governance/contracts.ts` → `room-governance/domain/contracts.ts`
- `room-governance/presentation/store/governanceStoreApi.ts` → `room-governance/adapters/inbound/presentation/store/governanceStoreApi.ts`
- `room-governance/application/governanceState.ts` → `room-governance/adapters/inbound/presentation/governanceState.ts`

原则说明：

- `domain/contracts.ts`
  - 表达子域持有的稳定业务语义与 Outcome。
- `adapters/inbound/presentation/*State.ts`
  - 只承担“子域 API 读取 presentation store”的 facade 作用。
  - 它们不是 application usecase，因此不再放在 `application/`。
- `adapters/inbound/presentation/store/*StoreApi.ts`
  - 明确是 presentation runtime 的读取口，而不是子域 application。

## 第三阶段（已完成）

第三阶段继续收束子域 `application/` 内部的语义目录，目标是去掉“平铺 application 文件夹”，让用例、服务、映射、策略、事件处理和恢复逻辑各归其位。

- `room-session/`
  - `application/channelData.ts` → `application/usecases/channelData.ts`
  - `application/channelViewActions.ts` → `application/usecases/channelViewActions.ts`
  - `application/ensureReady.ts` → `application/usecases/ensureReady.ts`
  - `application/resetState.ts` → `application/usecases/resetState.ts`
  - `application/pollingFallback.ts` → `application/services/pollingFallback.ts`
  - `application/readStateReporter.ts` → `application/services/readStateReporter.ts`
  - `application/wsManager.ts` → `application/services/wsManager.ts`
  - `application/readStateEventRouter.ts` → `application/event-handlers/readStateEventRouter.ts`
  - `application/resumeFailedCatchUp.ts` → `application/recovery/resumeFailedCatchUp.ts`
  - `application/ports.ts` → `application/ports/sessionPorts.ts`
- `message-flow/`
  - `application/composerActions.ts` → `application/usecases/composerActions.ts`
  - `application/messageActions.ts` → `application/usecases/messageActions.ts`
  - `application/messagePaging.ts` → `application/usecases/messagePaging.ts`
  - `application/domains.ts` → `application/services/domains.ts`
  - `application/messageModel.ts` → `application/mappers/messageModel.ts`
  - `application/messageEventRouter.ts` → `application/event-handlers/messageEventRouter.ts`
  - `application/ports.ts` 保持不变，作为跨 usecase / service 的稳定端口入口
- `room-governance/`
  - `application/channelUserActions.ts` → `application/usecases/channelUserActions.ts`
  - `application/channelAdminActions.ts` → `application/usecases/channelAdminActions.ts`
  - `application/admin-actions/*` → `application/usecases/admin-actions/*`
  - `application/apiMappers.ts` → `application/mappers/apiMappers.ts`
  - `application/scopeGuard.ts` → `application/policies/scopeGuard.ts`
  - `application/governanceCommandOutcome.ts` → `application/outcomes/governanceCommandOutcome.ts`
  - `application/ports.ts` 保持不变，作为治理动作共享的稳定端口入口

第三阶段后的规则：

- `application/usecases/`
  - 只放具有明确业务意图的命令/查询编排。
- `application/services/`
  - 只放跨多个 usecase 复用、但不适合作为领域实体的应用服务。
- `application/mappers/`
  - 只放 DTO / record 到子域模型的归一化映射逻辑。
- `application/event-handlers/`
  - 只放事件驱动的状态同步与路由逻辑。
- `application/policies/`
  - 只放作用域守卫、约束判断等无副作用策略。
- `application/outcomes/`
  - 只放 Outcome / 错误结果构造辅助。
- `application/recovery/`
  - 只放恢复、catch-up、降级后的补偿链路。
