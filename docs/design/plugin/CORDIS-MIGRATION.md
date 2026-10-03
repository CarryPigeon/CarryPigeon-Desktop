# 插件系统 Cordis 重构方案

- 状态：待评审（Draft）
- 目标版本：v0.6.0
- 依赖选型：`@cordisjs/core@^3.18.1`（Cordis v3）
- 决策基线：见 §0

> 本文是插件运行时（客户端）的重构方案与落地清单。协议、安装/下载、服务端插件不在范围内。

---

## 0. 决策冻结

| # | 决策项 | 结论 | 落地含义 |
| --- | --- | --- | --- |
| 1 | Cordis 版本 | **v3（`@cordisjs/core`）** | 锁定 `^3.18.1`；不采用 4.0.0-rc（官方声明 API 未稳定） |
| 2 | 服务端插件 | **不纳入** | `server-plugins/**`（Java/Spring）零改动；`ctx.network.fetch` 契约不变 |
| 3 | v1 插件兼容 | **需要** | 提供 legacy adapter，远端已发布 v1 插件零改动可运行 |
| 4 | theme 主题读取 | **保留直读 localStorage** | theme 不走 `ctx.storage`，作为已知例外在代码与本文记录 |
| 5 | IPC 白名单 | **改为 manifest 声明** | 新增 `ipcPrefixes`，替换 `hostApiFactory` 中硬编码的 `"voice_call:"` |
| 6 | 上线方式 | **一次性切换** | 不引入 `VITE_PLUGIN_RUNTIME` 运行时开关；长分支开发，单次发版切换并删除旧 runtime |

---

## 1. 背景与目标

### 1.1 背景

客户端插件运行时目前由 `src/features/plugins/presentation/**` 自研实现，包含一套仿 Cordis 的作用域内核（`pluginScope.ts` / `pluginScopeRegistry.ts`）、宿主能力工厂（`hostApiFactory.ts`）、上下文解析器（`domainRegistryContext.ts`）与状态对齐器（`domainRegistryReconciler.ts`）。

现有实现已具备插件加载与能力门控，但存在如下结构性问题：

1. **重复造轮子**：自研 scope 内核本质是 Cordis `Context` / `ForkScope` 的阉割版，并通过 `runInPluginScope` / `getCurrentPluginScope` 做隐式当前作用域绑定。
2. **权限门控分散**：能力注入集中在 `createHostApi` 的 if-else，IPC 白名单前缀硬编码为 `"voice_call:"`。
3. **生命周期人工对齐**：`reconciler` 手工 diff 已安装状态与已加载状态，enable/disable/uninstall/switchVersion 各自处理 dispose。
4. **无法声明依赖**：插件无法声明"我需要哪些能力"，只能在运行时对整体 host 判空。
5. **UI 桥接复杂**：`pluginUiApi` 与 `chatPluginUiBridge` 双层注册表，并附带宿主重挂载的注册重放逻辑。
6. **缺失基础设施**：无服务注册、事件总线、依赖注入、热重载、配置 schema。

### 1.2 目标

- 以 Cordis `Context` **完全替换**自研 `PluginScope` / `pluginScopeRegistry`。
- 宿主能力改为 **Cordis 服务**；权限等价于"服务可见性"；插件通过 `inject` 声明依赖。
- 生命周期交由 Cordis 管理：`ctx.plugin()` / `fiber.dispose()` / `ctx.effect()` / `ctx.on('dispose')`。
- 五个客户端插件全部迁移为 Cordis 插件（`{ name, inject, apply }`）。
- 保留 manifest、安装、版本、required-gate、权限模型与 Rust 侧实现。
- 提供 v1 兼容适配器，保证远端旧插件在切换后继续可用。

### 1.3 非目标

- 不修改 Rust 安装 / 下载 / 校验 / 存储 / 网络与 TLS 逻辑。
- 不引入安全沙箱（Cordis 不是安全边界，权限仍由宿主服务门控）。
- 不迁移服务端插件（Java/Spring）。
- 不修改协议与插件目录（catalog）契约。

---

## 2. 现状盘点

### 2.1 现状架构

