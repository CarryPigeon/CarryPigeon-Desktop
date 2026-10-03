# 插件入口模块 API（Cordis v2 契约）

> 目标：定义客户端加载插件 ESM 所需的最小导出契约。
> 运行时内核与迁移背景见 `docs/design/plugin/CORDIS-MIGRATION.md`。

## 1. 入口模块约束（P0）

- 插件必须提供 ESM 入口（默认 `index.js`，由 `manifest.entry` 指定）。
- 插件安装后必须可直接执行；宿主不做二次编译/转译。
- 资源映射遵循 `app://plugins/<server_id>/<plugin_id>/<version>/...`。
- 入口 API 版本由 `plugin.json` 的 `entry_api_version` 声明：`2` 为本页契约；缺省/`1` 按旧契约加载（见 §4）。

参考：
- `docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`
- `docs/design/client/APP-URL-SPEC.md`

## 2. 必须导出（P0）

```ts
import type { Context } from "@carrypigeon/plugin-sdk"; // 实际路径见脚手架

export const name = "markdown";
export const manifest = { /* plugin.json 同源元数据，信息参考 */ };
export const inject = ["domains", "server"]; // 需要的能力服务

export function apply(ctx: Context): void {
  ctx.domains.renderer("markdown", MarkdownMessage);
  ctx.domains.composer("markdown", MarkdownComposer);
}
```

- `apply(ctx)`：同步执行插件装配（异步初始化用 `ctx.effect(async () => dispose)` 或 `ctx.on("ready", ...)`）。
- `inject`：声明需要的宿主能力服务；未授权的能力不会被注入（见权限门控）。

## 3. 能力服务（P0）

| 服务 | 触发权限 | 说明 |
| --- | --- | --- |
| `ctx.server` | 始终 | `{ serverSocket, serverId, getCid(), getUid(), lang }` |
| `ctx.storage` | 始终 | `get/set`（按 serverId + pluginId 隔离） |
| `ctx.domains` | 始终 | `renderer/composer/contract` 注册 |
| `ctx.ui` | `ui` | `mountOverlay` / `registerToolbarAction` |
| `ctx.network` | `network` | 同源 `fetch` |
| `ctx.ai` | `ai` | `isConfigured` / `summarize` |
| `ctx.messages` | `messages:read` / `messages:send` | 当前频道读取 + 发送 |
| `ctx.ipc` | `invoke` / `events` | 受前缀白名单约束的 `invoke` / `onEvent` |

生命周期：
- 注册型资源（renderer/composer/overlay/toolbar/事件订阅）随插件 fiber 自动释放；
- 其他清理用 `ctx.on("dispose", fn)` 或 `ctx.effect(() => dispose)`。

## 4. 兼容性边界

- 网络能力仅能通过 `ctx.network` 获取；`ctx.ai` 密钥由宿主代持。
- 存储命名空间按 `server_id` 隔离，不允许跨服务器读写。
- 插件资源引用应使用相对路径或 `new URL(rel, import.meta.url)`。
- 旧契约（`activate/deactivate` + 静态 `renderers/composers/contracts`）由宿主 legacy adapter 兼容，无需改写即可继续运行。

## 5. 关联文档

- Manifest：`docs/design/plugin/PLUGIN-MANIFEST.md`
- Composer 契约：`docs/design/plugin/PLUGIN-COMPOSER-UI.md`
- Cordis 迁移方案：`docs/design/plugin/CORDIS-MIGRATION.md`
