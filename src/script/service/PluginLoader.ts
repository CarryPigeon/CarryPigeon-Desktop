/**
 * 插件加载器（前端侧）
 *
 * 负责通过 Tauri `invoke("load_plugin")` 从后端获取插件 wasm 字节。
 * 后端可能以 `Vec<u8>` / `ArrayBuffer` / `Uint8Array` 等形式返回，本模块会统一转换为 `Uint8Array`。
 *
 * 设计要点：
 * - 缓存键为 `name@version`：重复/并发加载共享同一个 Promise，避免重复请求与 IO。
 * - manifest 会做归一化：将可选字段补齐，并把与 Rust `Option<String>` 对应的字段统一为 `string | null`。
 */
import { invoke } from "@tauri-apps/api/core";

/**
 * 插件清单（manifest）。
 *
 * 该结构与 Rust 侧的 manifest 对应。
 * 注意：Rust 的 `Option<String>` 序列化到前端后通常表现为 `string | null`（而不是 `undefined`），
 * 因此这里的可选字段都允许 `null`。
 */
export interface PluginManifest {
  /** 插件名称（唯一标识，通常也是查找 key） */
  name: string;
  /** 语义化版本号（用于缓存与展示） */
  version: string;

  /** 插件描述（可为空） */
  description?: string | null;
  /** 作者信息（可为空） */
  author?: string | null;
  /** 许可证标识（可为空） */
  license?: string | null;

  /** 插件资源基址 URL，例如包含 `/frontend.wasm`、`/backend.wasm` 等 */
  url: string;
  /** 前端 wasm 的 SHA-256（hex 字符串） */
  frontend_sha256: string;
  /** 后端 wasm 的 SHA-256（hex 字符串） */
  backend_sha256: string;

  icon?: string | null;
}

export type PluginManifestInput = Partial<Omit<PluginManifest, "name">> & Pick<PluginManifest, "name">;

type PluginLoadResult = {
  frontendWasm: unknown;
  frontendJs: unknown;
  frontendHtml: unknown;
};

const pluginCache = new Map<
  string,
  Promise<{
    frontendWasm: Uint8Array;
    frontendJs: Uint8Array;
    frontendHtml: string;
  }>
>();

function normalizeManifest(input: PluginManifestInput): PluginManifest {
  return {
    name: input.name,
    version: input.version ?? "0.0.0",
    description: input.description ?? null,
    author: input.author ?? null,
    license: input.license ?? null,
    url: input.url ?? "",
    frontend_sha256: input.frontend_sha256 ?? "",
    backend_sha256: input.backend_sha256 ?? "",
    icon: input.icon ?? null,
  };
}

function bytesToUint8Array(bytes: unknown): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  if (Array.isArray(bytes)) return new Uint8Array(bytes);
  if (typeof bytes === "string") {
    const binary = atob(bytes);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  throw new Error(`Unexpected bytes type: ${Object.prototype.toString.call(bytes)}`);
}

function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  return new TextDecoder("utf-8").decode(bytes);
}

export async function loadPlugin(manifest: PluginManifestInput): Promise<{
  frontendWasm: Uint8Array;
  frontendJs: Uint8Array;
  frontendHtml: string;
}> {
  const normalized = normalizeManifest(manifest);
  const cacheKey = `${normalized.name}@${normalized.version}`;

  const cached = pluginCache.get(cacheKey);
  if (cached) return cached;

  const loading = (async () => {
    const result = await invoke<PluginLoadResult>("load_plugin", { manifest: normalized });
    const frontendWasm = bytesToUint8Array(result.frontendWasm);
    const frontendJs = bytesToUint8Array(result.frontendJs);
    const frontendHtml = decodeUtf8(bytesToUint8Array(result.frontendHtml));
    return { frontendWasm, frontendJs, frontendHtml };
  })();

  pluginCache.set(cacheKey, loading);

  try {
    return await loading;
  } catch (err) {
    pluginCache.delete(cacheKey);
    invoke("log_error", { message: `Failed to load plugin ${normalized.name}: ${err}` });
    return { frontendWasm: Uint8Array.from([]), frontendJs: Uint8Array.from([]), frontendHtml: "" };
  }
}

export async function loadPluginByName(name: string): Promise<Uint8Array> {
  const { frontendWasm } = await loadPlugin({ name });
  return frontendWasm;
}

export async function compilePluginWasm(manifest: PluginManifestInput): Promise<WebAssembly.Module> {
  const bytes = await loadPlugin(manifest);
  const buffer = bytes.frontendWasm.buffer as ArrayBuffer;
  const arrayBuffer =
    bytes.frontendWasm.byteOffset === 0 && bytes.frontendWasm.byteLength === buffer.byteLength
      ? buffer
      : buffer.slice(bytes.frontendWasm.byteOffset, bytes.frontendWasm.byteOffset + bytes.frontendWasm.byteLength);
  return WebAssembly.compile(arrayBuffer);
}
