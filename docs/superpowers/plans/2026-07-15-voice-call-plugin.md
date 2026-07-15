# 通话功能插件化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 1:1 语音、多人会议、视频通话三类能力从主程序内建 feature 剥离为独立构建、运行时加载的插件包 `plugins/voice-call/`，原生后端经扩展的 Host API（`invoke`/`onEvent`/`mountOverlay`/`registerToolbarAction`）暴露，主程序不再内建 voice-call。

**Architecture:** 前端语音代码迁入 `plugins/voice-call/`（Vite 库构建产出 ESM + manifest，`vue`/`tdesign-vue-next` 经 import map 共享宿主实例）；插件经 `activate` 注册工具栏入口、挂载浮层、订阅 `voice_call:*` 事件，并经 `host.invoke` 调宿主原生 Rust 后端。宿主 chat UI 改为通用插件挂载点（工具栏槽 + 浮层槽 + `call_record` 渲染器槽）。开发期经本地插件源直接加载 `dist`。

**Tech Stack:** Tauri 2 + Rust（后端保留）；Vue 3 + TypeScript + Vite 8（前端/插件）；TDesign Vue Next（auto-import）；vue-i18n；Vitest（jsdom）；宿主插件运行时（`src/features/plugins/`）。

## Global Constraints

- 路径别名 `@` → `src/`；TDesign 组件/composables 自动导入，无需手写 import。
- Vite dev 端口固定 **1420**（`strictPort: true`）；宿主 `build.target: esnext`，`manualChunks` 已把 `node_modules/vue` 拆为 `vendor-vue`。
- 注释用中文，日志用英文（tracing）；Rust 生产代码禁止 `unwrap`/`expect`/`panic!`/`todo!`；`#[tauri::command]` 必须返回 `CommandResult<T>`。
- 插件按 P0 运行时约定「直接可执行」：宿主不编译 `.vue`/`.ts`/`.scss`，插件须预构建为 JS/CSS。
- 跨 feature 仅经 `@/features/<name>/api` 或 `api-types`；`domain/` 禁止依赖 Vue/Tauri/浏览器 API。
- `pnpm run lint` 在 Windows 跳过 bash 检查（`lint:feature:boundaries`/`lint:logs:std`/`lint:rust:std`）。
- 后端命令白名单 `voice_call:*`；事件白名单 `voice_call:*`。
- 每个 task 结束独立可测并提交。

---

## 文件结构总览

**新建：**
- `plugins/voice-call/package.json` — 插件包元信息
- `plugins/voice-call/vite.config.ts` — 库构建（external vue/tdesign/@tauri-apps/api）
- `plugins/voice-call/tsconfig.json`
- `plugins/voice-call/src/vendor-entry.ts` — 暂不需要（宿主侧产 vendor）
- `plugins/voice-call/src/manifest.ts` — 插件 manifest 常量
- `plugins/voice-call/src/index.ts` — 入口导出 `manifest`/`renderers`/`activate`/`deactivate`
- `plugins/voice-call/src/host/bridge.ts` — 封装 `host.invoke`/`host.onEvent`
- `plugins/voice-call/src/components/**` — 从 `src/features/chat/voice-call/presentation/components` 迁入
- `plugins/voice-call/src/composables/**` — 从 `src/features/chat/voice-call/composition` 迁入
- `plugins/voice-call/src/domain/**` — 从 `src/features/chat/voice-call/domain` 迁入
- `plugins/voice-call/src/i18n/**` — 从主程序 i18n 抽出 voice-call 文案
- `plugins/voice-call/src/runtime/**` — 从 `src/features/chat/voice-call/presentation/runtime` 迁入
- `public/vendor/vendor.mjs` — 宿主产出的共享 `vue`+`tdesign-vue-next` ESM（构建生成）
- `src/vendor-entry.ts` — 宿主 vendor 入口（re-export vue + tdesign）
- `src/features/plugins/vite.vendor.config.ts` — 宿主 vendor 库构建配置
- `src/features/plugins/presentation/runtime/pluginInvokeApi.ts` — 新增 `createPluginInvokeApi`
- `src/features/plugins/presentation/runtime/pluginEventApi.ts` — 新增 `createPluginEventApi`
- `src/features/plugins/presentation/runtime/pluginUiApi.ts` — 新增 `createPluginUiApi`
- `src/features/plugins/presentation/components/PluginOverlayHost.vue` — 全局浮层容器
- `src/features/plugins/presentation/components/PluginToolbarSlot.vue` — 工具栏入口槽
- `src/features/chat/presentation/plugins/chatPluginUiBridge.ts` — chat 实现 `mountOverlay`/`registerToolbarAction`
- `src/features/plugins/data/localPluginSource.ts` — 本地插件源（直接加载 dist）
- `scripts/build-vendor.mjs` 或并入 `vite.vendor.config.ts` 的 npm script

**修改：**
- `index.html` — 注入 import map（dev + build）
- `vite.config.ts` — host external vue/tdesign；`optimizeDeps.exclude`；`predev`/`prebuild` 钩子（构建 vendor）
- `package.json` — 新增 `plugins:build:voice-call`、`predev`、`prebuild`、`vendor:build` 脚本
- `src/features/plugins/domain/types/pluginRuntimeTypes.ts` — `PluginContext.host` 扩展 `invoke`/`onEvent`/`mountOverlay`/`registerToolbarAction`
- `src/features/plugins/presentation/runtime/hostApiFactory.ts` — 组装新 host API
- `src/features/plugins/presentation/runtime/pluginRuntime.ts` — 加载后调用 `activate`、卸载调用 `deactivate`
- `src/features/plugins/presentation/store/domainRegistryModuleLoader.ts` — 构造 ctx 时注入新 host API（含 UI 桥）
- `src/features/chat/data/plugins/chatPluginRuntime.ts` — 暴露 UI 桥给插件运行时
- `src/features/chat/presentation/patchbay/components/layout/ChatCenter.vue` — 移除 `<VoiceCallTrigger>`/`<VoiceCallHost>` 硬挂载，改渲染 `<PluginToolbarSlot>` + `<PluginOverlayHost>` + `call_record` 渲染器
- `src/features/chat/voice-call/**` — 迁入插件包后删除（P5）

---

## Task 1: 宿主 vendor ESM 产出 + import map 注入（共享依赖基座）

**Files:**
- Create: `src/vendor-entry.ts`
- Create: `src/features/plugins/vite.vendor.config.ts`
- Modify: `index.html`
- Modify: `vite.config.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: 宿主已安装的 `vue`、`tdesign-vue-next`（dependencies）
- Produces: `public/vendor/vendor.mjs`（ESM，re-export `vue` 全量命名导出 + `tdesign-vue-next` 默认与命名导出）；`index.html` 中的 import map 把 `vue`、`tdesign-vue-next` 映射到 `/vendor/vendor.mjs`。宿主与插件均经此 URL 解析 → 同一实例。

- [ ] **Step 1: 创建宿主 vendor 入口**

`src/vendor-entry.ts`：
```ts
// 宿主侧 vendor 汇聚入口：把 vue 与 tdesign-vue-next 以 ESM 形式提供给 import map。
// 插件与宿主主程序都经 import map 解析这两个裸模块名，确保共享同一运行时实例。
export * from "vue";
export * from "tdesign-vue-next";
export { default as TDesign } from "tdesign-vue-next";
```

- [ ] **Step 2: 创建 vendor 库构建配置**

`src/features/plugins/vite.vendor.config.ts`：
```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

