# chat（聊天）

## 定位

chat 负责“聊天域”的端到端落地：频道列表、消息列表、消息发送/删除/修改、未读与读状态上报，以及（可选的）事件流（WS）连接与重连策略。它也是插件体系的主要宿主：消息 `domain` 的渲染与 composer 的挂载都发生在 chat UI 内。

## 职责边界

做什么：

- 基于 HTTP/WS 拉取/订阅聊天数据，并维护展示层状态（列表、分页、加载态、错误态）。
- 把 domain 消息映射为可渲染的 UI 模型；当 domain 由插件提供时，通过插件 runtime 渲染。
- 提供 UI 交互：频道切换、消息操作菜单、快速切换器等。

不做什么：

- 不负责插件安装/启用（由 `plugins` feature 负责），chat 只消费“可用的 domain runtime”。
- 不直接维护 server socket/TLS 配置（由 `server-connection` feature 负责）。

## 跨 Feature 入口（强约束）

- 跨 feature 仅通过 `src/features/chat/public/api.ts` 使用 chat 能力；主入口为 `createChatCapabilities()` / `getChatCapabilities()`（object-capability）。
- `ChatCapabilities` 当前分为 `session` / `messageFlow` / `governance` 三组最小命令/查询能力；根 capability 不暴露 `use*View()` 这类 Vue 视图对象。
- `src/features/chat/public/api-types.ts` 仅导出稳定公共类型；聚合 runtime store / runtime slice 类型不属于跨 feature 契约。
- `chat/public/api.ts` 是 chat 跨 feature 唯一值入口，详见 `docs/Feature API公开约束.md`。
- `src/features/chat/public/routes.ts` 是 chat 页面路由的唯一公共入口；`app/router` 只应通过该入口装配聊天页面。
- `chat/typechecks/*`、`chat/application/*`、`chat/domain/*`、`chat/data/*`、`chat/room-session/*`、`chat/message-flow/*`、`chat/room-governance/*`、`chat/presentation/*` 视为 chat 内部实现，不作为跨 feature 稳定入口。
- `src/features/chat/public/styles.ts` 是 app composition root 唯一允许消费的公共样式入口；`presentation/styles/*` 仍属于内部实现。

## 关键概念

- **ChatApiPort / ChatEventsPort**：聊天 HTTP 与事件（WS）端口抽象（domain 层）。
- **chat runtime assembly**：`application/runtime/createChatRuntime.ts` 是 chat 唯一的对象生命周期归口；ports、usecases、runtime gateway 与聚合 runtime 都在这里集中装配与缓存。
- **chat usecase factory**：`application/runtime/createChatUsecases.ts` 只描述显式用例的创建方式，不承担全局缓存职责。
- **workspace coordinator outcome**：`application/runtime/createChatWorkspaceCoordinator.ts` 把“切服 + 插件刷新 + session ready”链路建模成显式 `Outcome`，不再在组合层把 `server-connection` 的切服结果降级成 `boolean` 或 `void + onAsyncError`。
- **ChannelSummary**：`shared-kernel/channelSummary.ts` 是 room-session / room-governance 共享的中立频道摘要契约，避免子域互相牵引。
- **chat runtime store**：将“频道/消息/未读/成员/事件流”等状态拆分为多个可组合的模块，最终由聚合 store 对外提供能力。
- **subdomain capability API**：`room-session/api.ts`、`message-flow/api.ts`、`room-governance/api.ts` 统一暴露 `create/get*Capabilities()`；页面层通过 capability 创建局部 view（directory/current-channel/timeline/composer），而不是消费模块级裸函数或直接拼接底层 store。
- **chat runtime contracts**：`presentation/store/live/chatRuntimePorts.ts` 统一转发 `room-session/presentation/runtime/sessionRuntimePorts.ts`、`message-flow/presentation/runtime/messageFlowRuntimePorts.ts`、`room-governance/presentation/runtime/governanceRuntimePorts.ts` 与 `chatScopePort.ts`，根层只保留聚合转发。
- **chat session shared context**：`room-session/presentation/runtime/sessionSharedContext.ts` 统一封装 socket/token/scope、频道目录刷新与读状态上报，作为各 runtime 共享的会话上下文适配层。
- **session connection runtime**：`room-session/presentation/runtime/sessionConnectionRuntime.ts` 只负责 room-session 中的连接生命周期；外层 `room-session/presentation/runtime/sessionRuntime.ts` 负责把连接子系统与频道视图动作聚合为公开会话能力。
- **domain 渲染**：
  - Core domain（例如 `Core:Text`）由内建组件渲染；
  - 非 Core domain 通过 `plugins` 暴露的 plugin runtime view 查询 binding/context。

