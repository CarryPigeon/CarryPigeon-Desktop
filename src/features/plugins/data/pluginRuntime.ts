/**
 * @fileoverview 插件运行时（前端侧挂载/卸载）。
 * @description 负责将插件 HTML 注入宿主 DOM，并动态 import 插件 JS 执行 mount/unmount。
 */
import { invokeTauri } from "../../../shared/tauri";
import { loadPlugin, type PluginManifest } from "./pluginLoader";
import { createLogger } from "@/shared/utils/logger";

export interface PluginContext {
  manifest: PluginManifest;
  root: HTMLElement;
  html: string;
  wasmBytes: Uint8Array;
  compileWasm: () => Promise<WebAssembly.Module>;
  instantiateWasm: (imports?: WebAssembly.Imports) => Promise<WebAssembly.WebAssemblyInstantiatedSource>;
  invoke: typeof invokeTauri;
}

export type PluginMountFn = (ctx: PluginContext) => void | Promise<void>;
export type PluginUnmountFn = () => void | Promise<void>;

export type PluginModule = {
  mount?: PluginMountFn;
  unmount?: PluginUnmountFn;
  default?: unknown;
};

/**
 * toArrayBuffer 方法说明。
 * @param bytes - 参数说明。
 * @returns 返回值说明。
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer as ArrayBuffer;
  return bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength
    ? buffer
    : buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * createBlobUrl 方法说明。
 * @param bytes - 参数说明。
 * @param mime - 参数说明。
 * @returns 返回值说明。
 */
function createBlobUrl(bytes: Uint8Array, mime: string): string {
  const safeBytes = new Uint8Array(bytes.byteLength);
  safeBytes.set(bytes);
  return URL.createObjectURL(new Blob([safeBytes], { type: mime }));
}

/**
 * pickMount 方法说明。
 * @param mod - 参数说明。
 * @returns 返回值说明。
 */
function pickMount(mod: PluginModule): PluginMountFn | null {
  if (typeof mod.mount === "function") return mod.mount;
  if (typeof mod.default === "function") return mod.default as PluginMountFn;
  if (mod.default && typeof (mod.default as { mount?: unknown }).mount === "function") {
    return (mod.default as { mount: PluginMountFn }).mount;
  }
  return null;
}

/**
 * pickUnmount 方法说明。
 * @param mod - 参数说明。
 * @returns 返回值说明。
 */
function pickUnmount(mod: PluginModule): PluginUnmountFn | null {
  if (typeof mod.unmount === "function") return mod.unmount;
  if (mod.default && typeof (mod.default as { unmount?: unknown }).unmount === "function") {
    return (mod.default as { unmount: PluginUnmountFn }).unmount;
  }
  return null;
}

export class PluginRuntime {
  private module: PluginModule | null = null;
  private jsUrl: string | null = null;
  private readonly logger = createLogger("PluginRuntime");

  constructor(
    private manifest: PluginManifest,
    private host: HTMLElement,
  ) {}

  /**
   * 启动插件：加载资源、注入 HTML、执行 mount。
   * @returns Promise<void>
   */
  public async start(): Promise<void> {
    await this.stop();

    this.logger.info("Plugin start", { name: this.manifest.name, version: this.manifest.version });
    const { frontendWasm, frontendJs, frontendHtml } = await loadPlugin(this.manifest);

    const html =
      frontendHtml.trim().length > 0
        ? frontendHtml
        : `<div style="padding:16px;font-family:system-ui">No frontend.html for plugin <b>${this.manifest.name}</b></div>`;

    this.host.innerHTML = html;
    const root = this.host.querySelector<HTMLElement>("[data-plugin-root]") ?? this.host;

    if (frontendJs.length === 0) {
      this.module = null;
      this.jsUrl = null;
      return;
    }

    this.jsUrl = createBlobUrl(frontendJs, "text/javascript");

    const mod = (await import(/* @vite-ignore */ this.jsUrl)) as PluginModule;
    this.module = mod;

    const mount = pickMount(mod);
    if (!mount) return;

    const wasmBytes = frontendWasm;
/**
 * compileWasm 方法说明。
 * @returns 返回值说明。
 */
    const compileWasm = async () => WebAssembly.compile(toArrayBuffer(wasmBytes));
/**
 * instantiateWasm 方法说明。
 * @param imports? - 参数说明。
 * @returns 返回值说明。
 */
    const instantiateWasm = async (imports?: WebAssembly.Imports) =>
      WebAssembly.instantiate(toArrayBuffer(wasmBytes), imports ?? {});

    try {
      await mount({
        manifest: this.manifest,
        root,
        html,
        wasmBytes,
        compileWasm,
        instantiateWasm,
        invoke: invokeTauri,
      });
    } catch (e) {
      this.logger.error("Plugin mount failed", { name: this.manifest.name, error: String(e) });
      throw e;
    }
  }

  /**
   * 停止插件：执行 unmount、回收 blob URL、清空宿主节点。
   * @returns Promise<void>
   */
  public async stop(): Promise<void> {
    const mod = this.module;
    this.module = null;

    if (mod) {
      const unmount = pickUnmount(mod);
      if (unmount) {
        try {
          await unmount();
        } catch (e) {
          this.logger.warn("Plugin unmount failed", { name: this.manifest.name, error: String(e) });
        }
      }
    }

    if (this.jsUrl) {
      URL.revokeObjectURL(this.jsUrl);
      this.jsUrl = null;
    }

    this.host.innerHTML = "";
  }
}
