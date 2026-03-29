## chat/message-flow

### 定位

`message-flow` 负责消息维度流程：列表、发送、删除、分页、domain 渲染，不承载会话连接策略与频道治理。

### 负责内容

- 消息动作：发送、删除、回复态与输入态维护。
- 消息分页：首屏加载、增量刷新、历史翻页。
- 消息渲染抽象：`message/` 子域统一消息模型与渲染宿主。

### 当前模块

- `presentation/store/messageFlowStoreApi.ts`：对外暴露消息流公开状态与动作。
- `application/messageActions.ts`、`composerActions.ts`：发送、删除、回复态与输入态编排。
- `application/ports.ts`：message-flow 应用层依赖的最小输出端口。
- `application/domains.ts`、`messageModel.ts`：domain 选择与消息视图模型归一化。
- `application/messagePaging.ts`、`messageEventRouter.ts`：分页、增量同步与事件落盘。
- `internal.ts`：message-flow 内部装配出口，桥接 application 能力给 chat runtime 组合层使用。
- `upload/`：聊天文件上传任务编排。
- `message/`：消息语义、渲染模型、时间线共享组件与最终渲染宿主。
