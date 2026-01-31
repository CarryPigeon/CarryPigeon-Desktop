# 客户端插件 UI 扩展点（草案）

目标：在不破坏核心聊天体验的前提下，让插件可以“插入 UI”，实现自定义消息输入与渲染。

## 1. 必备扩展点（P0）

### 1.1 Message Renderer（消息渲染）
- 入口：`renderers[domain] -> VueComponent`
- 输入：统一消息模型（mid/cid/uid/send_time/domain/domain_version/data/reply_to_mid?）
- 输出：渲染内容（可降级）

### 1.2 Message Composer（消息输入）
- 入口：`composers[domain] -> VueComponent`
- 目标：提供比“schema 表单”更强的输入体验（例如公式面板、预览、模板）
- 宿主负责统一发送；插件只 emit submit payload（见 `design/plugin/PLUGIN-COMPOSER-UI.md`）

## 2. 推荐扩展点（P1）
- Channel Panel：频道侧边栏 tab（例如 MC 在线列表、诗词索引）
- Settings Page：插件设置页（按服务器隔离）
- Slash Commands：输入框命令（例如 `/latex` 打开 composer）

## 3. 降级策略（必须）
- 未安装对应 renderer：显示 preview 或“需要插件”提示，不阻塞频道。
- composer 不可用：仍可发送 Core:Text。