## 目录结构

- `domain/`：聊天领域的 ports/types/usecases（与 UI/传输无关的业务规则）。
- `application/`：聊天应用层编排；`runtime/` 收敛装配根、usecase factory、gateway 组装与 workspace 协调流程，`ports/` 收敛应用层内部契约。
- `public/`：chat 对 app / 其他 feature 的唯一稳定公开边界。
- `shared-kernel/`：供 room-session / room-governance 等子域共享的稳定核心语义。
- `data/`：聊天对外基础设施适配层，承载 HTTP/WS 协议、account/server-connection/plugins 适配器。
  - `data/protocol/*`：集中承载协议层 snake_case wire contract。
- `typechecks/`：仅用于 TypeScript 编译期契约检查，不承载运行时实现或稳定公共契约。
- `room-session/`：会话上下文与连接阶段编排。
- `room-session/domain/contracts.ts`：频道模型，由 room-session 自己持有。
- `room-session/application/`：会话子域的非 UI 编排，继续细分为 `usecases/`、`services/`、`event-handlers/`、`recovery/` 与 `ports/`。
- `message-flow/`：消息列表、消息语义、发送与渲染扩展点。
- `message-flow/application/`：消息子域的非 UI 编排，继续细分为 `usecases/`、`services/`、`mappers/` 与 `event-handlers/`。
- `message-flow/domain/contracts.ts`：消息模型与 composer payload，由 message-flow 自己持有。
- `room-governance/`：成员/申请/禁言/频道治理能力。
- `room-governance/domain/contracts.ts`：治理相关成员/申请/封禁模型，由 room-governance 自己持有。
- `room-governance/application/`：治理子域的非 UI 编排，继续细分为 `usecases/`、`mappers/`、`policies/`、`outcomes/` 与稳定 `ports.ts`。
- `presentation/`：页面、组件、composables、store（UI 与状态）。
  - `store/live/`：实时 store 的内部实现目录，和上层公开 store/type 文件分层。
  - `store/chatStoreTypes.ts`：仅保留 feature 内部 runtime store / slice 契约，不再作为公共模型源头。
  - `room-session/presentation/runtime/sessionSharedContext.ts`：chat runtime 共享的会话上下文，隔离 scope/token/channel-data/read-state 等跨子域基础设施。
  - `room-session/presentation/runtime/sessionConnectionRuntime.ts`：session 子系统中的连接生命周期运行时，隔离 WS/polling/catch-up 等连接细节。
  - `components/layout/`：Patchbay 四栏骨架组件（server/channel/chat/member）。
  - `components/composer/`：消息输入与 domain 选择组件。
  - `components/menus/` / `components/dialogs/` / `components/overlay/`：浮层型 UI，按交互语义分目录。
  - `types/`：presentation 层共享 view-model/type contract，避免 composable 反向依赖具体组件。
  - `message-flow/message/presentation/components/`：消息时间线共享组件与未知 domain 降级卡，统一由 message 子域持有。
  - `composables/useSignalViewport`：消息面板滚动/分页/已读上报编排。
  - `composables/usePatchbayLifecycle`：主页面启动与全局监听器生命周期。
  - `composables/useQuickSwitcher`：快速切换候选构建与选中动作分发。
  - `composables/useMessageContextMenu`：消息右键菜单状态与动作分发。
  - `composables/useChannelSettingsMenu`：频道设置菜单坐标与显隐编排。
  - `composables/useChannelNavigation`：频道详情类页面路由跳转与 query 组装。
  - `composables/useChannelDialogs`：创建/删除频道弹窗状态与后续动作编排。
  - `composables/useChannelInfoPage`：频道信息页的 route 适配、加入状态与编辑流程编排。
  - `composables/useChannelInfoPageRoute`：频道信息页原始 route query 解析，和页面动作编排解耦。
  - `application/runtime/createChatWorkspaceCoordinator`：收敛当前 workspace 的启动、切服、依赖刷新与插件桥接链路。
  - `composables/usePatchbayWorkspace`：收敛 workspace 级读模型与跨 feature 协调（server/plugin/host-bridge），不承担完整页面装配。
  - `composables/usePatchbayPageModel`：作为 MainPage 的页面装配根，负责把 workspace、子域 capability、导航、浮层、快捷键、生命周期和 layout model 组装成最终页面模型。
  - `composables/patchbayPageSections`：承载 Patchbay 各局部 section 的局部模型类型与构造器，避免页面装配根再次膨胀成样板聚合点。
  - `composables/useChannelRailModel` / `useMembersRailModel` / `useChatCenterModel`：把 layout 组件所需的 store 读取与交互动作下沉成 view-model；这些模型优先消费 room-session/message-flow/governance capability 创建的局部视图，而不是直接触碰原始 store 字段。
  - `composables/usePatchbayHotkeys`：主窗口全局快捷键与浮层收拢逻辑。
  - `composables/usePluginNavigation`：插件中心入口与安装提示跳转编排。
  - `composables/usePluginHostBridge`：只负责 host bridge 注入/卸载生命周期，不再混入 domain registry 只读视图查询。
  - `composables/asyncTaskRunner`：页面交互层统一异步异常兜底 helper。
  - `composables/useChannelScopedRefresh`：频道管理子页面（members/applications/bans）通用“按频道+scope 刷新”。
  - `room-governance/presentation/composables/`：治理子页面专属 page-composable 与共享 route 适配，避免 `.vue` 同时承担加载、权限和动作编排职责。
  - `room-governance/presentation/composables/useGovernancePageState`：治理子页面共享的加载态、错误态与频道 id 守卫协议，避免成员/申请/封禁页重复维护页面级异步样板。
  - `room-governance/presentation/components/GovernancePageShell.vue`：治理子页面共享骨架，统一头部、返回、标题、加载态与错误态容器。
