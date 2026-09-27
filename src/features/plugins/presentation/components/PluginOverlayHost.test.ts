/**
 * @fileoverview PluginOverlayHost.test.ts
 * @description plugins｜presentation：插件浮层宿主「不吞宿主点击」契约验证。
 *
 * 回归背景：分层容器曾是 `position:absolute; inset:0; pointer-events:auto`，
 * 自带插件（group-notice / ai-summary）激活即常驻挂载浮层，于是整屏被一层透明空壳覆盖，
 * 宿主所有按钮都点不动。
 *
 * 另一回归背景：浮层内容经 `<Teleport to="body">` 渲染——宿主挂载点（.cp-center）
 * 的 backdrop-filter 会把 position:fixed 后代困在自己的包含块与层叠上下文里，
 * 导致插件面板被消息气泡盖住。因此断言一律查 document.body，而非 wrapper。
 */

import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import PluginOverlayHost from "./PluginOverlayHost.vue";

/** 测试用插件浮层组件（形状对齐自带插件的角落面板）。 */
const FakePanel = defineComponent({
  name: "FakePanel",
  props: { label: { type: String, default: "" } },
  render() {
    return h("div", { class: "fake-panel" }, this.label);
  },
});

/** 宿主浮层容器暴露的挂载能力（与 PluginOverlayHost 的 defineExpose 对齐）。 */
type OverlayHostExposed = {
  mount(component: unknown, opts?: { zIndex?: number; props?: Record<string, unknown> }): {
    unmount: () => void;
    instance: unknown;
  };
};

/** 当前测试持有的 wrapper：afterEach 统一卸载，避免 Teleport 到 body 的节点跨用例泄漏。 */
const activeWrappers: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of activeWrappers.splice(0)) {
    wrapper.unmount();
  }
});

/**
 * 挂载插件浮层宿主。
 *
 * @returns 宿主 wrapper 与其暴露的挂载能力。
 */
function mountHost(): { wrapper: VueWrapper; exposed: OverlayHostExposed } {
  const wrapper = mount(PluginOverlayHost);
  activeWrappers.push(wrapper);
  return { wrapper, exposed: wrapper.vm as unknown as OverlayHostExposed };
}

/** 浮层经 Teleport 落在 document.body 下，统一从这里查询。 */
function queryLayers(): NodeListOf<Element> {
  return document.body.querySelectorAll(".plugin-overlay-layer");
}

describe("PluginOverlayHost 点击穿透契约", () => {
  it("无浮层时不渲染分层容器", () => {
    mountHost();
    expect(queryLayers().length).toBe(0);
  });

  it("分层容器自身不拦截指针事件（只有插件内容可交互）", async () => {
    const { exposed } = mountHost();
    exposed.mount(FakePanel, { zIndex: 1234, props: { label: "panel" } });
    await Promise.resolve();

    const layers = queryLayers();
    expect(layers.length).toBe(1);
    const layerEl = layers[0] as HTMLElement;
    // 关键断言：覆盖全屏的空壳层必须 pointer-events: none，否则会吃掉宿主的所有点击。
    expect(layerEl.style.pointerEvents).toBe("none");
    expect(layerEl.style.zIndex).toBe("1234");
    // 插件自身内容照常渲染（其根元素在全局样式中恢复 pointer-events: auto）。
    const panel = document.body.querySelector(".fake-panel");
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toBe("panel");
  });

  it("unmount 后分层容器被移除", async () => {
    const { exposed } = mountHost();
    const handle = exposed.mount(FakePanel);
    await Promise.resolve();
    expect(queryLayers().length).toBe(1);

    handle.unmount();
    await Promise.resolve();
    expect(queryLayers().length).toBe(0);
  });

  it("浮层渲染在 body 下（脱离宿主 backdrop-filter 层叠上下文）", async () => {
    const { exposed } = mountHost();
    exposed.mount(FakePanel, { zIndex: 3000 });
    await Promise.resolve();

    const root = document.body.querySelector(":scope > .plugin-overlay-root");
    expect(root).not.toBeNull();
    // position:fixed + body 直挂：包含块为视口，z-index 与全局弹层同层比较。
    expect((root as HTMLElement).classList.contains("plugin-overlay-root")).toBe(true);
  });
});
