/**
 * @fileoverview about Feature 对外公共 API。
 */

import type { AboutCapabilities, AppInfo } from "./api-types";

const BASE_INFO: Omit<AppInfo, "version"> = {
  name: "CarryPigeon Desktop",
  description: "CarryPigeon 桌面客户端 — 自建服务器聊天与协作平台。",
  techStack: [
    "Tauri 2 (Rust + WebView)",
    "Vue 3 + TypeScript",
    "TDesign Vue Next",
    "WebAssembly (WASM) Plugin Runtime",
  ],
  license: "Apache-2.0",
  credits: [
    { name: "Tauri Contributors", url: "https://tauri.app" },
    { name: "Vue.js Team", url: "https://vuejs.org" },
    { name: "TDesign (Tencent)", url: "https://tdesign.tencent.com" },
    { name: "wasmtime (Bytecode Alliance)", url: "https://wasmtime.dev" },
    { name: "VueUse Community", url: "https://vueuse.org" },
  ],
};

async function resolveVersion(): Promise<string> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return (import.meta as unknown as { env?: { PACKAGE_VERSION?: string } }).env?.PACKAGE_VERSION ?? "0.0.0";
  }
}

let aboutCapabilities: AboutCapabilities | null = null;

export function createAboutCapabilities(): AboutCapabilities {
  return {
    getAppInfo: async () => {
      const version = await resolveVersion();
      return { ...BASE_INFO, version };
    },
  };
}

export function getAboutCapabilities(): AboutCapabilities {
  aboutCapabilities ??= createAboutCapabilities();
  return aboutCapabilities;
}