// 产出 public/vendor/vendor.mjs：将 vue + tdesign-vue-next 打包为单一 ESM，
// 供 index.html 的 import map 引用。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "../../src") },
  },
  build: {
    outDir: "public/vendor",
    emptyOutDir: true,
    target: "esnext",
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "../../src/vendor-entry.ts"),
      formats: ["es"],
      fileName: "vendor",
    },
    rollupOptions: {
      // vendor 自身须打包依赖，故不 external
      output: { entryFileNames: "vendor.mjs" },
    },
  },
});
```

- [ ] **Step 3: 在 index.html 注入 import map（置于 module 入口之前）**

`index.html`（`<head>` 内，`<link rel="icon">` 之后插入）：
```html
    <script type="importmap">
      {
        "imports": {
          "vue": "/vendor/vendor.mjs",
          "tdesign-vue-next": "/vendor/vendor.mjs"
        }
      }
    </script>
```

- [ ] **Step 4: 宿主 vite.config.ts 外部化 vue/tdesign 并排除预构建**

在 `vite.config.ts` 的 `defineConfig(() => ({ ... }))` 内：
- 顶部新增 external 判定（仅作用于最终产物；dev 经 import map 解析）：
```ts
const EXTERNAL_DEPS = ["vue", "tdesign-vue-next"];
```
- 在 `optimizeDeps` 增加 `exclude`（避免 dev 预构建 vue/tdesign，改由 import map 提供）：
```ts
  optimizeDeps: {
    exclude: ["vue", "tdesign-vue-next"],
  },
```
- 在 `build.rollupOptions.external` 增加（使宿主主包不再内联 vue/tdesign）：
```ts
    external: EXTERNAL_DEPS,
```
（保留既有 `manualChunks` 逻辑，但外部化后 vendor-vue chunk 不再被主包引用，无害。）

- [ ] **Step 5: package.json 增加构建脚本与钩子**

`package.json` scripts 内新增/修改：
```json
    "vendor:build": "vite build --config src/features/plugins/vite.vendor.config.ts",
    "predev": "pnpm run vendor:build",
    "prebuild": "pnpm run vendor:build",
```
（注意：`dev` 原命令为 `vite`；`predev` 会在 `pnpm dev` 前自动执行。）

- [ ] **Step 6: 验证 vendor 产物与 import map**

Run:
```bash
pnpm run vendor:build
ls -la public/vendor/vendor.mjs
pnpm run typecheck
```
Expected: `public/vendor/vendor.mjs` 存在；`typecheck` 通过（`vue`/`tdesign` 仍由 import map 在运行期解析，类型由 node_modules 提供，类型检查不受影响）。

- [ ] **Step 7: 提交**

```bash
git add src/vendor-entry.ts src/features/plugins/vite.vendor.config.ts index.html vite.config.ts package.json public/vendor/vendor.mjs
git commit -m "build: produce shared vue/tdesign ESM vendor and inject import map"
```

> 说明：本任务不迁移任何 voice-call 代码，仅为后续插件共享依赖打基础。若 `tdesign-vue-next` 含 `vue` 内部依赖，vendor 打包时会一并包含，插件与宿主经同一 `vendor.mjs` 解析仍共享 `vue` 实例（因为 `vue` 裸名也映射到同一文件）。

---

## Task 2: 插件包脚手架 + Vite 库构建（P0 产出 dist）

**Files:**
- Create: `plugins/voice-call/package.json`
- Create: `plugins/voice-call/vite.config.ts`
- Create: `plugins/voice-call/tsconfig.json`
- Create: `plugins/voice-call/src/manifest.ts`
- Create: `plugins/voice-call/src/index.ts`

**Interfaces:**
- Consumes: 宿主 `vue`/`tdesign-vue-next`（经 import map，插件 external 之）
- Produces: `plugins/voice-call/dist/index.js`（ESM）、`plugins/voice-call/dist/style.css`、`plugins/voice-call/dist/manifest.json`、`plugins/voice-call/dist/assets/*`。后续任务把组件迁入并让 `index.ts` 真正导出。

- [ ] **Step 1: 插件 package.json**

`plugins/voice-call/package.json`：
```json
{
  "name": "@carrypigeon/plugin-voice-call",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "exports": { ".": "./dist/index.js" }
}
```

- [ ] **Step 2: 插件 vite.config.ts（库模式 + external 共享依赖）**

`plugins/voice-call/vite.config.ts`：
```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

// 插件库构建：产出 ESM，外部化 vue/tdesign/@tauri-apps/api（经宿主 import map 共享）。
// CSS 由 Vite 自动抽取为 style.css，供宿主加载入口时 import。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "../../src") },
  },
  css: {
    preprocessorOptions: {
      scss: { api: "modern-compiler" },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["vue", "tdesign-vue-next", "@tauri-apps/api", "@tauri-apps/api/event"],
      output: {
        // 资源（图片等）落入 assets/
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "chunks/[name].js",
      },
    },
  },
});
```

- [ ] **Step 3: 插件 tsconfig.json**

`plugins/voice-call/tsconfig.json`：
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["../../src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 插件 manifest**

`plugins/voice-call/src/manifest.ts`：
```ts
export const PLUGIN_ID = "voice-call";
export const PLUGIN_VERSION = "0.1.0";

export const voiceCallManifest = {
  pluginId: PLUGIN_ID,
  version: PLUGIN_VERSION,
  entry: "index.js",
  permissions: ["invoke", "events", "ui", "storage"],
  providesDomains: ["call_record"],
} as const;
```

- [ ] **Step 5: 插件入口（P0 占位，P2 填充真实组件）**

`plugins/voice-call/src/index.ts`：
```ts
import type { Component } from "vue";
import { voiceCallManifest } from "./manifest";

export const manifest = voiceCallManifest;

// P0 占位渲染器；P2 迁入 CallRecordBubble 后替换。
const Placeholder: Component = {
  render: () => null,
};

export const renderers: Record<string, Component> = {
  call_record: Placeholder,
};

// P2 填充：注册工具栏入口、挂载浮层、订阅 voice_call:* 事件。
export function activate(_ctx: unknown): void {
  // no-op in P0
}

export function deactivate(): void {
  // no-op in P0
}
```

- [ ] **Step 6: 主程序新增插件构建脚本**

`package.json` scripts 增加：
```json
    "plugins:build:voice-call": "vite build --config plugins/voice-call/vite.config.ts"
```

- [ ] **Step 7: 构建验证 + 生成 manifest.json**

Run:
```bash
pnpm run plugins:build:voice-call
ls -la plugins/voice-call/dist
```
Expected: `dist/index.js`、`dist/style.css` 存在。

为让本地插件源直接读取，新增生成 `manifest.json` 的步骤（最小实现：构建后用 node 写出）。在 `plugins/voice-call/package.json` 增加：
```json
  "scripts": {
    "build": "vite build && node -e \"const fs=require('fs');const m=require('./src/manifest.ts');\" "
  }
```
> 因 manifest.ts 为 TS，改用构建期由 `index.ts` 导出并序列化。最简做法：在 `plugins/voice-call/vite.config.ts` 构建后通过 `closeBundle` 钩子写出 `dist/manifest.json`：
```ts
import { writeFileSync } from "node:fs";
// 在 defineConfig 返回对象 build 下追加：
onwarn() {},
// 用插件形式写出 manifest：
// （在文件顶部 import manifest 常量不便，因 vite.config 与主包类型隔离）
```
为避免 TS 配置耦合，采用独立脚本 `plugins/voice-call/scripts/write-manifest.mjs`：
```js
import { writeFileSync } from "node:fs";
import { PLUGIN_ID, PLUGIN_VERSION } from "../src/manifest.ts";
```
> 注意：`manifest.ts` 用 `export const` 且无非 TS 语法，`write-manifest.mjs` 可用 `esbuild` 转译后读取；或直接将 manifest 写一份 `manifest.json` 源文件由构建复制。最终采用：在 `plugins/voice-call/` 维护 `manifest.json` 源，构建时 `cp` 到 `dist/`，`src/manifest.ts` 从该 json 读取以保证单一真源。详见 Task 2 修订（见下“修订”）。

- [ ] **Step 8: 提交脚手架**

```bash
git add plugins/voice-call package.json
git commit -m "feat(plugins): scaffold voice-call plugin package with Vite lib build"
```

> **修订（落实 manifest 单一真源）：** 改用 `plugins/voice-call/manifest.json` 为源，`src/manifest.ts` 改为 `import manifest from "../../manifest.json"`（需 `resolveJsonModule`；tsconfig 增加 `"resolveJsonModule": true`）。构建脚本：`"build": "vite build && node scripts/copy-manifest.mjs"`，`copy-manifest.mjs` 执行 `cp manifest.json dist/manifest.json`。Step 4 改为直接维护 `manifest.json`，`manifest.ts` 仅 re-export。Step 5 的 `import { voiceCallManifest }` 来自 `./manifest`。

---

## Task 3: Host API 扩展 — invoke / onEvent / mountOverlay / registerToolbarAction

**Files:**
- Modify: `src/features/plugins/domain/types/pluginRuntimeTypes.ts`
- Create: `src/features/plugins/presentation/runtime/pluginInvokeApi.ts`
- Create: `src/features/plugins/presentation/runtime/pluginEventApi.ts`
- Create: `src/features/plugins/presentation/runtime/pluginUiApi.ts`
- Modify: `src/features/plugins/presentation/runtime/hostApiFactory.ts`
- Create: `src/features/plugins/presentation/runtime/pluginInvokeApi.test.ts`
- Create: `src/features/plugins/presentation/runtime/pluginEventApi.test.ts`

**Interfaces:**
- Consumes: 宿主 `invokeTauri`（`@/shared/tauri`）、Tauri `listen`（`@tauri-apps/api/event`）、chat UI 桥（Task 4 提供 `mountOverlay`/`registerToolbarAction`）
- Produces:
  - `createPluginInvokeApi(serverSocket, pluginId, allowedPrefix): (command, args?) => Promise<unknown>` — 仅当命令以 `allowedPrefix` 开头时调用 `invokeTauri`，否则抛错
  - `createPluginEventApi(serverSocket, allowedPrefix): (event, handler) => () => void` — 仅白名单事件订阅，返回 unlisten（包 Tauri `listen`）
  - `createPluginUiApi(ui): { mountOverlay, registerToolbarAction }` — `ui` 来自 chat UI 桥
  - `PluginContext.host` 新增可选字段：`invoke?`、`onEvent?`、`mountOverlay?`、`registerToolbarAction?`

- [ ] **Step 1: 扩展 PluginContext 类型**

在 `pluginRuntimeTypes.ts` 的 `PluginContext` 的 `host` 对象内（`network?` 之后）增加：
```ts
    /** 泛型命令调用（权限 + 命令白名单，建议前缀 voice_call:*） */
    invoke?: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
    /** 订阅宿主 Tauri 事件（权限 + 事件白名单），返回取消函数 */
    onEvent?: <T = unknown>(event: string, handler: (payload: T) => void) => () => void;
    /** 挂载全局浮层组件，返回卸载函数 */
    mountOverlay?: (component: Component, opts?: { zIndex?: number }) => () => void;
    /** 注册聊天头部/工具栏入口，返回注销函数 */
    registerToolbarAction?: (action: {
      id: string;
      label: string;
      icon?: Component;
      order?: number;
      onClick: () => void;
    }) => () => void;
