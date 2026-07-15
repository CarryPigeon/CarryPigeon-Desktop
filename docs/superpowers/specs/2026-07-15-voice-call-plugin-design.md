# 通话功能插件化设计（完整外部插件包）

- 日期：2026-07-15
- 范围：将「通话 / 多人通话(会议) / 视频通话」三类能力从主程序内建 feature 剥离，改为 CarryPigeon-Desktop 插件系统承载。
- 状态：设计已确认，待进入实现计划（writing-plans）。

## 1. 背景与约束

### 1.1 现状

- 前端通话代码：`src/features/chat/voice-call/`（组件、composables、domain、i18n、api）。
- 后端通话代码：`src-tauri/src/features/voice_call/`（系统音频采集/播放、WebRTC、Tauri `State`/`Emitter`）。
- 插件宿主运行时已具备：
  - 前端：`src/features/plugins/presentation/runtime/`（动态 `import()` 插件 ESM、`domainRegistry` 模块加载、`hostApiFactory` 构造受控 Host API）。
  - 后端：`src-tauri/src/features/plugins/`（目录、安装/启用/卸载、`plugin_store` 下载/校验/解包、经 `app://plugins/<serverId>/<pluginId>/<version>/<entry>` 暴露前端 ESM）。
  - 加载入口 URL 由 `runtimeGateway.toAppPluginEntryUrl` 构造，entry 来自 Rust `pluginsGetRuntimeEntry`。

### 1.2 关键约束（决定方案）

1. **原生 Rust 后端无法成为 wasm 插件**：`voice_call` 后端使用系统音频、WebRTC、Tauri 运行时，wasmtime 组件环境无这些能力。因此后端**必须留在宿主进程**，作为「宿主原生能力」经 Host API 暴露给插件。
2. **现有 Host API 仅 `sendMessage` / `storage` / `network.fetch`**，无泛型 `invoke`、无事件订阅、无全局 UI 挂载能力。需扩展。
3. **现有插件 UI 模型仅 `renderers`/`composers`（按消息 domain 渲染气泡 + 编辑器）**，无法挂载通话所需的全局浮层、视频网格、来电横幅、聊天头部触发按钮。需扩展契约支持全局 UI。
4. **插件按 P0 运行时约定「直接可执行」**：宿主不对插件做 `.vue`/`.ts`/`.scss` 二次编译，插件须预构建为 JS/CSS。

## 2. 目标与非目标

### 2.1 目标

- 三类通话（1:1 语音、多人/会议、视频）整体迁入独立插件包 `plugins/voice-call/`。
- 插件独立构建（Vite 库模式）产出 ESM + 静态资源 + manifest，运行时由插件宿主加载。
- 插件经扩展后的 Host API 调用原生后端（`host.invoke`）、订阅后端事件（`host.onEvent`）、挂载全局 UI（`host.mountOverlay` / `host.registerToolbarAction`）。
- 主程序包移除 voice-call 内建 feature（router、chat UI 硬挂载、i18n、feature 目录）；宿主 chat UI 改为通用插件挂载点。

### 2.2 非目标（本期不做）

- 不把原生 Rust 后端改造成 wasm 插件（物理上不可行）。
- 不实现生产级插件分发基础设施（服务端目录、版本灰度等），仅提供开发期本地插件源 + 预留生产托管路径。
- 不改变通话业务逻辑本身（信令、音频管线、WebRTC）的行为，仅做承载层迁移。

## 3. 已确认决策

| 项 | 决策 |
|----|------|
| 目标形态 | 完整外部插件包（前端 ESM + 经 Host API 暴露的原生后端，运行时加载，移出主程序包） |
| 后端暴露方式 | 通用 `host.invoke(command, args)`（权限 + 命令白名单门控） |
| UI 挂载 | 扩展插件契约支持全局 UI（浮层 + 工具栏/头部入口） |
| 插件源码位置 | 仓内 `plugins/voice-call/` 目录，独立 Vite 库构建 |
| 提取范围 | 三种通话全部提取（含视频 signaling） |
| 依赖共享 | import map 共享宿主 `vue` / `tdesign-vue-next` |
| 开发期分发 | 本地插件源直接加载 `plugins/voice-call/dist` |

## 4. 架构总览