- `mock/`：脱离后端的内存 mock store（用于 UI 预览/离线开发）。

## 主要入口（导航）

- 页面入口：`src/features/chat/presentation/pages/MainPage.vue`
- 频道信息 popover 视图：`src/features/chat/presentation/pages/ChannelInfoPopoverView.vue`
- chat runtime 聚合 store：`src/features/chat/presentation/store/live/chatRuntimeStore.ts`
- room-session 会话编排子模块：`src/features/chat/room-session/presentation/runtime/`
- message-flow 消息流子模块：`src/features/chat/message-flow/presentation/runtime/`
- room-governance 管理页：`src/features/chat/room-governance/presentation/pages/`
- message-flow/upload 文件上传子模块：`src/features/chat/message-flow/upload/`
- room-governance 治理子模块：`src/features/chat/room-governance/presentation/runtime/`
- 领域 ports：
  - HTTP：`src/features/chat/domain/ports/chatApiPort.ts`
  - WS：`src/features/chat/domain/ports/chatEventsPort.ts`
- 领域用例：`src/features/chat/domain/usecases/`
- WS 适配器：`src/features/chat/data/chat-events/wsChatEvents.ts`
- HTTP 适配器：`src/features/chat/data/chat-api/httpChatApi.ts`

## 阅读顺序

如果你现在抓不住 chat 怎么设计，建议按下面顺序读，而不是直接从页面或 store 开始翻：

1. `src/features/chat/README.md`
   先建立总图：有哪些子域、谁负责什么、跨 feature 从哪里进。
2. `src/features/chat/public/api.ts`
   看 chat 对外到底暴露了什么。这里决定“跨 feature 能怎么用 chat”。
3. `src/features/chat/public/api-types.ts`
   看 chat 对外承诺了哪些稳定类型，尤其是 `session / messageFlow / governance` 三组 capability。
