/**
 * @fileoverview pluginRuntime 单测：插件样式表 URL 推导与注入。
 * @description
 * 回归背景：插件构建把样式抽取为同目录 `style.css`，但 JS 产物不含样式导入；
 * 宿主的入口加载曾缺少这一步，导致自带插件在运行时完全没有样式。
 */

import { afterEach, describe, expect, it } from "vitest";
import { ensurePluginStylesheet, toPluginStyleUrl } from "./pluginRuntime";

/** 读取当前 document 中由本模块注入的样式表 href 列表。 */
function injectedStyleHrefs(): string[] {
  return Array.from(document.head.querySelectorAll("link[data-plugin-style]")).map(
    (el) => el.getAttribute("href") ?? "",
  );
}

describe("toPluginStyleUrl", () => {
  it("推导根相对入口（本地自带插件源）", () => {
    expect(toPluginStyleUrl("/plugins/ai-summary/index.js")).toBe("/plugins/ai-summary/style.css");
  });

  it("推导 app:// 入口（服务端安装插件）", () => {
    expect(toPluginStyleUrl("app://plugins/server-1/theme/0.1.0/index.js")).toBe(
      "app://plugins/server-1/theme/0.1.0/style.css",
    );
  });

  it("保留 query（dev 缓存击穿参数不影响 CSS 定位）", () => {
    expect(toPluginStyleUrl("/plugins/markdown/index.js?t=1a2b")).toBe(
      "/plugins/markdown/style.css?t=1a2b",
    );
  });

  it("入口不是 index.js 或为空时不推导", () => {
    expect(toPluginStyleUrl("/plugins/theme/main.js")).toBe("");
    expect(toPluginStyleUrl("")).toBe("");
    expect(toPluginStyleUrl("   ")).toBe("");
  });

  it("不会把 index.js 之外的片段误判为入口", () => {
    expect(toPluginStyleUrl("/plugins/theme/index.js.map")).toBe("");
  });
});

describe("ensurePluginStylesheet", () => {
  afterEach(() => {
    for (const el of Array.from(document.head.querySelectorAll("link[data-plugin-style]"))) {
      el.remove();
    }
  });

  it("注入 rel=stylesheet 的 link", () => {
    ensurePluginStylesheet("/plugins/plugin-runtime-test-a/style.css");
    const links = Array.from(document.head.querySelectorAll('link[rel="stylesheet"][data-plugin-style]'));
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/plugins/plugin-runtime-test-a/style.css");
  });

  it("同一 URL 重复调用只注入一次（插件重复激活）", () => {
    ensurePluginStylesheet("/plugins/plugin-runtime-test-b/style.css");
    ensurePluginStylesheet("/plugins/plugin-runtime-test-b/style.css");
    expect(injectedStyleHrefs().filter((href) => href.includes("plugin-runtime-test-b"))).toHaveLength(1);
  });

  it("空 URL 时 no-op", () => {
    ensurePluginStylesheet("");
    expect(injectedStyleHrefs()).toEqual([]);
  });
});