```
宿主进程（主程序）
 ├─ 原生后端：src-tauri/src/features/voice_call/  (Tauri commands，经 invoke_handler! 注册)
 ├─ 插件宿主运行时：src/features/plugins/  (加载、安装、启用、Host API 注入)
 └─ chat UI 通用挂载点：工具栏入口槽 + 浮层槽 + call_record 渲染器

plugins/voice-call/  (独立构建的 ESM 包)
 ├─ dist/index.js + style.css + manifest.json + assets
 └─ 入口导出：manifest / renderers / activate / deactivate

运行时数据流：
 插件 activate(ctx)
   → ctx.host.registerToolbarAction(发起通话)          // 聊天头部按钮
   → ctx.host.mountOverlay(VoiceCallHost)              // 通话面板/视频网格/来电横幅
   → ctx.host.onEvent("voice_call:incoming", handler)  // 订阅后端事件
 用户操作 → ctx.host.invoke("start_direct_call", {...}) // 调原生后端
 后端 emit voice_call:* → ctx.host.onEvent handler → 更新插件本地状态/浮层
```

## 5. Host API 扩展

在 `src/features/plugins/domain/types/pluginRuntimeTypes.ts` 的 `PluginContext.host` 新增：

```ts
host: {
  sendMessage(payload: PluginComposerPayload): Promise<void>;
  storage: { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> };
  network?: { fetch(input: string, init?: {...}): Promise<{...}> };

  // 新增：泛型命令调用（权限 + 命令白名单）
  invoke?<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;

  // 新增：订阅宿主 Tauri 事件（权限 + 事件白名单），返回取消函数
  onEvent?<T = unknown>(event: string, handler: (payload: T) => void): () => void;

  // 新增：挂载全局浮层组件
  mountOverlay?(component: Component, opts?: { zIndex?: number }): () => void;

  // 新增：注册聊天头部/工具栏入口
  registerToolbarAction?(action: {
    id: string;
    label: string;
    icon?: Component;
    order?: number;
    onClick: () => void;
  }): () => void;
}
```

- 实现位置：`hostApiFactory.ts` 新增 `createPluginInvokeApi` / `createPluginEventApi` / `createPluginUiApi`，内部包 `invokeTauri` 与 `@tauri-apps/api` 的 `listen`，UI 部分经 chat 宿主桥（`attachChatPluginHostBridge` / `chatPluginRuntime.ts`）挂载到 chat 布局槽。
- **安全门控**：
  - `invoke` 仅在插件声明 `invoke` 权限且命令匹配白名单（建议 `voice_call:*`）时注入；否则为 `undefined`。
  - `onEvent` 同理由 `events` 权限 + 白名单（`voice_call:*`）控制。
  - `mountOverlay` / `registerToolbarAction` 由 `ui` 权限控制。

## 6. 插件契约扩展

沿用现有入口导出 + `activate`/`deactivate`（`docs/design/plugin/PLUGIN-ENTRY-API.md`）。通话插件入口 `plugins/voice-call/src/index.ts`：

```ts
export const manifest = {
  pluginId: "voice-call",
  version: "0.1.0",
  entry: "index.js",
  permissions: ["invoke", "events", "ui", "storage"],
  providesDomains: ["call_record"],
};

export const renderers = {
  call_record: CallRecordBubble,   // 聊天中通话记录消息渲染
};

// composers 可选；发起通话走工具栏入口，不依赖 composer。

export function activate(ctx: PluginContext) {
  const detachToolbar = ctx.host.registerToolbarAction({
    id: "voice-call.start",
    label: ctx.lang === "zh_cn" ? "发起通话" : "Start Call",
    onClick: () => startCallFlow(ctx),
  });
  const unmountOverlay = ctx.host.mountOverlay(VoiceCallHost);
  const offIncoming = ctx.host.onEvent("voice_call:incoming", onIncoming);
  const offState = ctx.host.onEvent("voice_call:state_change", onStateChange);
  const offVideo = ctx.host.onEvent("voice_call:video_signaling", onVideoSignaling);
  ctx.__cleanup = () => { detachToolbar(); unmountOverlay(); offIncoming(); offState(); offVideo(); };
}

export function deactivate() {
  ctx.__cleanup?.();
}
```

> 说明：全局 UI 不新增 entry 导出形状，统一在 `activate(ctx)` 内通过 `host.mountOverlay` / `host.registerToolbarAction` 完成，保持入口契约最小。

