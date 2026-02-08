# 客户端设计总览（精简版）

> 范围：客户端插件系统设计（PC + 移动端，Web/Vue 技术路线）。

## 1. 设计目标

- 跨端一致：同一插件产物在 PC 与移动端可运行。
- 隔离清晰：插件安装/版本/缓存按 `server_id` 隔离。
- 核心稳定：核心聊天能力稳定，插件扩展输入与渲染。
- 可演进：保持契约稳定，允许运行时从同进程演进到沙箱。

## 2. 核心模块

- Server：服务器管理、连接状态、required 安装引导。
- Auth：登录/注册/token 绑定（受 required gate 约束）。
- Message：列表、推送、回复、删除、已读。
- Plugin Center：目录、安装、启停、更新、回滚。

## 3. 能力边界

- 插件能力由宿主 API 白名单控制。
- 插件不得直接访问宿主敏感状态（token/跨服务器缓存）。
- 默认存储能力按 `server_id` 隔离。

## 4. 设计索引

- 子目录入口：`docs/design/client/README.md`
- 运行时：`docs/design/client/PLUGIN-RUNTIME.md`
- 状态机：`docs/design/client/PLUGIN-CENTER-FLOWS.md`
- 包结构：`docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`
- URL 规范：`docs/design/client/APP-URL-SPEC.md`
