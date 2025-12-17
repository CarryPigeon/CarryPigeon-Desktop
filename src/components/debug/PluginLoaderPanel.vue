<script setup lang="ts">
/**
 * PluginLoaderPanel（仅开发/调试用途）
 *
 * 用于在 WebView 内快速验证“插件加载链路”是否可用：
 * 1) 调用 `loadPlugin({ name })` 从后端获取插件 wasm bytes
 * 2) 尝试在前端计算 SHA-256（依赖 `crypto.subtle`，某些 WebView 环境可能不可用）
 * 3) 尝试 `WebAssembly.compile`，验证 bytes 是否是合法 wasm
 */

import { computed, ref } from "vue";
import { loadPlugin } from "../../script/service/PluginLoader";

/** 加载状态机：用于控制按钮可点击性与结果展示 */
type LoadState = "idle" | "loading" | "loaded" | "error";

/** 输入：插件 manifest.name */
const pluginName = ref("example-plugin");
const state = ref<LoadState>("idle");

/** 输出：加载得到的 bytes 长度 / SHA-256 / 是否可编译 */
const bytesLength = ref<number | null>(null);
const sha256 = ref<string | null>(null);
const compiled = ref<boolean | null>(null);

/** 错误信息：仅在 state === 'error' 时展示 */
const errorMessage = ref<string | null>(null);

/** 只有在有输入且不处于 loading 时才允许触发加载 */
const canLoad = computed(() => pluginName.value.trim().length > 0 && state.value !== "loading");

/** 将 digest 得到的 ArrayBuffer 转为 hex 字符串 */
function hexFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * 计算 bytes 的 SHA-256（hex）。
 *
 * 注意：这里使用 Web Crypto API；如果 WebView 不提供 `crypto.subtle`，会抛错并在 UI 中显示为不可用。
 */
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("crypto.subtle is not available in this WebView");
  }

  const hash = await globalThis.crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  return hexFromBuffer(hash);
}

/**
 * 将 `Uint8Array` 规范化为“紧凑”的 `ArrayBuffer`。
 *
 * `bytes.buffer` 可能包含多余数据（例如 bytes 是子视图）；此处确保传给 Web Crypto / WebAssembly 的是正确切片。
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer as ArrayBuffer;
  return bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength
    ? buffer
    : buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/** 点击 Load：执行加载、可选的 SHA-256 计算、以及 wasm 编译验证 */
async function onLoad(): Promise<void> {
  state.value = "loading";

  // 每次加载前先清空上一轮结果
  errorMessage.value = null;
  bytesLength.value = null;
  sha256.value = null;
  compiled.value = null;

  try {
    const bytes = await loadPlugin({ name: pluginName.value.trim() });
    bytesLength.value = bytes.frontendWasm.length;

    try {
      sha256.value = await sha256Hex(bytes.frontendWasm);
    } catch (err) {
      sha256.value = null;
      console.warn("Failed to compute SHA-256 for plugin bytes", err);
    }

    try {
      await WebAssembly.compile(toArrayBuffer(bytes.frontendWasm));
      compiled.value = true;
    } catch (err) {
      compiled.value = false;
      console.warn("Failed to compile plugin wasm in WebView", err);
    }

    state.value = "loaded";
  } catch (err) {
    state.value = "error";
    errorMessage.value = err instanceof Error ? err.message : String(err);
  }
}
</script>

<template>
  <!-- Debug only：用于手动触发插件 wasm 加载与校验 -->
  <div class="plugin-loader-panel">
    <div class="row">
      <span class="label">WASM 插件</span>
      <input v-model="pluginName" class="input" placeholder="plugin name (manifest.name)" />
      <button class="button" :disabled="!canLoad" @click="onLoad">
        {{ state === "loading" ? "Loading..." : "Load" }}
      </button>
    </div>

    <div v-if="state === 'loaded'" class="result">
      <div>Bytes: {{ bytesLength }}</div>
      <div>SHA-256: {{ sha256 ?? "(unavailable)" }}</div>
      <div>
        WebAssembly.compile:
        {{ compiled === null ? "(skipped)" : compiled ? "OK" : "Failed" }}
      </div>
    </div>

    <div v-else-if="state === 'error'" class="error">
      {{ errorMessage }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.plugin-loader-panel {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 9999;
  width: 420px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(17, 24, 39, 0.92);
  color: #e5e7eb;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  font-size: 12px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  min-width: 56px;
  font-weight: 600;
}

.input {
  flex: 1;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(15, 23, 42, 0.9);
  color: inherit;
  padding: 0 10px;
  outline: none;
}

.input:focus {
  border-color: rgba(59, 130, 246, 0.9);
}

.button {
  height: 28px;
  border-radius: 8px;
  padding: 0 12px;
  border: 1px solid rgba(59, 130, 246, 0.7);
  background: rgba(59, 130, 246, 0.25);
  color: inherit;
  cursor: pointer;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result {
  margin-top: 10px;
  display: grid;
  gap: 4px;
  word-break: break-all;
}

.error {
  margin-top: 10px;
  color: #fca5a5;
  word-break: break-word;
}
</style>