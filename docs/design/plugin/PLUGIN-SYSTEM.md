# 插件系统总览（精简版）

> 目标：说明插件系统边界与主流程；详细契约分拆到子文档。

## 1. 范围

- 客户端插件：renderer / composer / 受控 Host API 调用。
- 服务端插件：domain 校验、规范化、落库扩展、事件推送协作。
- 隔离维度：以 `server_id` 为安装与本地状态隔离键。

## 2. 核心概念

- `plugin_id`：插件唯一标识。
- `domain` / `domain_version`：消息类型与契约版本。
- Contract：schema + constraints。

## 3. 主流程（高层）

1. 客户端连接服务器并拉取插件目录。
2. 若 required 不满足，进入安装向导并阻止登录。
3. 安装并启用后，插件注册 renderer/composer。
4. 发送自定义 domain 消息，服务端按 contract 校验处理。

## 4. 真源文档

- Manifest：`docs/design/plugin/PLUGIN-MANIFEST.md`
- 入口导出：`docs/design/plugin/PLUGIN-ENTRY-API.md`
- Composer 契约：`docs/design/plugin/PLUGIN-COMPOSER-UI.md`
- 客户端运行时：`docs/design/client/PLUGIN-RUNTIME.md`
- 协议与 required：`docs/design/protocol/PLUGIN-CATALOG-AND-ERRORS.md`
