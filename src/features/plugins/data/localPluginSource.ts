/**
 * @fileoverview 开发期本地插件源
 * @description
 * 开发期直接加载 `plugins/voice-call/dist` 构建产物，避免依赖外部插件托管。
 * 通过 env `VITE_USE_LOCAL_VOICE_CALL_PLUGIN=true` 启用。
 */

import type { PluginRuntimeEntry } from "@/features/plugins/domain/types/pluginTypes";

const PLUGIN_ID = "voice-call";
const VERSION = "0.1.0";

/**
 * 开发期本地插件源：entry 指向经 `public/plugins/voice-call/` 静态服务的构建产物。
 *
 * 说明：entry 使用根相对路径 `/plugins/voice-call/index.js`，
 * 由模块加载器在 dev 下直接 `import()`（Vite 把 `public/`  serv 在 dev 根）；
 * 生产环境插件走标准 `app://plugins/...` 分发，不依赖此源。
 */
export function getLocalVoiceCallRuntimeEntry(serverId: string): PluginRuntimeEntry {
  return {
    serverId,
    pluginId: PLUGIN_ID,
    version: VERSION,
    entry: "/plugins/voice-call/index.js",
    permissions: ["invoke", "events", "ui", "storage"],
    providesDomains: [{ domain: "call_record", domainVersion: "1" }],
    minHostVersion: "0.0.0",
  };
}

/** 是否启用开发期本地 voice-call 插件源。 */
export const USE_LOCAL_VOICE_CALL_PLUGIN =
  import.meta.env.VITE_USE_LOCAL_VOICE_CALL_PLUGIN === "true";
