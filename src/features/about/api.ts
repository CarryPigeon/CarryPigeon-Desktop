/**
 * @fileoverview about Feature 对外公共 API。
 */

import type { AboutCapabilities, AppInfo } from "./api-types";

const APP_INFO: AppInfo = {
  name: "CarryPigeon Desktop",
  version: "0.1.1",
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

let aboutCapabilities: AboutCapabilities | null = null;

export function createAboutCapabilities(): AboutCapabilities {
  return {
    getAppInfo: () => APP_INFO,
  };
}

export function getAboutCapabilities(): AboutCapabilities {
  aboutCapabilities ??= createAboutCapabilities();
  return aboutCapabilities;
}
