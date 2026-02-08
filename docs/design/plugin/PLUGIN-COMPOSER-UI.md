# 插件 Composer UI 规范（草案）

目标：插件提供自定义消息的输入体验（PC+移动一致，基于 Vue/Web 技术栈），宿主负责统一发送与权限控制。

## 1. 宿主与插件的分工
- 插件负责：
  - 输入 UI 与交互（编辑、预览、校验提示）
  - 产出符合 contract 的 `{ domain, domain_version, data, reply_to_mid? }`
- 宿主负责：
  - 统一发送（调用底层网络与鉴权）
  - 统一错误提示与重试策略
  - 统一引用/回复选择（提供 `reply_to_mid`）

## 2. 推荐的 Vue 组件契约（P0）
插件 composer 组件建议采用“受控提交”方式：
- Props（宿主传入）
  - `context`：包含 `server_socket`、`cid`、`uid`、语言等只读上下文
  - `replyToMid?: number`
  - `disabled?: boolean`
- Emits（插件向宿主发出）
  - `submit(payload)`：`{ domain, domain_version, data, reply_to_mid? }`
  - `cancel()`：关闭 composer
  - `dirty-change(isDirty: boolean)`：宿主可用于离开确认

## 3. 校验建议
- 插件本地校验（即时）：长度、格式、必填字段
- 服务端最终校验（强制）：schema/约束/权限/频率

## 4. 失败与重试（待补齐）
- submit 失败后的 UI 行为（保留输入、展示错误、允许重试）
- 断线/重连期间的草稿处理

