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
- 不直接维护 server socket/TLS 配置（由 `servers` feature 负责）。

## 关键概念

- **ChatApiPort / ChatEventsPort**：聊天 HTTP 与事件（WS）端口抽象（domain 层）。
- **liveChat（运行时 store 族）**：将“频道/消息/未读/成员/事件流”等状态拆分为多个可组合的模块，最终由门面 store 聚合对外提供能力。
- **domain 渲染**：
  - Core domain（例如 `Core:Text`）由内建组件渲染；
  - 非 Core domain 通过 `plugins` 的 `DomainRegistryStore` 查询对应 renderer/composer。

## 目录结构

- `domain/`：聊天领域的 ports/types/usecases（与 UI/传输无关的业务规则）。
- `data/`：HTTP/WS 适配器实现（以及 mock/protocol mock 的接入点）。
- `di/`：依赖装配（mock/live 的 ports 选择）。
- `presentation/`：页面、组件、composables、store（UI 与状态）。
- `mock/`：脱离后端的内存 mock store（用于 UI 预览/离线开发）。

## 主要入口（导航）

- 页面入口：`src/features/chat/presentation/pages/MainPage.vue`
- 门面 store（对 UI 暴露的主要 API）：`src/features/chat/presentation/store/chatStore.ts`
- liveChat 聚合 store：`src/features/chat/presentation/store/liveChatStore.ts`
- liveChat 子模块：`src/features/chat/presentation/store/liveChat/`
- 领域 ports：
  - HTTP：`src/features/chat/domain/ports/chatApiPort.ts`
  - WS：`src/features/chat/domain/ports/chatEventsPort.ts`
- 领域用例：`src/features/chat/domain/usecases/`
- WS 适配器：`src/features/chat/data/wsChatEvents.ts`
- HTTP 适配器：`src/features/chat/data/httpChatApi.ts`

## 关键流程（概览）

- 进入聊天页：
  1) 确保 server 上下文（`servers/currentServerSocket`）
  2) `ensureChatReady`（门面 store）初始化必要状态
  3) 拉取频道列表、加载当前频道消息、订阅 WS（若启用）
- 发送消息：
  1) 由 composer 生成 payload（Core 或插件 composer）
  2) 调用 `SendMessage` 用例
  3) 成功后更新本地时间线或等待 WS 回推
- 未读/读状态：
  - 拉取未读：`GetUnreads`
  - 上报读状态：`UpdateReadState`（通常在频道切换/滚动到末尾时触发）

## 与其他模块的协作

- `servers`：提供当前 server socket；所有 chat 请求都以此为作用域隔离。
- `network`：提供底层连接能力（在需要 TCP 握手/协议连接的场景）。
- `plugins`：提供 domain 运行时注册表（renderer/composer/contract），chat 用于渲染未知 domain 与挂载插件输入框。
- `user`：提供当前用户上下文（uid、语言等）用于消息发送与 UI 展示。

## 相关文档

- `docs/客户端开发指南.md`
- `docs/落地矩阵-PRD-v1.1_API-v1.0.md`