## 7. 插件包结构与构建

### 7.1 目录（仓内 `plugins/voice-call/`）

```
plugins/voice-call/
  package.json
  vite.config.ts          # 库模式：format=es, entry=src/index.ts, 产出 dist/
  tsconfig.json
  src/
    index.ts              # 入口导出 manifest/renderers/activate/deactivate
    manifest.ts
    host/bridge.ts        # 封装 host.invoke / host.onEvent → 后端命令与事件
    components/           # 从 src/features/chat/voice-call/presentation/components 迁移
                          #   VoiceCallHost / VoiceCallPanel / VoiceCallTrigger /
                          #   VideoGrid / RemoteVideoTile / SelfPreviewTile /
                          #   VideoCallButton / VoiceCallBanner / CallRecordBubble
    composables/          # useVoiceCall / useVideoCall / useRingtone / useScreenShare
    domain/               # contracts / event router（从 chat/voice-call/domain 迁移）
    i18n/                 # 迁移的 i18n 文案（en_us / zh_cn）
    runtime/              # 插件本地状态（原 voiceCallState / voiceCallRuntimePorts）
  dist/                   # 构建产物：index.js + style.css + manifest.json + assets
```

### 7.2 构建方式

- Vite 库模式（`build.lib`），`formats: ['es']`，产出单入口 ESM + 自动拆分的 CSS/asset。
- **依赖共享（import map）**：`vue`、`tdesign-vue-next`、`@tauri-apps/api`（按需）标记为 `external`，不打包进插件；宿主在 `index.html` 注入 `<script type="importmap">`，将 `vue` / `tdesign-vue-next` 映射到宿主自身构建产出的 ESM URL（经 `app://` 或自定义协议提供）。宿主主程序自身也经同一 import map 解析这些依赖，确保插件与宿主共享同一运行时实例。
  - 宿主需有产出步骤：将 `vue` / `tdesign-vue-next` 构建为独立 ESM 文件并暴露为可寻址 URL（可在宿主 Vite 配置中用 `manualChunks` / 单独构建产出，再由 import map 引用）。
- `dist/manifest.json` 由构建脚本从 `src/manifest.ts` 生成，供本地插件源与宿主读取。

### 7.3 依赖共享备选（已否决）

插件自带打包 `vue` + TDesign：实现简单，但体积大且 TDesign 全局配置/主题/语言可能不共享，弃用。

## 8. 分发与运行时加载

### 8.1 开发期（采用）

- 复用现有 `RepoPluginCatalogPort` / `repoSourcesService`（`src/features/plugins/...`），新增**本地插件源**，其 `manifest.json` 直接指向 `plugins/voice-call/dist/manifest.json`（file 或本地 http）。
- 宿主在启用该本地源后，从目录发现 `voice-call` 插件，跳过下载/解包，直接经 `app://plugins/<serverId>/voice-call/<version>/index.js` 动态 `import()` 加载（需确保本地源产出的 entry URL 与构建产物路径一致）。
- 开发工作流：`pnpm plugins:build:voice-call` 构建插件 → 宿主 reload → 插件运行时加载并挂载 UI。

### 8.2 生产期（预留，非本期完成）

- 插件包静态托管（对象存储/CDN），服务端目录登记 `voice-call` 插件条目（含 `manifest`、资源 URL、sha256）。
- 宿主经 `plugin_store` 下载/校验/解包后，按现有 `app://plugins/...` 机制加载。
- 本期仅需保证契约与加载路径一致，使生产托管可在后续接入，不实现托管后端。

## 9. 后端（Rust）

- 保留 `src-tauri/src/features/voice_call/`，继续在 `invoke_handler!`（`src-tauri/src/app/mod.rs`）注册——这是 `host.invoke` 能调到它的前提。
- 命令白名单：`voice_call:*`（含 `start_direct_call`、`start_conference`、`join_conference`、`leave_conference`、`accept_call`、`reject_call`、`hangup_call`、`toggle_mute`、`toggle_noise_suppression`、`connect_signaling`、`send_video_signaling`、`enumerate_audio_devices`、`select_input_device`、`select_output_device` 等）。
- 事件白名单：`voice_call:*`（后端经 `app_handle.emit("voice_call:incoming" | "voice_call:state_change" | "voice_call:participant_update" | "voice_call:video_signaling" | "voice_call:ice_state", ...)` 发出，插件经 `host.onEvent` 订阅）。
- 可选重构：将 `voice_call` 归入「宿主内建插件后端」命名空间以明确语义，非必须。