```

- [ ] **Step 2: createPluginInvokeApi**

`src/features/plugins/presentation/runtime/pluginInvokeApi.ts`：
```ts
import { invokeTauri } from "@/shared/tauri";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";

/**
 * 创建受白名单约束的插件命令调用能力。
 * @param allowedPrefix 命令白名单前缀（如 "voice_call:"）
 */
export function createPluginInvokeApi(
  serverSocket: string,
  pluginId: string,
  allowedPrefix: string,
): (command: string, args?: Record<string, unknown>) => Promise<unknown> {
  return async (command: string, args?: Record<string, unknown>) => {
    if (!command.startsWith(allowedPrefix)) {
      throw new Error(
        `plugin ${pluginId} invoke denied: command "${command}" not under "${allowedPrefix}"`,
      );
    }
    return invokeTauri<unknown>(command as keyof typeof TAURI_COMMANDS, {
      ...(args ?? {}),
      serverSocket,
    } as never);
  };
}
```
> 注：`TAURI_COMMANDS` 为命令名→字符串映射；`invokeTauri` 第一参为命令 key。若 `voice_call:*` 命令未在 `TAURI_COMMANDS` 枚举，需确认 `invokeTauri` 是否支持任意字符串命令。若 `invokeTauri` 强类型约束命令 key，则此处改为 `invoke(command, {...})` 直接使用 `@tauri-apps/api` 的 `invoke`（见 Task 3 修订）。

- [ ] **Step 3: createPluginEventApi**

`src/features/plugins/presentation/runtime/pluginEventApi.ts`：
```ts
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * 创建受白名单约束的插件事件订阅能力。
 * @param allowedPrefix 事件白名单前缀（如 "voice_call:"）
 */
