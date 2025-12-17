import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { loadPlugin, type PluginManifest } from "../PluginLoader";

export interface PluginContext {
  manifest: PluginManifest;
  root: HTMLElement;
  html: string;
  wasmBytes: Uint8Array;
  compileWasm: () => Promise<WebAssembly.Module>;
  instantiateWasm: (imports?: WebAssembly.Imports) => Promise<WebAssembly.WebAssemblyInstantiatedSource>;
  invoke: typeof tauriInvoke;
}

export type PluginMountFn = (ctx: PluginContext) => void | Promise<void>;
export type PluginUnmountFn = () => void | Promise<void>;

export type PluginModule = {
  mount?: PluginMountFn;
  unmount?: PluginUnmountFn;
  default?: unknown;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer as ArrayBuffer;
  return bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength
    ? buffer
    : buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function createBlobUrl(bytes: Uint8Array, mime: string): string {
  const safeBytes = new Uint8Array(bytes.byteLength);
  safeBytes.set(bytes);
  return URL.createObjectURL(new Blob([safeBytes], { type: mime }));
}

function pickMount(mod: PluginModule): PluginMountFn | null {
  if (typeof mod.mount === "function") return mod.mount;
  if (typeof mod.default === "function") return mod.default as PluginMountFn;
  if (mod.default && typeof (mod.default as { mount?: unknown }).mount === "function") {
    return (mod.default as { mount: PluginMountFn }).mount;
  }
  return null;
}

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

  constructor(
    private manifest: PluginManifest,
    private host: HTMLElement,
  ) {}

  public async start(): Promise<void> {
    await this.stop();

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
    const compileWasm = async () => WebAssembly.compile(toArrayBuffer(wasmBytes));
    const instantiateWasm = async (imports?: WebAssembly.Imports) =>
      WebAssembly.instantiate(toArrayBuffer(wasmBytes), imports ?? {});

    await mount({
      manifest: this.manifest,
      root,
      html,
      wasmBytes,
      compileWasm,
      instantiateWasm,
      invoke: tauriInvoke,
    });
  }

  public async stop(): Promise<void> {
    const mod = this.module;
    this.module = null;

    if (mod) {
      const unmount = pickUnmount(mod);
      if (unmount) {
        await unmount();
      }
    }

    if (this.jsUrl) {
      URL.revokeObjectURL(this.jsUrl);
      this.jsUrl = null;
    }

    this.host.innerHTML = "";
  }
}