```text
┌─ Rust (src-tauri/src/features/plugins) ──────────────────────┐
│  install / download / sha256 / unpack / storage / net fetch  │
│  pluginsGetRuntimeEntry, pluginsStorageGet/Set, ...          │
└──────────────────────────────┬───────────────────────────────┘
                               │ invoke
┌─ 前端 src/features/plugins ──▼───────────────────────────────┐
│ domainRegistryStore（按 server，Vue reactive）               │
│   ├─ pluginScopeRegistry   → 自研 PluginScope 树             │
│   ├─ domainRegistryContext → 构造旧式 PluginContext          │
│   ├─ hostApiFactory        → storage/network/ai/messages/... │
│   ├─ domainRegistryBindings→ renderers/composers 注册         │
│   └─ domainRegistryReconciler → 与 installed 状态对齐         │
│  动态 import app://plugins/<server>/<plugin>/<ver>/index.js   │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 现有插件入口契约（v1）

```ts
export const manifest
export const renderers: Record<string, VueComponent>
export const composers: Record<string, VueComponent>
export const contracts?: PluginRuntimeContract[]
export function activate(ctx: PluginContext): void
export function deactivate(): void
```

### 2.3 现状关键文件

| 文件 | 职责 |
| --- | --- |
| `presentation/runtime/pluginScope.ts` | 自研作用域内核（层级 dispose） |
| `presentation/store/pluginScopeRegistry.ts` | server/plugin 作用域树注册表 |
| `presentation/runtime/hostApiFactory.ts` | 能力构造与权限门控 |
| `presentation/store/domainRegistryContext.ts` | 构建旧式 `PluginContext` |
| `presentation/store/domainRegistryStore.ts` | 按 server 的加载/启用总控 |
| `presentation/store/domainRegistryReconciler.ts` | installed ↔ loaded 对齐 |
| `presentation/store/domainRegistryBindings.ts` | renderer/composer 绑定 |
| `presentation/runtime/pluginUiApi.ts` | overlay / toolbar 桥 |
| `presentation/runtime/pluginInvokeApi.ts` | 受白名单约束的 invoke |
| `presentation/runtime/pluginEventApi.ts` | 受白名单约束的事件订阅 |

---

## 3. Cordis v3 API 核对结论

> 本节为源码核对结果（`@cordisjs/core@3.18.1`），若干语义与直觉不同，实现必须按此进行。

| API | 精确语义 | 对本方案的影响 |
| --- | --- | --- |
| `new Context(config?)` | 每次创建独立 root（自有 store / isolate / internal） | 可**每 server 一个独立 root Context**，天然按 server 隔离 |
| `ctx.isolate(name, label?)` | **一次只隔离一个服务名**：`shadow[name] = label ?? Symbol(name)`，每次调用产生**新 symbol** | 插件级能力隔离必须**逐服务名链式调用**；不同分支的 `isolate('storage')` 互不可见 |
| `ctx.set(name, value)` | 返回 disposer；同一 isolation key 下重复 set 非空值会 `throw new Error("service ... has been registered")` | 每个插件实例必须拥有独立 isolate 链，否则第二个插件 set `storage` 会直接抛错 |
| `ctx.get(name)` | 以 `ctx[isolate][name]` 作为 key 查询 store | 子 context 通过原型链继承父 isolate 映射 |
| `ctx.plugin(plugin, config)` | 返回 `ForkScope`；`Plugin.Object = { name?, inject?, Config?, apply(ctx, config) }` | 迁移后的插件即该形态 |
| `inject` | `string[] \| { [name]: { required: boolean } }` | **原生支持可选依赖**（`ai` / `messages` 等可选能力适用） |
| `apply` | 类型签名为**同步** `(ctx, config) => void` | 异步初始化改用 `ctx.effect(async () => dispose)` 或 `ctx.on('ready', ...)` |
| `ctx.effect(cb)` / `ctx.on('dispose'\|'ready'\|'fork')` / `ctx.start()/stop()` | 标准生命周期 | 替代自研 `onDispose` / scope |
| `Service` 抽象类 | 可选；普通能力对象使用 `ctx.set` 更简单 | 能力服务优先用 `ctx.set`，仅需 `start/stop/fork` 时才用 class |
| 类型声明 | `declare module "@cordisjs/core"` 扩展 `interface Context` | 新增 `runtime/types.ts`（经 `@/features/plugins/sdk` 透出给插件） |

**结论**：拓扑按"每 server 一个独立 root `Context` + 每插件能力服务逐名 `isolate`"设计。

---

## 4. 目标架构

### 4.1 拓扑

```text
serverCtx = new Context()                 // 每 server 一个独立 root，断开即回收
│  set('server', { socket, serverId, getCid, getUid, lang })   // server 全局
│  共享注册表 DomainsRegistry 保存在闭包中，不作为 Cordis 服务
│
├─ pluginCtx(markdown)   = serverCtx.isolate('storage').isolate('domains')
├─ pluginCtx(theme)      = serverCtx.isolate('storage').isolate('domains').isolate('ui')
├─ pluginCtx(ai-summary) = serverCtx.isolate('storage').isolate('domains').isolate('ai')
│                                     .isolate('messages').isolate('ui')
└─ pluginCtx(voice-call) = serverCtx.isolate('storage').isolate('domains').isolate('ipc').isolate('ui')
```

每个 `pluginCtx` 上运行一个 **host wrapper plugin**：在 wrapper 的 `apply(ctx)` 中先按权限 `ctx.set(...)` 注入能力服务，再 `ctx.plugin(真实插件)`。由此获得：

- 能力服务实例闭包持有 `pluginId`（storage 命名空间、ui 注册归属、ipc 白名单均可对齐）；
- 服务生命周期绑定在 wrapper fiber 上，`fiber.dispose()` 自动清理；
- 真实插件作为子 fiber，其 `inject` 可解析到这些服务。

### 4.2 宿主内核

```ts
// src/features/plugins/runtime/applyPlugin.ts
import type { Context, Plugin } from "@cordisjs/core"