export function createPluginEventApi(
  allowedPrefix: string,
): <T = unknown>(event: string, handler: (payload: T) => void) => () => void {
  return <T = unknown>(event: string, handler: (payload: T) => void): (() => void) => {
    if (!event.startsWith(allowedPrefix)) {
      throw new Error(`plugin event subscribe denied: "${event}" not under "${allowedPrefix}"`);
    }
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;
    listen<T>(event, (e) => handler(e.payload)).then((fn) => {
      unlisten = fn;
      if (cancelled) unlisten();
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  };
}
```

- [ ] **Step 4: createPluginUiApi**

`src/features/plugins/presentation/runtime/pluginUiApi.ts`：
```ts
import type { Component } from "vue";

export type PluginUiBridge = {
  mountOverlay(component: Component, opts?: { zIndex?: number }): () => void;
  registerToolbarAction(action: {
    id: string;
    label: string;
    icon?: Component;
    order?: number;
    onClick: () => void;
  }): () => void;
};

export function createPluginUiApi(ui: PluginUiBridge) {
  return {
    mountOverlay: (component: Component, opts?: { zIndex?: number }) => ui.mountOverlay(component, opts),
    registerToolbarAction: (
      action: Parameters<PluginUiBridge["registerToolbarAction"]>[0],
    ) => ui.registerToolbarAction(action),
  };
}
```

- [ ] **Step 5: 在 hostApiFactory 组装**

`hostApiFactory.ts` 顶部 import 新增三个工厂；在导出的 host 对象构造处（现有返回 `host` 处）增加条件注入：
```ts
import { createPluginInvokeApi } from "./pluginInvokeApi";
import { createPluginEventApi } from "./pluginEventApi";
import { createPluginUiApi, type PluginUiBridge } from "./pluginUiApi";

export function createHostApi(
  serverSocket: string,
  pluginId: string,
  permissions: string[],
  uiBridge?: PluginUiBridge,
): PluginContext["host"] {
  const host: PluginContext["host"] = {
    sendMessage, // 既有
    storage: createPluginStorageApi(serverSocket, pluginId),
    // network 既有逻辑保留
  };
  if (permissions.includes("invoke")) {
    host.invoke = createPluginInvokeApi(serverSocket, pluginId, "voice_call:") as never;
  }
  if (permissions.includes("events")) {
    host.onEvent = createPluginEventApi("voice_call:") as never;
  }
  if (permissions.includes("ui") && uiBridge) {
    const ui = createPluginUiApi(uiBridge);
    host.mountOverlay = ui.mountOverlay as never;
    host.registerToolbarAction = ui.registerToolbarAction as never;
  }
  return host;
}
```
> 若 `hostApiFactory.ts` 现有导出形态为多个独立 `create*Api` 而非单一 `createHostApi`，则在 `pluginRuntime.ts`/`domainRegistryModuleLoader.ts` 构造 ctx 时按需拼装（Task 5 落实）。

- [ ] **Step 6: 单元测试 — invoke 白名单**

`src/features/plugins/presentation/runtime/pluginInvokeApi.test.ts`：
```ts
import { describe, it, expect, vi } from "vitest";

// 用 vi.mock 隔离 invokeTauri
vi.mock("@/shared/tauri", () => ({
  invokeTauri: vi.fn(async () => ({ ok: true })),
  TAURI_COMMANDS: {} as Record<string, string>,
}));

import { createPluginInvokeApi } from "./pluginInvokeApi";

describe("createPluginInvokeApi", () => {
  it("允许白名单前缀命令", async () => {
    const invoke = createPluginInvokeApi("s", "p", "voice_call:");
    await expect(invoke("voice_call:start", { a: 1 })).resolves.toBeDefined();
  });
  it("拒绝非白名单命令", async () => {
    const invoke = createPluginInvokeApi("s", "p", "voice_call:");
    await expect(invoke("chat:send", {})).rejects.toThrow(/denied/);
  });
});
```

- [ ] **Step 7: 单元测试 — onEvent 白名单**

`src/features/plugins/presentation/runtime/pluginEventApi.test.ts`：
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

import { createPluginEventApi } from "./pluginEventApi";

describe("createPluginEventApi", () => {
  it("拒绝非白名单事件", () => {
    const onEvent = createPluginEventApi("voice_call:");
    expect(() => onEvent("other:event", () => {})).toThrow(/denied/);
  });
  it("允许白名单事件并返回取消函数", () => {
    const onEvent = createPluginEventApi("voice_call:");
    const off = onEvent("voice_call:incoming", () => {});
    expect(typeof off).toBe("function");
  });
});
```

- [ ] **Step 8: 运行测试 + typecheck**

Run:
```bash
pnpm test src/features/plugins/presentation/runtime/pluginInvokeApi.test.ts src/features/plugins/presentation/runtime/pluginEventApi.test.ts
pnpm run typecheck
```
Expected: 测试 PASS；typecheck 通过。

- [ ] **Step 9: 提交**

```bash
git add src/features/plugins/domain/types/pluginRuntimeTypes.ts \
  src/features/plugins/presentation/runtime/pluginInvokeApi.ts \
  src/features/plugins/presentation/runtime/pluginEventApi.ts \
  src/features/plugins/presentation/runtime/pluginUiApi.ts \
  src/features/plugins/presentation/runtime/hostApiFactory.ts \
  src/features/plugins/presentation/runtime/pluginInvokeApi.test.ts \
  src/features/plugins/presentation/runtime/pluginEventApi.test.ts
git commit -m "feat(plugins): extend Host API with invoke/onEvent/ui mounting (allowlist-gated)"
```

> **Task 3 修订说明：** 若 `invokeTauri` 第二参类型强制 `TAURI_COMMANDS` key，则 `pluginInvokeApi.ts` 改为：
> ```ts
> import { invoke } from "@tauri-apps/api/core";
> // ...
> return invoke<unknown>(command, { ...(args ?? {}), serverSocket } as Record<string, unknown>);
> ```
> 并在 `vite.config.ts` 的 `external` 增加 `@tauri-apps/api/core`（或保持 `@tauri-apps/api` 外部即可）。实施时先确认 `src/shared/tauri/invokeTauri` 签名。

---

## Task 4: 宿主 chat UI 桥 — 浮层槽与工具栏入口槽

**Files:**
- Create: `src/features/plugins/presentation/components/PluginOverlayHost.vue`
- Create: `src/features/plugins/presentation/components/PluginToolbarSlot.vue`
- Create: `src/features/chat/presentation/plugins/chatPluginUiBridge.ts`
- Modify: `src/features/chat/data/plugins/chatPluginRuntime.ts`
- Modify: `src/features/chat/presentation/patchbay/components/layout/ChatCenter.vue`

**Interfaces:**
- Consumes: `PluginContext.host.mountOverlay`/`registerToolbarAction`（Task 3 定义）；`Component` 类型
- Produces:
  - `PluginOverlayHost.vue`：全局浮层容器，对外暴露 `mount(component)/unmount()` 方法（经 `defineExpose` 或 provide 注入的响应式列表）
  - `PluginToolbarSlot.vue`：渲染已注册的工具栏动作列表（`<t-button>`/图标 + 文案 + onClick）
  - `chatPluginUiBridge`：实现 `PluginUiBridge`，把 `mountOverlay` 委托给 `PluginOverlayHost`，`registerToolbarAction` 委托给 `PluginToolbarSlot` 的响应式 store
  - `attachChatPluginHostBridge` 额外暴露 `uiBridge` 给插件运行时（供 Task 5 注入 ctx）

- [ ] **Step 1: PluginOverlayHost.vue**

`src/features/plugins/presentation/components/PluginOverlayHost.vue`：
```vue
<script setup lang="ts">
import { reactive } from "vue";
import type { Component } from "vue";

// 全局浮层容器：插件经 host.mountOverlay 注册组件，此处统一渲染。
type OverlayEntry = { id: number; component: Component; zIndex: number };
const overlays = reactive<OverlayEntry[]>([]);
let seq = 0;

function mount(component: Component, opts?: { zIndex?: number }): () => void {
  const id = ++seq;
  overlays.push({ id, component, zIndex: opts?.zIndex ?? 1000 });
  return () => {
    const i = overlays.findIndex((o) => o.id === id);
    if (i >= 0) overlays.splice(i, 1);
  };
}

defineExpose({ mount });
</script>

<template>
  <div class="plugin-overlay-root">
    <div
      v-for="o in overlays"
      :key="o.id"
      class="plugin-overlay-layer"
      :style="{ zIndex: o.zIndex }"
    >
      <component :is="o.component" />
    </div>
  </div>
</template>

<style scoped>
.plugin-overlay-root { position: fixed; inset: 0; pointer-events: none; }
.plugin-overlay-layer { position: absolute; inset: 0; pointer-events: auto; }
</style>
```

- [ ] **Step 2: PluginToolbarSlot.vue**

`src/features/plugins/presentation/components/PluginToolbarSlot.vue`：
```vue
<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";

export type ToolbarAction = {
  id: string;
  label: string;
  icon?: Component;
  order?: number;
  onClick: () => void;
};

const props = defineProps<{ actions: ToolbarAction[] }>();
const sorted = computed(() =>
  [...props.actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
);
</script>

<template>
  <span class="plugin-toolbar-slot">
    <t-button
      v-for="a in sorted"
      :key="a.id"
      size="small"
      variant="outline"
      @click="a.onClick"
    >
      <template v-if="a.icon" #icon><component :is="a.icon" /></template>
      {{ a.label }}
    </t-button>
  </span>
</template>

<style scoped>
.plugin-toolbar-slot { display: inline-flex; gap: 8px; align-items: center; }
</style>
```

- [ ] **Step 3: chat UI 桥**

`src/features/chat/presentation/plugins/chatPluginUiBridge.ts`：
```ts
import type { Component } from "vue";
import type { PluginUiBridge } from "@/features/plugins/presentation/runtime/pluginUiApi";
import type { ToolbarAction } from "@/features/plugins/presentation/components/PluginToolbarSlot.vue";

// 工具栏动作响应式列表：PluginToolbarSlot 渲染它。
export const toolbarActions = reactive<ToolbarAction[]>([]);

// 浮层挂载函数由 PluginOverlayHost 的 expose.mount 在运行时注入。
let overlayMount: ((c: Component, opts?: { zIndex?: number }) => () => void) | null = null;
export function bindOverlayMount(fn: (c: Component, opts?: { zIndex?: number }) => () => void): void {
  overlayMount = fn;
}

export const chatPluginUiBridge: PluginUiBridge = {
  mountOverlay(component, opts) {
    if (!overlayMount) {
      console.warn("[chatPluginUiBridge] overlay host not ready");
      return () => {};
    }
    return overlayMount(component, opts);
  },
  registerToolbarAction(action) {
    toolbarActions.push(action);
    const id = action.id;
    return () => {
      const i = toolbarActions.findIndex((a) => a.id === id);
      if (i >= 0) toolbarActions.splice(i, 1);
    };
  },
};
```
> `reactive` 需 `import { reactive } from "vue"`。

- [ ] **Step 4: 在 chatPluginRuntime 暴露 uiBridge**

`src/features/chat/data/plugins/chatPluginRuntime.ts` 增加导出：
```ts
export { chatPluginUiBridge, toolbarActions, bindOverlayMount } from "@/features/chat/presentation/plugins/chatPluginUiBridge";
```

- [ ] **Step 5: ChatCenter 用通用挂载点替换硬挂载**

`src/features/chat/presentation/patchbay/components/layout/ChatCenter.vue`：
- 移除 `<script setup>` 中对 `VoiceCallTrigger`/`VoiceCallHost` 的 import 与模板中的 `<VoiceCallTrigger .../>`（约 485 行）与 `<VoiceCallHost .../>`（约 529 行）。
- 在 `<script setup>` 引入：
```ts
import PluginOverlayHost from "@/features/plugins/presentation/components/PluginOverlayHost.vue";
import PluginToolbarSlot from "@/features/plugins/presentation/components/PluginToolbarSlot.vue";
import { toolbarActions, bindOverlayMount } from "@/features/chat/presentation/plugins/chatPluginUiBridge";
import { ref, onMounted } from "vue";
```
- 模板头部（原 VoiceCallTrigger 位置）改为：
```vue
<PluginToolbarSlot :actions="toolbarActions" />
```
- 模板底部（原 VoiceCallHost 位置）改为：
```vue
<PluginOverlayHost ref="overlayHostRef" />
```
- `<script setup>` 内绑定 overlay 挂载：
```ts
const overlayHostRef = ref<InstanceType<typeof PluginOverlayHost> | null>(null);
onMounted(() => {
  if (overlayHostRef.value) bindOverlayMount(overlayHostRef.value.mount);
});
```

- [ ] **Step 6: typecheck**

Run: `pnpm run typecheck`
Expected: PASS（无 VoiceCallTrigger/VoiceCallHost 引用残留）。

- [ ] **Step 7: 提交**

```bash
git add src/features/plugins/presentation/components/PluginOverlayHost.vue \
  src/features/plugins/presentation/components/PluginToolbarSlot.vue \
  src/features/chat/presentation/plugins/chatPluginUiBridge.ts \
  src/features/chat/data/plugins/chatPluginRuntime.ts \
  src/features/chat/presentation/patchbay/components/layout/ChatCenter.vue
git commit -m "feat(plugins): add generic plugin overlay/toolbar mount points in chat"
```

---

## Task 5: 插件运行时加载后调用 activate / 卸载调用 deactivate，并注入 UI 桥

**Files:**
- Modify: `src/features/plugins/presentation/runtime/pluginRuntime.ts`
- Modify: `src/features/plugins/presentation/store/domainRegistryModuleLoader.ts`
- Modify: `src/features/plugins/presentation/runtime/hostApiFactory.ts`（若 Task 3 未统一 `createHostApi`）

**Interfaces:**
- Consumes: `normalizePluginModule`（已存在）、`createHostApi`（Task 3）、`chatPluginUiBridge`（Task 4）、`LoadedPluginModule.activate`/`deactivate`
- Produces: 插件加载完成后调用 `module.activate(ctx)`；卸载/禁用时调用 `module.deactivate()`；`ctx.host` 包含 `invoke`/`onEvent`/`mountOverlay`/`registerToolbarAction`（按权限 + uiBridge 注入）

- [ ] **Step 1: domainRegistryModuleLoader 构造 ctx 并调用 activate**

在 `domainRegistryModuleLoader.ts` 加载模块、调用 `normalizePluginModule` 之后，构造 `ctx` 并激活：
```ts
import { createHostApi } from "@/features/plugins/presentation/runtime/hostApiFactory";
import { chatPluginUiBridge } from "@/features/chat/presentation/plugins/chatPluginUiBridge";

// 假定已有：serverSocket, serverId, pluginId, pluginVersion, cid, uid, lang, runtimeEntry, mod
const host = createHostApi(serverSocket, pluginId, runtimeEntry.permissions ?? [], chatPluginUiBridge);
const ctx = { serverSocket, serverId, pluginId, pluginVersion, cid, uid, lang, host };
const loaded = normalizePluginModule(pluginId, pluginVersion, runtimeEntry, mod);
if (typeof loaded.activate === "function") {
  loaded.activate(ctx);
}
// 记录 loaded 以便后续 deactivate（存入运行时状态/map）
runtimeRegistry.set(pluginId, loaded);
```
卸载逻辑：
```ts
const loaded = runtimeRegistry.get(pluginId);
if (loaded && typeof loaded.deactivate === "function") loaded.deactivate();
runtimeRegistry.delete(pluginId);
```

- [ ] **Step 2: 确认 pluginRuntime.ts 透传 activate/deactivate**

`pluginRuntime.ts` 的 `LoadedPluginModule` 已含 `activate?`/`deactivate?`；无需改动，仅需确保 `normalizePluginModule` 已赋值（已赋值）。若 `domainRegistryModuleLoader` 直接调用 `importPluginModule`+`normalizePluginModule`，则在 Task 5 Step 1 处接入 activate。

- [ ] **Step 3: typecheck + 单元自测（可选）**

Run: `pnpm run typecheck`
Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add src/features/plugins/presentation/store/domainRegistryModuleLoader.ts \
  src/features/plugins/presentation/runtime/pluginRuntime.ts \
  src/features/plugins/presentation/runtime/hostApiFactory.ts
git commit -m "feat(plugins): wire activate/deactivate and inject UI bridge into plugin ctx"
```

---

## Task 6: 迁移 voice-call 组件到插件包，并接 bridge（host.invoke / onEvent）

**Files:**
- Move: `src/features/chat/voice-call/presentation/components/*` → `plugins/voice-call/src/components/`
- Create: `plugins/voice-call/src/host/bridge.ts`
- Modify: 迁入组件的 import（相对化 + 替换 tauriVoiceCallApi / listen）

**Interfaces:**
- Consumes: `PluginContext`（Task 3 类型）、`host.invoke`/`host.onEvent`（Task 3）
- Produces: `bridge.ts` 提供 `bindContext(ctx)`、`invokeVoiceCall(cmd, args?)`、`onVoiceCallEvent(evt, handler)`；各组件经 bridge 调后端、订阅事件，不再直接 `invokeTauri`/`listen`。

- [ ] **Step 1: 移动组件目录**

Run:
```bash
git mv src/features/chat/voice-call/presentation/components plugins/voice-call/src/components
```
（若 `git mv` 因未跟踪报错，用 `mkdir -p plugins/voice-call/src && mv src/features/chat/voice-call/presentation/components plugins/voice-call/src/components` 并提交新增/删除。）

- [ ] **Step 2: 创建 host/bridge.ts**

`plugins/voice-call/src/host/bridge.ts`：
```ts
import type { PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";

let ctx: PluginContext | null = null;

export function bindContext(c: PluginContext): void {
  ctx = c;
}

export function getContext(): PluginContext {
  if (!ctx) throw new Error("voice-call plugin context not bound");
  return ctx;
}

/** 调宿主原生 voice_call 后端命令（host.invoke 已按 voice_call:* 白名单校验）。 */
export function invokeVoiceCall(command: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!ctx?.host.invoke) throw new Error("host.invoke not available");
  return ctx.host.invoke(command, args);
}

/** 订阅 voice_call:* 后端事件。 */
export function onVoiceCallEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): () => void {
  if (!ctx?.host.onEvent) throw new Error("host.onEvent not available");
  return ctx.host.onEvent<T>(event, handler);
}
```

- [ ] **Step 3: 改写组件内部依赖（统一规则）**

对每个迁入组件（`.vue`）：
1. 将 `@/features/chat/voice-call/...` 内部 import 改为相对于 `plugins/voice-call/src/` 的路径（如 `../composables/useVoiceCall`、`../domain/contracts`）。
2. 将 `import { ... } from "@/features/chat/voice-call/.../tauriVoiceCallApi"` 或任何直接 `invokeTauri(...)` 调用，改为 `import { invokeVoiceCall } from "../host/bridge"` 并调用 `invokeVoiceCall("voice_call:xxx", {...})`。
3. 将 `import { listen } from "@tauri-apps/api/event"; listen("voice_call:incoming", ...)` 改为 `import { onVoiceCallEvent } from "../host/bridge"; onVoiceCallEvent("voice_call:incoming", ...)`。
4. 组件内用到的宿主专有 `@/shared/...` 工具（如特定类型、常量），若插件无法访问，则改为在插件内本地定义等价类型/常量，或经 `host` 能力获取。
5. `VoiceCallHost.vue` 当前用 `listen("voice_call:incoming"|"voice_call:state_change"|"voice_call:video_signaling")` 与 `tauriVoiceCallApi` —— 全部走 bridge。

- [ ] **Step 4: 构建插件并修复未解析 import**

Run:
```bash
pnpm run plugins:build:voice-call
```
Expected: 构建成功；若有未解析模块，按报错把对应宿主内部依赖改为插件内本地实现或 bridge 调用，迭代直至 `dist/index.js` 产出。

- [ ] **Step 5: 提交**

```bash
git add plugins/voice-call/src/components plugins/voice-call/src/host
git commit -m "feat(voice-call-plugin): migrate components and wire host bridge"
```

---

## Task 7: 迁移 composables / domain / runtime / i18n 到插件包

**Files:**
- Move: `src/features/chat/voice-call/composition/*` → `plugins/voice-call/src/composables/`
- Move: `src/features/chat/voice-call/domain/*` → `plugins/voice-call/src/domain/`
- Move: `src/features/chat/voice-call/presentation/runtime/*` → `plugins/voice-call/src/runtime/`
- Create: `plugins/voice-call/src/i18n/messages.ts`（抽出 voice-call 文案）
- Modify: 上述迁入文件内部 import（相对化 + 经 bridge 调后端/事件）

**Interfaces:**
- Consumes: `bridge.ts`（Task 6）、`vue-i18n`（插件内自建 i18n 实例或本地字典）
- Produces: 自包含的插件逻辑；`useVoiceCall`/`useVideoCall`/`useRingtone`/`useScreenShare` 经 bridge 工作；`voiceCallState`/`voiceCallRuntimePorts` 作为插件本地状态。

- [ ] **Step 1: 移动目录**

Run:
```bash
git mv src/features/chat/voice-call/composition plugins/voice-call/src/composables
git mv src/features/chat/voice-call/domain plugins/voice-call/src/domain
git mv src/features/chat/voice-call/presentation/runtime plugins/voice-call/src/runtime
```

- [ ] **Step 2: 抽出 i18n 文案**

从 `src/app/i18n/messages/zh_cn.ts` 与 `en_us.ts` 中复制 voice-call 相关 key（如 `voiceCall.*`、`call.*`、`videoCall.*`）到 `plugins/voice-call/src/i18n/messages.ts`：
```ts
export const voiceCallMessages = {
  "zh_cn": {
    "voiceCall.start": "发起通话",
    "voiceCall.accept": "接听",
    "voiceCall.hangup": "挂断",
    "voiceCall.mute": "静音",
    "voiceCall.video": "视频",
    "voiceCall.incoming": "来电",
    // ... 其余 key 保持与原主程序一致
  },
  "en_us": {
    "voiceCall.start": "Start Call",
    "voiceCall.accept": "Accept",
    "voiceCall.hangup": "Hang Up",
    "voiceCall.mute": "Mute",
    "voiceCall.video": "Video",
    "voiceCall.incoming": "Incoming Call",
    // ...
  },
};
```
插件内用 `ctx.lang` 取对应语言字典实现一个轻量 `t(key)`（避免与主程序 i18n 实例耦合）。

- [ ] **Step 3: 改写 composables/domain/runtime 内部依赖**

规则同 Task 6 Step 3：内部 `@/features/chat/voice-call/...` → 相对路径；直接 `invokeTauri`/`listen` → `bridge`；宿主专有 `@/shared/...` → 插件内本地等价实现或 bridge。

- [ ] **Step 4: 构建验证**

Run:
```bash
pnpm run plugins:build:voice-call
```
Expected: 成功产出 `dist/index.js`；无未解析模块。

- [ ] **Step 5: 提交**

```bash
git add plugins/voice-call/src/composables plugins/voice-call/src/domain plugins/voice-call/src/runtime plugins/voice-call/src/i18n
git commit -m "feat(voice-call-plugin): migrate composables/domain/runtime/i18n"
```

---

## Task 8: 插件入口真实导出 + activate/deactivate 实现

**Files:**
- Modify: `plugins/voice-call/src/index.ts`

**Interfaces:**
- Consumes: `bridge.bindContext`、`VoiceCallHost`（components）、`CallRecordBubble`（components）、`voiceCallMessages`（Task 7）、`PluginContext`
- Produces: `activate(ctx)` 绑定 ctx、注册工具栏「发起通话」、挂载 `VoiceCallHost` 浮层、订阅 `voice_call:*` 事件；`deactivate()` 清理。

- [ ] **Step 1: 实现 index.ts**

`plugins/voice-call/src/index.ts`：
```ts
import type { Component } from "vue";
import type { PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";
import { voiceCallManifest } from "./manifest";
import { bindContext, onVoiceCallEvent } from "./host/bridge";
import { voiceCallMessages } from "./i18n/messages";
import VoiceCallHost from "./components/VoiceCallHost.vue";
import CallRecordBubble from "./components/CallRecordBubble.vue";

export const manifest = voiceCallManifest;

export const renderers: Record<string, Component> = {
  call_record: CallRecordBubble,
};

let cleanup: (() => void) | null = null;

function t(lang: string, key: string): string {
  const dict = (voiceCallMessages as Record<string, Record<string, string>>)[lang] ?? voiceCallMessages.zh_cn;
  return dict[key] ?? key;
}

export function activate(ctx: PluginContext): void {
  bindContext(ctx);
  const lang = ctx.lang || "zh_cn";

  const detach = ctx.host.registerToolbarAction?.({
    id: "voice-call.start",
    label: t(lang, "voiceCall.start"),
    order: 50,
    onClick: () => {
      // 发起通话流程：实际参数（target/room）由 chat 上下文提供；此处走 bridge 调后端。
      void ctx.host.invoke?.("voice_call:start_direct_call", {
        sessionId: `local-${Date.now()}`,
        targetUserId: "",
        roomId: "",
      });
    },
  }) ?? (() => {});

  const unmount = ctx.host.mountOverlay?.(VoiceCallHost) ?? (() => {});

  const offIncoming = onVoiceCallEvent("voice_call:incoming", (p) => {
    // 由 VoiceCallHost 内部状态机消费；此处仅确保订阅建立
    void p;
  });
  const offState = onVoiceCallEvent("voice_call:state_change", () => {});
  const offVideo = onVoiceCallEvent("voice_call:video_signaling", () => {});

  cleanup = () => {
    detach();
    unmount();
    offIncoming();
    offState();
    offVideo();
  };
}

export function deactivate(): void {
  cleanup?.();
  cleanup = null;
}
```

- [ ] **Step 2: 构建验证**

Run:
```bash
pnpm run plugins:build:voice-call
ls plugins/voice-call/dist
```
Expected: `dist/index.js`、`dist/style.css`、`dist/manifest.json`（见 Task 2 修订）、`dist/assets/*` 存在。

- [ ] **Step 3: 提交**

```bash
git add plugins/voice-call/src/index.ts
git commit -m "feat(voice-call-plu

gin): implement activate/deactivate with toolbar/overlay/events"
```

---

## Task 9: chat 消息列表按 domain 渲染 call_record（通用渲染器槽）

**Files:**
- Modify: `src/features/chat/presentation/...`（消息气泡渲染组件，定位 call_record 渲染点）
- Create（若缺失）: `src/features/plugins/presentation/components/PluginMessageRenderer.vue`

**Interfaces:**
- Consumes: 插件 `renderers.call_record`（Task 8）、宿主 domain registry 运行时
- Produces: 当消息 `domain === "call_record"` 时渲染插件提供的 `CallRecordBubble`；非插件 domain 走原渲染逻辑。

- [ ] **Step 1: 定位消息渲染点**

在 chat 消息列表组件中搜索渲染「通话记录」消息的逻辑（原 `CallRecordBubble` 使用处）；确认是否存在按 `domain` 取插件渲染器的通用路径。若 chat 已通过 domain registry 渲染插件消息 domain，则 `providesDomains: ["call_record"]` 下自动生效，无需改动。

- [ ] **Step 2: 若无通用路径，新增 PluginMessageRenderer**

`src/features/plugins/presentation/components/PluginMessageRenderer.vue`：
```vue
<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import { getChatDomainRegistryView } from "@/features/chat/data/plugins/chatPluginRuntime";

const props = defineProps<{ domain: string; serverSocket: string; payload: unknown }>();
const view = getChatDomainRegistryView(props.serverSocket);
const renderer = computed<Component | null>(() => {
  const map = (view.value?.renderers ?? {}) as Record<string, Component>;
  return map[props.domain] ?? null;
});
</script>

<template>
  <component :is="renderer" v-if="renderer" :payload="payload" />
  <slot v-else />
</template>
```

- [ ] **Step 3: typecheck**

Run: `pnpm run typecheck`
Expected: PASS。

- [ ] **Step 4: 提交**

```bash
git add src/features/plugins/presentation/components/PluginMessageRenderer.vue \
  src/features/chat/presentation/...（被修改的消息组件）
git commit -m "feat(chat): render call_record via plugin-provided domain renderer"
```

---

## Task 10: 本地插件源直接加载 dist（开发期）

**Files:**
- Create: `scripts/copy-plugin-dist.mjs`
- Create: `src/features/plugins/data/localPluginSource.ts`
- Modify: `package.json`（新增 `plugins:dev:link` 脚本）
- Modify: 插件运行时在 dev 下优先使用本地源（env `VITE_USE_LOCAL_VOICE_CALL_PLUGIN`）

**Interfaces:**
- Consumes: `plugins/voice-call/dist`（Task 8 产出）、`PluginRuntimeEntry` 类型
- Produces: dev 下宿主把 `voice-call` 视为已安装插件，entry 指向 `plugins/voice-call/index.js`（经 `public/plugins/voice-call/` 静态服务）。

- [ ] **Step 1: 复制 dist 到 public 供 dev 服务**

`scripts/copy-plugin-dist.mjs`：
```js
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../");
const src = resolve(root, "plugins/voice-call/dist");
const dest = resolve(root, "public/plugins/voice-call");
if (!existsSync(src)) {
  console.error("[copy-plugin-dist] plugins/voice-call/dist not found; run pnpm plugins:build:voice-call first");
  process.exit(1);
}
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-plugin-dist] copied", src, "->", dest);
```

- [ ] **Step 2: 新增 npm 脚本**

`package.json` scripts：
```json
    "plugins:dev:link": "node scripts/copy-plugin-dist.mjs",
    "predev": "pnpm run vendor:build && pnpm run plugins:build:voice-call && pnpm run plugins:dev:link"
```

- [ ] **Step 3: 本地插件源**

`src/features/plugins/data/localPluginSource.ts`：
```ts
import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";

const PLUGIN_ID = "voice-call";
const VERSION = "0.1.0";

/** 开发期本地插件源：直接指向已复制到 public/plugins/voice-call 的构建产物。 */
export function getLocalVoiceCallRuntimeEntry(serverId: string): PluginRuntimeEntry {
  return {
    serverId,
    pluginId: PLUGIN_ID,
    version: VERSION,
    entry: "plugins/voice-call/index.js",
    permissions: ["invoke", "events", "ui", "storage"],
    providesDomains: [{ domain: "call_record", domainVersion: "1" }],
    minHostVersion: "0.0.0",
  };
}