4. `src/features/chat/application/runtime/createChatRuntime.ts`
   看 chat 的 application/runtime 装配根。这里回答“整个 chat 是怎么被装起来的”。
5. `src/features/chat/presentation/store/live/chatStoreAssemblies.ts`
   看聚合 runtime 如何拆成 `sessionSharedContext + governance + messageFlow + session`。
6. 按子域深入：
   - `room-session/README.md`
   - `message-flow/README.md`
   - `room-governance/README.md`
7. 最后再看页面：
   - `presentation/composables/usePatchbayPageModel.ts`
   - `presentation/pages/MainPage.vue`

这样读会比“先从页面点进去再一路追函数”更容易建立结构感。

## 去哪找什么

你后面维护 chat 时，可以按这个索引找代码：

- 想看“chat 对外能力”：
  - `public/api.ts`
  - `public/api-types.ts`
- 想看“整个 chat 怎么装起来”：
  - `application/runtime/createChatRuntime.ts`
  - `presentation/store/live/chatStoreAssemblies.ts`
- 想看“切服 / workspace 启动 / 插件桥接”：
  - `application/runtime/createChatWorkspaceCoordinator.ts`
  - `presentation/composables/usePatchbayWorkspace.ts`
- 想看“频道切换 / WS 接入 / catch-up / 读状态”：
  - `room-session/*`
- 想看“消息列表 / 分页 / composer / domain 渲染 / 上传”：
  - `message-flow/*`
- 想看“成员 / 管理员 / 申请 / 封禁 / 创建删除频道”：
  - `room-governance/*`
- 想看“页面如何把这些能力组装成 UI”：
  - `presentation/composables/usePatchbayPageModel.ts`
  - `presentation/composables/useChannelRailModel.ts`
  - `presentation/composables/useChatCenterModel.ts`
  - `presentation/composables/useMembersRailModel.ts`
- 想看“chat 和别的 feature 怎么接”：
  - `data/server-workspace.ts`
  - `data/plugin-access.ts`
  - `data/plugin-runtime.ts`
  - `data/account-session.ts`

## 关键流程（概览）

- 进入聊天页：
  1) `usePatchbayPageModel` 先装配 `usePatchbayWorkspace`、room-session capability 与 message-flow capability
  2) `usePatchbayWorkspace` 通过 `createChatWorkspaceCoordinator` 同步 server workspace、插件目录与 host bridge
  3) `ensureChatReady`（通过 room-session capability 暴露）初始化会话必要状态
  4) room-session / message-flow runtime 拉取频道列表、加载当前频道消息，并在可用时接入 WS / catch-up
- 进入频道治理子页面（成员/申请/禁言）：
  1) 基于 route query 解析 `channelId`
  2) 挂载时执行一次数据刷新
  3) 监听 `observeChannelProjectionChanged(...)`，仅在 `channelId` 与 `projection` 匹配时增量刷新
- 发送消息：
  1) 由 composer 生成 payload（Core 或插件 composer）
  2) 调用 `SendMessage` 用例
  3) 成功后更新本地时间线或等待 WS 回推
- 未读/读状态：
  - 拉取未读：`GetUnreads`
  - 上报读状态：`UpdateReadState`（通常在频道切换/滚动到末尾时触发）

### 事件流主链（建议先读）

1. `wsChatEvents` 建立连接并转发原始事件。
2. `createChatEventRouter` 按事件类型分发到 message/session/governance 子域。
3. 子域 store 更新本地状态；若 WS 不可用则由 polling/catch-up 补齐。
4. UI 层优先消费子域 capability API（`room-session/api`、`message-flow/api`、`room-governance/api`）；页面编排优先通过 capability 创建局部视图，只有跨子域组合读取时才访问 `chatStore`。

## 与其他模块的协作

- `server-connection`：提供当前 server socket、server-info 与连接能力。
- `plugins`：提供 plugin runtime view（binding/context 查询），chat 用于渲染未知 domain 与挂载插件输入框。
- `account`：提供当前用户上下文（uid、语言等）用于消息发送与 UI 展示。

## 相关文档

- `docs/客户端开发指南.md`
- `docs/tmp/prd-api-migration-matrix-v1.1-v1.0.md`