const CAPS = ["storage", "domains", "network", "ai", "messages", "ui", "ipc"] as const

export function applyPlugin(
  serverCtx: Context,
  registry: DomainsRegistry,
  runtime: PluginRuntimeEntry,
  mod: Plugin,
  config?: unknown,
) {
  // 1) 必需权限前置校验：缺失抛领域错误 -> fiber FAILED -> reconciler markFailed（不静默 pending）
  assertRequiredPermissions(runtime)

  // 2) 逐服务名隔离，避免同 server 下多插件 set 同名服务冲突
  const pluginCtx = CAPS.reduce((ctx, name) => ctx.isolate(name), serverCtx)

  const wrapper: Plugin.Object = {
    name: `host:${runtime.pluginId}@${runtime.version}`,
    apply(ctx) {
      const perms = new Set(runtime.permissions)
      ctx.set("storage", makeStorageService(serverCtx, runtime))
      ctx.set("domains", makeDomainsService(registry, runtime)) // dispose 时清理该插件注册
      if (perms.has("network"))       ctx.set("network",  makeNetworkService(serverCtx, runtime))
      if (perms.has("ai"))            ctx.set("ai",       makeAiService(serverCtx, runtime))
      if (perms.has("messages:read")) ctx.set("messages", makeMessagesService(serverCtx, runtime))
      if (perms.has("ui"))            ctx.set("ui",       makeUiService(serverCtx, runtime, chatPluginUiBridge))
      if (perms.has("invoke") || perms.has("events")) {
        ctx.set("ipc", makeIpcService(serverCtx, runtime, runtime.ipcPrefixes ?? []))
      }
      ctx.plugin(mod, config) // 真实插件作为子 fiber
    },
  }
  return pluginCtx.plugin(wrapper)
}
```

### 4.3 生命周期对照

| 场景 | 现状 | Cordis |
| --- | --- | --- |
| 启用插件 | `getOrCreatePluginScope` + `activate(ctx)` | `applyPlugin()` → `ctx.plugin()` |
| 禁用插件 | `disposePluginScopesForPlugin` + `deactivate()` | `fiber.dispose()` |
| 卸载 / 切版本 | 同上 + store 删除 | `fiber.dispose()` + 重新 `applyPlugin()` |
| 清理回调 | `ctx.onDispose(cb)` / `scope.onDispose` | `ctx.effect(() => cb)` / `ctx.on('dispose', cb)` |
| 事件订阅 | `host.onEvent` + 手工 off | `ctx.on(name, handler)` 自动解绑 |
| 服务器切换 | `disposeServerScopeTree` | `serverCtx.stop()` + 释放 root scope |

---

## 5. 权限模型

### 5.1 原则

**权限 = 服务可见性**：宿主仅把被授权的能力服务 `set` 到插件 context；插件以 `inject` 声明依赖。

- 未授权的能力服务不存在 → 使用 `inject: [name]` 的插件不会 apply；
- 可选能力使用 `inject: { name: { required: false } }`；
- 必需权限在本方案中由 **manifest.permissions 决定**，宿主在 apply 前 `assertRequiredPermissions` 显式失败，避免静默 pending。

### 5.2 权限 → 服务映射

| manifest.permissions | `ctx.set` 的服务 | 实现来源 |
| --- | --- | --- |
| （永远） | `storage` | `pluginsStorageGet` / `pluginsStorageSet`（按 serverId + pluginId 隔离） |
| （永远） | `domains` | 写入共享 `DomainsRegistry`，dispose 时清空 |
| `ui` | `ui` | `chatPluginUiBridge`（overlay / toolbar） |
| `network` | `network` | `pluginsNetworkFetch`（Rust 侧同源强制） |
| `ai` | `ai` | `getAiCapabilities()`（密钥宿主代持） |
| `messages:read` | `messages.readCurrentChannel` / `messages.loadMoreHistory` | `chatPluginMessagesBridge` |
| `messages:send` | `messages.send` | `hostBridge.sendMessage` |
| `invoke` | `ipc.invoke` | 前缀白名单 = manifest `ipcPrefixes` |
| `events` | `ipc.onEvent` | 前缀白名单 = manifest `ipcPrefixes` |

> 安全强化（已落地）：
> - `ipc.invoke` 与 `ipc.onEvent` 虽共享 `ipc` 服务，但**分别**由 `invoke` / `events` 权限门控，
>   仅授予 `events` 的插件无法调用 `invoke`（反之亦然）。
> - 命令/事件前缀受**双重约束**：`plugin.json` 的 `ipcPrefixes`（Rust 已校验）
>   ∩ 宿主可暴露命名空间白名单（`EXPOSABLE_IPC_NAMESPACES`，当前仅 `voice_call:`）。
>   仅凭清单声明无法放开任意 Tauri 命令，拒绝 `*` / 空串等过宽前缀。
> - `apply` 内部抛出的异常会被 Cordis 吞入 scope，宿主在 `serverCtx.start()` 后检查
>   wrapper / 真实插件 scope 的 `FAILED` 状态并向上抛出，避免“加载成功但未生效”的静默失败。

---

## 6. 插件入口契约 v2

### 6.1 新契约

```ts
// plugins/markdown/src/index.ts
import type { Context } from "@/features/plugins/sdk"
import MarkdownMessage from "./components/MarkdownMessage.vue"
import MarkdownComposer from "./components/MarkdownComposer.vue"
import { markdownManifest } from "./manifest"

