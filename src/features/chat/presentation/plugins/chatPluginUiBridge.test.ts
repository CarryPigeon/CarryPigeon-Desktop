/**
 * @fileoverview chatPluginUiBridge.test.ts
 * @description chat｜presentation：插件浮层注册跨宿主页面生命周期的契约验证。
 *
 * 回归背景：浮层注册结果曾只留在 ChatCenter 内 PluginOverlayHost 的组件局部数组里，
 * 而插件只在 activate 时调用一次 `host.mountOverlay`。于是「访问插件中心 → 返回聊天」
 * 后，新宿主实例的数组为空、插件持有的句柄仍指向已销毁的列表，工具栏入口静默失效
 * （运行期现象：console 出现 `ai_summary_toolbar_host_missing`，AI 总结 / 群通知按钮点不动）。
 *
 * 契约：注册表在桥（模块级）中，宿主挂载时重放既有注册、卸载时置空，
 * 句柄的 `instance` 实时读取当前宿主实例。
 */

import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { defineComponent, h } from "vue";
import { PluginOverlayHost } from "@/features/plugins/api";
import {
  bindOverlayMount,
  chatPluginUiBridge,
  resetOverlayRegistrations,
} from "./chatPluginUiBridge";

/** 测试用插件浮层组件（形状对齐自带插件的角落面板）。 */
const FakePanel = defineComponent({
  name: "FakePanel",
  props: { label: { type: String, default: "" } },
  render() {
    return h("div", { class: "fake-plugin-panel" }, this.label);
  },
});

/** 当前测试持有的宿主 wrapper：afterEach 统一卸载，避免 Teleport 到 body 的节点跨用例泄漏。 */
const activeWrappers: VueWrapper[] = [];

afterEach(() => {
  resetOverlayRegistrations();
  for (const wrapper of activeWrappers.splice(0)) {
    wrapper.unmount();
  }
});

/**
 * 挂载浮层宿主并绑定到桥（等价于 ChatCenter 挂载时的绑定）。
 *
 * @returns 宿主 wrapper 与其暴露的挂载能力。
 */
function mountAndBindHost(): { wrapper: VueWrapper; mountOverlay: () => void } {
  const wrapper = mount(PluginOverlayHost);
  activeWrappers.push(wrapper);
  const exposed = wrapper.vm as unknown as {
    mount: (c: unknown, opts?: { zIndex?: number; props?: Record<string, unknown> }) => unknown;
  };
  bindOverlayMount(exposed.mount as never);
  return { wrapper, mountOverlay: () => bindOverlayMount(exposed.mount as never) };
}

/** 浮层经 Teleport 落在 document.body 下，统一从这里查询。 */
function queryLayers(): NodeListOf<Element> {
  return document.body.querySelectorAll(".plugin-overlay-layer");
}

describe("chatPluginUiBridge 浮层注册生命周期", () => {
  it("宿主未挂载时注册：句柄 instance 为 null，宿主挂载后被重放", async () => {
    const handle = chatPluginUiBridge.mountOverlay(FakePanel, { props: { label: "late-host" } });
    expect(handle.instance).toBeNull();
    expect(queryLayers().length).toBe(0);

    mountAndBindHost();
    await nextTick();

    expect(queryLayers().length).toBe(1);
    expect(handle.instance).not.toBeNull();
    expect(document.body.querySelector(".fake-plugin-panel")?.textContent).toBe("late-host");
  });

  it("宿主卸载→重挂载后浮层与句柄恢复（回归：访问插件中心返回聊天）", async () => {
    const first = mountAndBindHost();
    const handle = chatPluginUiBridge.mountOverlay(FakePanel, { props: { label: "page-switch" } });
    await nextTick();
    expect(queryLayers().length).toBe(1);
    expect(handle.instance).not.toBeNull();

    // 离开聊天页：宿主卸载并解绑。
    first.wrapper.unmount();
    bindOverlayMount(null);
    await nextTick();
    expect(queryLayers().length).toBe(0);
    expect(handle.instance).toBeNull();

    // 返回聊天页：新宿主挂载，注册被重放，句柄指向新实例。
    mountAndBindHost();
    await nextTick();
    expect(queryLayers().length).toBe(1);
    expect(handle.instance).not.toBeNull();
    expect(document.body.querySelector(".fake-plugin-panel")?.textContent).toBe("page-switch");
  });

  it("unmount 后注册被移除，重挂载不再重放", async () => {
    mountAndBindHost();
    const handle = chatPluginUiBridge.mountOverlay(FakePanel);
    await nextTick();
    expect(queryLayers().length).toBe(1);

    handle.unmount();
    await nextTick();
    expect(queryLayers().length).toBe(0);

    const second = mountAndBindHost();
    await nextTick();
    expect(queryLayers().length).toBe(0);
    // 二次绑定（模拟宿主内部重挂载）同样不应复活已卸载的浮层。
    second.mountOverlay();
    await nextTick();
    expect(queryLayers().length).toBe(0);
  });
});