export const USE_LOCAL_VOICE_CALL_PLUGIN =
  import.meta.env.VITE_USE_LOCAL_VOICE_CALL_PLUGIN === "true";
```

- [ ] **Step 4: 运行时在 dev 下优先本地源**

在 `runtimeGateway.getRuntimeEntry` / 模块加载入口处增加（保持 `IS_STORE_MOCK`/`USE_MOCK_TRANSPORT` 既有分支不变）：
```ts
if (USE_LOCAL_VOICE_CALL_PLUGIN && pluginId === "voice-call") {
  return Promise.resolve(getLocalVoiceCallRuntimeEntry(serverId));
}
```

- [ ] **Step 5: 验证 dev 加载**

Run:
```bash
pnpm dev
```
Expected: 宿主启动；无 `plugins/voice-call/index.js` 404；聊天头部出现「发起通话」按钮；点击触发工具栏动作（后端调用受 `host.invoke` 白名单约束）。

- [ ] **Step 6: 提交**

```bash
git add scripts/copy-plugin-dist.mjs src/features/plugins/data/localPluginSource.ts package.json \
  src/features/plugins/presentation/runtime/runtimeGateway.ts
git commit -m "feat(plugins): add local dev plugin source loading voice-call dist"
```

---

## Task 11: 清理主程序内建 voice-call feature

**Files:**
- Delete: `src/features/chat/voice-call/`（剩余未迁移目录：api.ts、api-types.ts、capability-source.ts、internal.ts、mock、README.md 等）
- Modify: `src/app/i18n/messages/zh_cn.ts`、`en_us.ts`（移除 voice-call 相关 key，已迁入插件）
- Modify: 主程序中对 voice-call 的 api/router/capability 引用（若有）
- Modify: `scripts/check-feature-boundaries.sh` 边界（若需）

**Interfaces:**
- Consumes: 插件已承担全部 voice-call 能力（Task 6–10）
- Produces: 主程序不再含 `src/features/chat/voice-call/`；chat UI 无 voice-call 硬挂载（Task 4 已完成）；i18n 无重复 key。

- [ ] **Step 1: 删除残留 voice-call feature 目录**

Run:
```bash
git rm -r src/features/chat/voice-call
```

- [ ] **Step 2: 清理 i18n 重复 key**

从 `src/app/i18n/messages/zh_cn.ts`、`en_us.ts` 删除已迁入 `plugins/voice-call/src/i18n/messages.ts` 的 voice-call key（保留主程序其他 key 不变）。

- [ ] **Step 3: 清理主程序引用**

全局搜索 `voice-call`（排除 `plugins/voice-call`、`.git`、构建产物）：
```bash
grep -rn "voice-call" src --include="*.ts" --include="*.vue" | grep -v "plugins/voice-call" | grep -v node_modules
```
逐个移除/改写指向 `src/features/chat/voice-call` 的 import 与调用（应为空或仅剩插件相关引用）。

- [ ] **Step 4: 运行 lint 与边界检查**

Run:
```bash
pnpm run typecheck
pnpm run lint
```
（Windows 下经 Git Bash：`bash scripts/check-feature-boundaries.sh`）
Expected: typecheck 通过；feature boundary 无 voice-call 违规；lint 通过。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor: remove built-in voice-call feature from main app (now a plugin)"
```