export const name = "markdown"
export const manifest = markdownManifest // 静态元数据保留（catalog / 校验 / 权限提示）
export const inject = ["domains"]        // 依赖即能力

export function apply(ctx: Context) {
  ctx.domains.renderer("markdown", MarkdownMessage) // dispose 时自动反注册
  ctx.domains.composer("markdown", MarkdownComposer)
}
```

要点：

- 入口仍必须是可直接 `import()` 的 ESM（`dist/index.js`）；Cordis 不改变打包约束。
- `manifest` 继续作为**静态元数据**保留；Cordis 的 `Config` 仅承载运行期配置，不替代 manifest。
- `renderers` / `composers` 由"模块静态导出"改为**运行时注册到 `domains` 服务**，随 fiber 生命周期挂载/卸载。

### 6.2 注册 API

```ts
ctx.domains.renderer(domain, component)   // 等价旧 renderers[domain]
ctx.domains.composer(domain, component)   // 等价旧 composers[domain]
ctx.domains.contract({ domain, domainVersion, payloadSchema, constraints })
```

宿主侧 chat 消费方式基本不变：仍通过 `getPluginRuntimeCapabilities(serverSocket).getBinding(domain).renderer/composer` 获取组件（内部改为读 `domains` 注册表）。

### 6.3 v1 → v2 对照

| v1 | v2 |
| --- | --- |
| `renderers` 静态 map | `ctx.domains.renderer(domain, comp)` |
| `composers` 静态 map | `ctx.domains.composer(domain, comp)` |
| `contracts` | `ctx.domains.contract({...})` |
| `activate(ctx)` | `apply(ctx)` |
| `deactivate()` | `ctx.on("dispose", ...)` |
| `ctx.host.mountOverlay` | `ctx.ui.mountOverlay` |
| `ctx.host.registerToolbarAction` | `ctx.ui.registerToolbarAction`（自动随 fiber 解绑） |
| `ctx.host.network.fetch` | `ctx.network.fetch` |
| `ctx.host.ai.*` | `ctx.ai.*` |
| `ctx.host.messages.*` | `ctx.messages.*` |
| `ctx.host.invoke` / `onEvent` | `ctx.ipc.invoke` / `ctx.ipc.onEvent` |
| `ctx.onDispose(cb)` | `ctx.effect(() => cb)` / `ctx.on("dispose", cb)` |
| `bindContext` 单例桥 | 不需要（`apply` 闭包持有 ctx） |

### 6.4 manifest 增量字段

```jsonc
{
  "pluginId": "voice-call",
  "entryApiVersion": 2,           // 缺省 = 1（旧插件）
  "ipcPrefixes": ["voice_call:"], // 替换硬编码白名单
  // 其余不变：version / entry / permissions / providesDomains / min_host_version
}
```

---

## 7. v1 兼容适配器

```ts
// src/features/plugins/runtime/legacyAdapter.ts
export function legacyToCordis(mod: LoadedPluginModuleV1, runtime: PluginRuntimeEntry): Plugin.Object {
  return {
    name: `legacy:${runtime.pluginId}`,
    inject: capabilityInjectFor(runtime.permissions),
    apply(ctx: Context) {
      ctx.domains.registerRecord(mod.renderers, mod.composers, mod.contracts)
      mod.activate?.(buildLegacyContext(ctx, runtime)) // 还原旧 PluginContext 全字段（含 onDispose）
      ctx.on("dispose", () => mod.deactivate?.())
    },
  }
}
```

`loadPluginModule` 按 `entryApiVersion` 分流：`2 → 直接使用`，`1 或缺省 → legacyToCordis`。

强制要求：`buildLegacyContext` 的返回值必须用旧 `PluginContext` 类型做编译期校验（`satisfies`），字段缺一不可；并为 adapter 编写专项测试，直接加载迁移前的 `plugins/*/src/index.ts` 验证。

---

## 8. 宿主改造清单

### 8.1 删除

- `presentation/runtime/pluginScope.ts`
- `presentation/store/pluginScopeRegistry.ts`
- `presentation/store/domainRegistryContext.ts`
- `presentation/runtime/hostApiFactory.ts`（拆分为 services）
- `presentation/runtime/pluginUiApi.ts`、`pluginInvokeApi.ts`、`pluginEventApi.ts`（并入 services）
- `presentation/store/domainRegistryBindings.ts`（并入 `domains` service）

### 8.2 新增 `src/features/plugins/runtime/`

```text
runtime/
├── createServerContext.ts        # new Context() + server 服务 + 共享 DomainsRegistry
├── applyPlugin.ts                # 隔离链 + wrapper + 权限校验（§4.2）
├── permissions.ts                # 权限 -> 服务可见性 + assertRequiredPermissions
├── legacyAdapter.ts              # v1 -> Cordis（§7）
├── loadPluginModule.ts           # import + normalize + host 版本校验 + v1/v2 分流
├── types.ts                      # declare module "@cordisjs/core" 扩展 Context
└── services/
    ├── server.ts
    ├── storage.ts
    ├── network.ts
    ├── ai.ts
    ├── messages.ts
    ├── ui.ts
    ├── ipc.ts
    └── domains.ts
```

分层约束：`runtime/**` 属 application/infrastructure 层，允许依赖 Cordis / Tauri；`domain/**` 保持纯净，Cordis 类型不得渗入 domain 端口与类型。迁移时把 `pluginRuntimeTypes.ts` 中平台耦合类型（如 Vue `Component`）收敛到 runtime 层。

### 8.3 保留 / 微调

- `domainRegistryStore.ts` → 薄适配层：持有 `serverCtx`，向 chat 暴露 `getBinding` / `getContextFor*` 的 Vue 投影（chat 侧调用签名不变）。
- `domainRegistryReconciler.ts` → enable/disable 改调 `applyPlugin()` / `fiber.dispose()`。
- `pluginHostCompatibility.ts`（min_host_version）、`pluginRuntime.ts`（dynamic import + style 注入）保留。
- Rust 全部命令、`chat/public/api.ts` 的 `chatPluginUiBridge` / `chatPluginMessagesBridge` 保留。
- Cordis logger 通过 exporter 接入现有 `createLogger`（英文日志 + Action 词汇表）。

---

## 9. 五个客户端插件迁移

| 插件 | `inject` | manifest 增量 | 迁移要点 | 难度 |
| --- | --- | --- | --- | --- |
| markdown | `["domains"]` | — | 注册式改造，`activate/deactivate` 全删 | ★ |
| theme | `["ui"]` | — | **保留直读 `carrypigeon:theme`**；`matchMedia` 监听改 `ctx.effect` | ★★ |
| group-notice | `["ui","network"]` | — | 删除 `bindContext`，ctx 由 `apply` 闭包持有 | ★★ |
| ai-summary | `["ui","ai","messages"]` | — | 删除 `host/bridge.ts` | ★★ |
| voice-call | `["ui","ipc","storage","domains"]` | `ipcPrefixes: ["voice_call:"]` | 事件改 `ctx.on`；`renderer` 注册；`onEvent/invoke` → `ctx.ipc` | ★★★★ |

统一改造模式：删除各插件中的

```ts
let cleanup: (() => void) | null = null
export function activate(ctx) { bindContext(ctx); /* ... */ cleanup = () => { /* ... */ } }
export function deactivate() { cleanup?.(); cleanup = null }
```

替换为直接在 `apply(ctx)` 中于 `ctx` 上注册；`plugins/*/src/host/bridge.ts` 的模块级 ctx 单例可统一移除。

---

## 10. 构建与依赖

1. 根 `package.json` 增加 `@cordisjs/core`。
2. 新增 `src/cordis-entry.ts`（`export * from "@cordisjs/core"`），vendor 构建产出独立 `public/vendor/cordis.mjs`
   （与 vue/tdesign 的 `vendor.mjs` 分开，避免 `export *` 同名导出被浏览器判为歧义丢弃）。
3. `index.html` importmap 增加 `"@cordisjs/core": "/vendor/cordis.mjs"`。
4. 各 `plugins/*/vite.config.ts` 的 `resolve.alias` 增加 `@cordisjs/core → /vendor/cordis.mjs`，`external` 同步放行。
5. 宿主 `vite.config.ts` 将 `@cordisjs/core` 加入 build `external` 与 `optimizeDeps.include`，
   并在 dev vendor shim 中按预构建实例重导出（保证宿主与插件共享同一 Cordis 运行时）。
5. **单实例是硬要求**：`symbols.isolate` 与服务 store 依赖模块 identity，插件若打包自带 Cordis 副本会导致注入静默失效，因此必须走 vendor 共享。

---

## 11. 一次性切换推进方式（决策 6）

因不引入运行时开关，"一次切换"按如下方式落地：

1. 在长生命周期分支 `refactor/plugin-cordis` 开发，`master` 保持可发布。
2. 分支内按里程碑推进（PoC → 宿主内核 → SDK/契约 → 插件迁移 → 删旧），**对外无中间发布**。
3. 合并时新 runtime、legacy adapter、五个迁移后的插件、旧 runtime 删除在**同一次发版**内完成。
4. 合并前打 git tag 作为回滚锚点；出问题回退整版（而非运行时开关）。
5. legacy adapter 常驻：它不是开关，而是 v1 协议支持。

**风险集中点**：无开关意味着 legacy adapter 必须覆盖旧 `PluginContext` 全字段，否则旧插件在切换瞬间全部失效。缓解：`buildLegacyContext` 编译期字段校验 + adapter 专项测试（加载迁移前插件版本）。

---

## 12. 测试与 lint

### 12.1 测试

- 重写：`pluginScope.test.ts`、`hostApiFactory.test.ts`、`pluginEventApi.test.ts`、`pluginInvokeApi.test.ts`、`domainRegistryContext.test.ts`
- 调整：`pluginRuntime.test.ts`、`domainRegistryStore.test.ts`、`chatPluginUiBridge.test.ts`
- 新增：`createServerContext.test.ts`（权限 → 服务可见性）、`legacyAdapter.test.ts`、各插件 `apply/dispose` 测试

### 12.2 lint

- `scripts/check-feature-boundaries.sh`：Cordis import 限定在 plugins feature 内及 `vendor-entry.ts`。
- 前端日志规范（英文日志 + Action 词汇表）继续适用。
- 命令：`pnpm lint` / `pnpm build` / `pnpm test`；Rust 侧 `cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1`。

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Cordis 单实例被打包多份 | 服务注入静默失效 | 强制 vendor + importmap + 插件 alias；加集成测试断言 |
| Cordis v4 API 不稳定 | 返工 | 锁 v3.18，不跟进 rc |
| 异步 apply/dispose 时序 | 竞态 | 统一 `await` fiber / `ctx.start()`；reconciler 串行化 |
| 插件组件被 Vue 深度代理 | 渲染告警与开销 | 注册边界统一 `markRaw`（沿用 `moduleNormalizers` 做法） |
| 权限语义变化（服务不可见 = 不 apply） | 插件静默不生效 | apply 前 `assertRequiredPermissions`，缺失即 markFailed + 明确错误 |
| legacy adapter 遗漏（如 `onDispose`） | 远端旧插件失效 | 覆盖旧 `PluginContext` 全字段 + 回归测试 |
| `ctx.on` 处理器抛错影响其他插件 | 单插件拖垮全局 | 统一 error boundary 包裹，接入现有 logger |
| 无运行时开关、一次性切换 | 出问题无法局部回退 | 合并前 tag；充分回归；legacy adapter 覆盖 v1 |

---

## 14. 文档更新清单

- `docs/design/plugin/PLUGIN-ENTRY-API.md`（改为 v2 契约，最优先）
- `docs/design/plugin/PLUGIN-SYSTEM.md`（架构图）
- `docs/design/plugin/PLUGIN-MANIFEST.md`（新增 `entryApiVersion` / `ipcPrefixes`）
- `docs/design/plugin/PLUGIN-COMPOSER-UI.md`（composer 注册方式）
- `docs/design/client/PLUGIN-RUNTIME.md`（生命周期 / 权限 / 服务）
- `docs/design/client/PLUGIN-UI-EXTENSIONS.md`（扩展点改为 `ctx.domains` / `ctx.ui`）
- `docs/design/plugin/CORDIS-MIGRATION.md`（本文，含 theme 直读例外说明）

---

## 15. 里程碑

| 阶段 | 内容 | 验收标准 |
| --- | --- | --- |
| P0 决策 + PoC | 锁定 Cordis 版本；最小 `Context` PoC：加载 markdown 并注册 renderer，验证 isolate/set/plugin/dispose | enable → render → disable → dispose 全链路通过，fiber 计数归零 |
| P1 宿主内核 | 实现 `runtime/**` 全部服务 + `createServerContext` + `applyPlugin` + 权限映射；接入 vendor/importmap | 旧五插件经 legacy adapter 在 Cordis runtime 下全部跑通，行为与旧 runtime 一致 |
| P2 SDK + 契约 v2 | `plugin-sdk` 类型、`entryApiVersion`、`domains` 注册 API、legacy adapter 收口 | markdown 迁移为原生 v2，测试通过；v1/v2 混跑正常 |
| P3 插件迁移 | 按 markdown → theme → group-notice → ai-summary → voice-call 逐个迁移 | 每个插件有 `apply/dispose` 与功能回归测试 |
| P4 切换 + 删旧 | 默认走 Cordis；删除旧 runtime；删除辅助层 | `pnpm lint` / `pnpm build` / `pnpm test` / `cargo test` 全绿 |
| P5 文档 + 清理 | 更新全部设计文档与 SDK 示例 | 文档与真源一致 |

---

## 16. 相关链接

- `docs/design/plugin/README.md`
- `docs/design/plugin/PLUGIN-ENTRY-API.md`
- `docs/design/plugin/PLUGIN-MANIFEST.md`
- `docs/design/client/PLUGIN-RUNTIME.md`
- `docs/design/client/PLUGIN-UI-EXTENSIONS.md`
- `docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`
- `docs/design/protocol/PLUGIN-CATALOG-AND-ERRORS.md`

---

## 17. 变更记录

| 日期 | 变更 | 说明 |
| --- | --- | --- |
| 2026-09-30 | 初稿 | 基于 Cordis v3 API 核对与六项决策冻结产出 |
