# 插件入口模块 API（精简版）

> 目标：定义客户端加载插件 ESM 所需的最小导出契约。

## 1. 入口模块约束（P0）

- 插件必须提供 ESM 入口（默认 `index.js`，由 `manifest.entry` 指定）。
- 插件安装后必须可直接执行；宿主不做二次编译/转译。
- 资源映射遵循 `app://plugins/<server_id>/<plugin_id>/<version>/...`。

参考：
- `docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`
- `docs/design/client/APP-URL-SPEC.md`

## 2. 必须导出（P0）

- `manifest`
- `renderers`（`domain -> VueComponent`）
- `composers`（`domain -> VueComponent`）
- `contracts`（推荐）

说明：只渲染不输入的 domain，可只提供 `renderers`。

## 3. 可选导出（P1）

- `activate(ctx)`
- `deactivate()`

其中 `ctx` 为宿主注入的受限上下文。

## 4. 兼容性边界

- 网络能力仅能通过宿主受控 API 获取。
- 存储命名空间按 `server_id` 隔离，不允许跨服务器读写。
- 插件资源引用应使用相对路径或 `new URL(rel, import.meta.url)`。

## 5. 关联文档

- Manifest：`docs/design/plugin/PLUGIN-MANIFEST.md`
- Composer 契约：`docs/design/plugin/PLUGIN-COMPOSER-UI.md`
- 运行时边界：`docs/design/client/PLUGIN-RUNTIME.md`
