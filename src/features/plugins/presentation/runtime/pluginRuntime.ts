/**
 * @fileoverview 插件运行时加载器（桌面端）。
 * @description plugins｜展示层实现：pluginRuntime。
 * 负责动态 import 插件前端模块、样式表推导/注入，以及 runtime gateway 透出。
 *
 * 说明：插件的契约规范化（v1/v2 分流）已迁移到 `@/features/plugins/runtime/loadPluginModule`，
 * 本文件只保留与浏览器加载强相关的低层能力。
 */

/**
 * 从 `app://plugins/...`（或根相对 / 绝对）动态 import 插件模块。
 *
 * @param entryUrl - 绝对 entry URL。
 * @returns 原始模块命名空间对象。
 */
export async function importPluginModule(entryUrl: string): Promise<Record<string, unknown>> {
  const url = String(entryUrl ?? "").trim();
  if (!url) {
    throw new Error("missing plugin entry url");
  }
  // cache-bust：允许在 import 失败后重新加载同一版本。
  const bust = `t=${Date.now().toString(16)}`;
  const finalUrl = url.includes("?") ? `${url}&${bust}` : `${url}?${bust}`;
  return import(/* @vite-ignore */ finalUrl);
}

/**
 * 由插件 JS 入口 URL 推导其样式表 URL。
 *
 * 说明：
 * - 插件构建（各插件目录下的 `vite.config.ts`）把抽取的样式固定输出为同目录 `style.css`，
 *   但产物 JS 中不含 `import "./style.css"`，因此必须由宿主显式加载，否则插件在
 *   运行时完全没有样式（现象：面板以文档流形态挤在侧栏内）。
 * - 仅当入口以 `index.js` 结尾时才推导；query（dev 缓存击穿参数）原样保留，
 *   避免带 query 的 JS 入口影响 CSS 定位。
 *
 * @param entryUrl - 插件 JS 入口 URL（绝对 / 根相对 / `app://`）。
 * @returns 样式表 URL；无法推导时返回空字符串。
 */
export function toPluginStyleUrl(entryUrl: string): string {
  const raw = String(entryUrl ?? "").trim();
  if (!raw) return "";
  const queryIndex = raw.indexOf("?");
  const pathPart = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const queryPart = queryIndex >= 0 ? raw.slice(queryIndex) : "";
  if (!pathPart.endsWith("index.js")) return "";
  return `${pathPart.slice(0, -"index.js".length)}style.css${queryPart}`;
}

// 已注入的插件样式表 URL：避免同一插件重复激活时重复插入 <link>。
const injectedPluginStyles = new Set<string>();

/**
 * 向 document 注入插件样式表（幂等）。
 *
 * 说明：
 * - 非 DOM 环境（SSR / 纯 Node）直接 no-op；
 * - 只负责注入，不等待加载完成、不阻塞插件激活；加载失败只是样式缺失。
 *
 * @param styleUrl - `toPluginStyleUrl` 产出的样式表 URL。
 */
export function ensurePluginStylesheet(styleUrl: string): void {
  const url = String(styleUrl ?? "").trim();
  if (!url) return;
  if (typeof document === "undefined" || !document.head) return;
  if (injectedPluginStyles.has(url)) return;
  injectedPluginStyles.add(url);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.dataset.pluginStyle = url;
  document.head.appendChild(link);
}

export { getRuntimeEntry, getRuntimeEntryForVersion, toAppPluginEntryUrl } from "./runtimeGateway";
