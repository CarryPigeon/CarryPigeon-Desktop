## chat/message-flow

### 定位

`message-flow` 负责消息维度流程：列表、发送、删除、分页、domain 渲染，不承载会话连接策略与频道治理。

### 负责内容

- 消息动作：发送、删除、回复态与输入态维护。
- 消息分页：首屏加载、增量刷新、历史翻页。
- 消息渲染抽象：`message/` 子域统一消息模型与渲染宿主。

### 当前模块

- `domain/contracts.ts`：message-flow 持有的消息模型、composer payload 与 Outcome 语义。
- `presentation/store-access/messageFlowStoreAccess.ts`：message-flow presentation 层内部使用的 store 访问面。
- `presentation/runtime/messageFlowState.ts`：message-flow 自身持有的响应式状态容器与派生视图。
- `presentation/runtime/messageFlowStatePorts.ts`：把时间线/composer 状态适配成 application 可消费的显式状态端口。
- `presentation/runtime/messageFlowRuntimePorts.ts`：message-flow runtime 对外契约与状态切片类型。
- `presentation/runtime/messageFlowRuntime.ts`：聚合分页、composer、消息动作与 domain 视图能力的 message-flow runtime。
- `capability-source.ts`：子域内部 capability source，负责把 runtime store-access 适配为稳定 capability。
- `application/usecases/`：发送、删除、回复态、首屏加载、最新页刷新与历史翻页等有副作用编排。
- `application/services/domains.ts`：domain 选择服务，汇总 Core + 插件可用消息 domain。
- `application/mappers/messageModel.ts`：wire record 到消息视图模型的归一化映射与合并策略。
- `application/event-handlers/messageEventRouter.ts`：消息创建/删除事件路由与时间线增量落盘。
- `application/outcomes/messageActionOutcome.ts`：发送/删除消息的错误信息与失败 Outcome 构造。
- `application/ports.ts`：message-flow 应用层依赖的最小输出端口。
- `internal.ts`：message-flow 内部装配出口，桥接 application 能力给 chat application/runtime 装配根使用。
- `upload/`：message-flow 内部上传支持包，负责文件上传任务编排，不再单独维持子 capability 公开面。
- `message/`：message-flow 内部消息渲染支持包，负责消息语义、渲染模型、时间线共享组件与最终渲染宿主，不再单独维持子 capability 公开面。

### 说明

- 第二阶段后，公开消息语义进入 `domain/`，子域 capability 通过 `capability-source.ts` 组装，`store-access` 仅保留为 presentation/runtime 内部适配层。
- 第三阶段后，`application/` 继续按语义分层为 `usecases/services/mappers/event-handlers/outcomes`，减少“平铺文件夹”带来的职责混杂。