---

## Task 12: 端到端验证（三类通话流程）

**Files:** 无新增代码；验证步骤。

**Interfaces:**
- Consumes: 全部前序任务产物

- [ ] **Step 1: 类型与 lint 全量**

Run:
```bash
pnpm run typecheck
pnpm run lint
pnpm run test
```
Expected: 全部 PASS（`test` 至少覆盖 Task 3 的 invoke/onEvent 单测）。

- [ ] **Step 2: 构建插件 + 宿主**

Run:
```bash
pnpm run plugins:build:voice-call
pnpm run build
```
Expected: 宿主构建成功；插件 `dist` 产出。

- [ ] **Step 3: tauri dev 手动验证（1:1 / 会议 / 视频）**

Run:
```bash
pnpm run tauri dev
```
手动验证（需连接支持 voice_call 信令的服务器）：
1. 聊天头部出现「发起通话」按钮（工具栏入口由插件注册）。
2. 点击发起 → 浮层 `VoiceCallHost` 挂载，调用 `voice_call:start_direct_call`（经 `host.invoke`）。
3. 模拟/真实来电：`voice_call:incoming` 经 `host.onEvent` 驱动浮层与来电横幅。
4. 接听/挂断/静音/噪声抑制/设备切换命令经 `host.invoke` 调用后端。
5. 多人会议：`start_conference`/`join_conference`/`leave_conference` 流程。
6. 视频通话：`send_video_signaling` 经 `host.invoke`，视频网格渲染正常。
7. `call_record` 消息经插件 `renderers.call_record` 渲染。

