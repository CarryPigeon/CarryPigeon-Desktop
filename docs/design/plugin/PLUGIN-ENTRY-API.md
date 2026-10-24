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
| `ctx.ui` | `ui` | `mountOverlay` / `registerToolbarAction` / `registerSettingsItem` |
| `ctx.network` | `network`（跨源另需 `network:external`） | 受控 `fetch`（支持 `@secret()` 头引用与 `timeoutMs`） |
| `ctx.secrets` | `secrets` | 密钥保管箱：`set/status/clear`（keyring 代持，只写不读） |
| `ctx.messages` | `messages:read` / `messages:send` | 当前频道读取 + 发送 |
| `ctx.ipc` | `invoke` / `events` | 受前缀白名单约束的 `invoke` / `onEvent` |

生命周期：
- 注册型资源（renderer/composer/overlay/toolbar/settings item/事件订阅）随插件 fiber 自动释放；
- 其他清理用 `ctx.on("dispose", fn)` 或 `ctx.effect(() => dispose)`。

### 3.1 设置项注册（`ctx.ui.registerSettingsItem`）

宿主设置页会为每个**已启用**插件聚合一个「插件设置」分区，并提供统一的左侧搜索（可搜到插件设置项的标题/说明/关键词）。插件只提供「元数据 + 控件组件」，卡片外壳、分组与错误边界由宿主负责。

```ts
import { defineComponent, h, ref } from "vue";

export function apply(ctx: Context) {
  const Mode = defineComponent({
    name: "MyPluginModeSetting",
    setup() {
      const mode = ref("auto");
      return () =>
        h("div", {}, [
          h("button", { onClick: () => (mode.value = "auto") }, "自动"),
          h("button", { onClick: () => (mode.value = "server") }, "仅服务端"),
        ]);
    },
  });

  const cancel = ctx.ui?.registerSettingsItem?.({
    id: "backend",                 // 插件内唯一；^[A-Za-z0-9._:-]{1,64}$
    title: ctx.server.lang === "zh_cn" ? "后端选择" : "Backend",  // 由插件自行本地化
    description: "选择请求所走的通道",
    keywords: ["backend", "后端", "server", "服务端"],  // 追加搜索词（建议中英同义词）
    order: 10,                     // 越小越靠前
    component: Mode,
  });
  // cancel() 可提前反注册；不调用则随插件 fiber 销毁自动反注册。
}
```

约定与边界：
- **权限**：需要 manifest 声明 `ui` 权限（未授权时 `ctx.ui` 为 `undefined`）。
- **作用域**：设置项归属「当前 server」——只在注册它的 server 运行时内可见；停用/卸载插件或切换 server 后立即从设置页与搜索结果中消失。
- **id**：`^[A-Za-z0-9._:-]{1,64}$`；同插件内重复注册视为替换（旧的反注册函数不会误删新项）；单插件最多 **20** 项，超出忽略并记日志。
- **文案**：宿主不翻译插件声明文本，插件需自行按 `ctx.server.lang` 本地化；`title`/`description`/`keywords` 会参与宿主搜索匹配。
- **持久化**：设置项自身的取值请用 `ctx.storage`（按 serverId + pluginId 隔离），宿主不保存插件设置值；敏感值（如 API Key）应经 `ctx.secrets` 写入系统凭据管理器，绝不落 KV 存储。
- **兼容性**：旧宿主（无该方法）上直接调用会抛出并导致插件加载失败，建议
  `if (typeof ctx.ui?.registerSettingsItem === "function") { ... }` 守卫，或提升 `plugin.json` 的 `min_host_version`。
- **样例**：内置 `ai-summary` 插件用该能力提供「AI 摘要后端」与「AI 服务提供方」两组设置项。

## 4. 兼容性边界

- 网络能力仅能通过 `ctx.network` 获取：默认仅同源；跨源需 manifest 声明 `network:external`。
- 请求头值中的 `@secret(<name>)` 引用由宿主 Rust 侧从该插件的密钥保管箱解析替换；密钥明文不进入 WebView。
- 存储命名空间按 `server_id` 隔离，不允许跨服务器读写；密钥保管箱同样按 `server_id + plugin_id` 隔离。
- 插件资源引用应使用相对路径或 `new URL(rel, import.meta.url)`。
- 旧契约（`activate/deactivate` + 静态 `renderers/composers/contracts`）由宿主 legacy adapter 兼容，无需改写即可继续运行。

## 5. 关联文档

- Manifest：`docs/design/plugin/PLUGIN-MANIFEST.md`
- Composer 契约：`docs/design/plugin/PLUGIN-COMPOSER-UI.md`
- Cordis 迁移方案：`docs/design/plugin/CORDIS-MIGRATION.md`