## 10. 主程序清理

- 删除 `src/features/chat/voice-call/`（已整体迁入插件包）。
- `src/features/chat/presentation/patchbay/components/layout/ChatCenter.vue`：移除 `<VoiceCallTrigger>`（头部）与 `<VoiceCallHost>`（浮层）硬挂载，改为渲染宿主侧**通用**插件挂载点（工具栏入口槽 + 浮层槽）；`call_record` 消息经通用 `renderers` 渲染器槽渲染。
- 迁移 i18n 文案至插件包；移除主程序 `src/app/i18n/messages/*` 中 voice-call 相关条目（如本次工作区未改完的残留）。
- 移除 voice-call 相关 router/api/capability-source（若主程序有引用）。
- 更新 `scripts/check-feature-boundaries.sh` 边界、lint 配置、相关测试。

## 11. 分阶段实现计划（供 writing-plans 细化）

- **P0 脚手架**：建立 `plugins/voice-call/`（package.json、vite.config.ts、tsconfig.json），实现 Vite 库构建产出 `dist/{index.js,style.css,manifest.json,assets}`；宿主侧 import map 产出 `vue`/`tdesign` ESM 并注入 `index.html`。
- **P1 Host API 扩展**：`host.invoke` / `host.onEvent` / `host.mountOverlay` / `host.registerToolbarAction` 及权限 + 白名单门控；实现接入 `tauriPluginManager` / chat 宿主桥。
- **P2 迁移前端**：将 `src/features/chat/voice-call/` 组件/composables/domain/i18n/runtime 迁入插件包；实现 `host/bridge.ts`、`activate`/`deactivate`；用 `host.invoke` 替换原 `tauriVoiceCallApi`、用 `host.onEvent` 替换原 `listen("voice_call:*")`。
- **P3 宿主通用挂载点**：chat 布局新增工具栏入口槽、浮层槽、`call_record` 渲染器槽，替换 `ChatCenter.vue` 硬挂载，移除主程序 voice-call feature 目录。
- **P4 分发**：新增本地插件源直接加载 `plugins/voice-call/dist`，开发期验证加载与 UI 挂载。
- **P5 清理**：i18n 迁移收尾、feature-boundary/lint/测试更新。
- **P6 验证**：`pnpm typecheck`、`pnpm lint`、`pnpm tauri dev` 加载插件 + 手动走通 1:1 / 会议 / 视频通话全流程（发起、接听、挂断、静音、设备切换、视频信令）。

## 12. 风险与开放点

- **import map 依赖 URL**：宿主需产出可寻址的 `vue`/`tdesign` ESM；若宿主当前构建未单独产出这些文件，P0 需先打通产出 + import map 注入。
- **TDesign 全局配置共享**：主题/语言/全局配置经 import map 共享同一实例后应一致；需在 P1 验证。
- **权限白名单粒度**：`voice_call:*` 前缀白名单是否足够，还是需逐命令列举，在 P1 实现时确定（建议前缀 + 宿主内置 allowlist 常量）。
- **多实例/热重载**：开发期插件 reload 时 `deactivate` 清理是否彻底（浮层卸载、事件取消、Toolbar 注销），P2/P4 重点验证。

## 13. 验收标准（Definition of Done）

1. 主程序仓库不再包含 `src/features/chat/voice-call/` 内建 feature；chat UI 无通话硬挂载。
2. `plugins/voice-call/` 可独立构建为 ESM 包，含 manifest，不打包 `vue`/TDesign。
3. 宿主 Host API 提供 `invoke`/`onEvent`/`mountOverlay`/`registerToolbarAction`，且受权限 + 白名单门控。
4. 经本地插件源，宿主在运行时加载 `voice-call` 插件并显示发起按钮、通话浮层、视频网格、来电横幅、`call_record` 消息渲染。
5. 1:1 语音、多人会议、视频通话三类流程在插件化后功能等价（发起/接听/挂断/静音/设备切换/视频信令）。
6. `pnpm typecheck`、`pnpm lint` 通过；`pnpm tauri dev` 下插件加载与通话流程可手动验证。