- [ ] **Step 4: 最终提交（若有修正）**

```bash
git add -A
git commit -m "test: verify voice-call plugin end-to-end (1:1/conference/video)"
```

---

## 自检（Self-Review）

**1. Spec 覆盖核对：**
- §2 目标（三类通话迁入插件）→ Task 6/7/8 覆盖。
- §4 架构（import map 共享）→ Task 1 覆盖。
- §5 Host API 扩展（invoke/onEvent/mountOverlay/registerToolbarAction + 白名单）→ Task 3 覆盖；UI 桥 → Task 4 覆盖；运行时激活 → Task 5 覆盖。
- §6 插件契约（manifest/renderers/activate/deactivate）→ Task 2/8 覆盖。
- §7 插件包与构建（独立 Vite 库、external vue/tdesign、manifest.json）→ Task 2 覆盖。
- §8 分发（本地插件源直接加载 dist）→ Task 10 覆盖；生产托管预留 → 不在本期（符合非目标）。
- §9 后端（保留 voice_call Rust、invoke_handler 注册、白名单）→ 后端无需改动，白名单在 Task 3 落实；实施时确认 `voice_call:*` 命令已在 `invoke_handler!` 注册（现状已注册）。
- §10 主程序清理（删目录、ChatCenter 去硬挂载、i18n 迁移、router/api 清理）→ Task 4（去硬挂载）、Task 11（删目录/i18n/引用）覆盖。
- §11 分阶段（P0–P6）→ 本计划 Task 1–12 映射。
- §12 风险（import map 产出、TDesign 全局配置共享）→ Task 1 落实；TDesign 主题共享待 Task 1/8 验证。

**2. Placeholder 扫描：** 无 TBD/TODO；Task 2 Step 7 的 manifest 生成经「修订」落实为 `manifest.json` 源 + copy 脚本（非占位）。Task 9 Step 2 的 `serverSocket` 取法以 chat 现有 domain registry 为准（实施时按现状填充，非逻辑占位）。

**3. 类型一致性：**
- `PluginContext.host.invoke/onEvent/mountOverlay/registerToolbarAction` 在 Task 3（类型）、Task 4（UI 桥实现签名）、Task 8（调用）保持一致。
- `createPluginUiApi` 的 `PluginUiBridge` 在 Task 3 定义、`chatPluginUiBridge` 在 Task 4 实现，签名一致（`mountOverlay(component, opts?)` / `registerToolbarAction(action)`）。
- `bindContext`/`invokeVoiceCall`/`onVoiceCallEvent` 在 Task 6 定义、Task 8 调用，签名一致。
- 本地源 `getLocalVoiceCallRuntimeEntry` 返回 `PluginRuntimeEntry`（Task 10）与 `runtimeGateway` 既有类型一致。
