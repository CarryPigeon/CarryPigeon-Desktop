/**
 * @fileoverview PluginToolbarSlot.test.ts
 * @description plugins｜组件：插件工具栏入口是顶栏里的无外框图标按钮。
 *
 * 契约：入口使用 TDesign `text` 变体（transparent 边框/底色）。若回退成 `outline` 变体，
 * 顶栏每个插件图标又会各套一圈可见边框，与相邻的搜索/设置/@提醒铃铛图标不一致。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import PluginToolbarSlot from "./PluginToolbarSlot.vue";

/** TDesign t-button 的轻量替身：把 variant 暴露为 class，便于断言。 */
const TButtonStub = defineComponent({
  name: "TButton",
  props: {
    variant: { type: String, default: "" },
    size: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () =>
      h("button", { class: `t-button--variant-${props.variant}` }, [slots.icon?.(), slots.default?.()]);
  },
});

/** 两个动作：order 故意乱序，用于校验排序。 */
const actions = [
  { id: "later", label: "later", icon: defineComponent({ render: () => h("i", { class: "icon-later" }) }), order: 62, onClick: () => {} },
  { id: "earlier", label: "earlier", icon: defineComponent({ render: () => h("i", { class: "icon-earlier" }) }), order: 61, onClick: () => {} },
];

/** 挂载工具栏插槽。 */
function mountSlot() {
  return mount(PluginToolbarSlot, {
    props: { actions, chatContext: { channelId: "c1" } },
    global: { components: { "t-button": TButtonStub } },
  });
}

describe("PluginToolbarSlot", () => {
  it("按 order 升序渲染入口", () => {
    const wrapper = mountSlot();
    expect(wrapper.findAll("button").map((button) => button.text())).toEqual(["earlier", "later"]);
    wrapper.unmount();
  });

  it("入口使用无外框的 text 变体", () => {
    const wrapper = mountSlot();
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.classes()).toContain("t-button--variant-text");
    }
    wrapper.unmount();
  });

  it("点击入口透传当前聊天上下文", async () => {
    const calls: unknown[] = [];
    const wrapper = mount(PluginToolbarSlot, {
      props: {
        actions: [{ id: "a", label: "", order: 1, onClick: (ctx: unknown) => calls.push(ctx) }],
        chatContext: { channelId: "c1" },
      },
      global: { components: { "t-button": TButtonStub } },
    });

    await wrapper.find("button").trigger("click");
    expect(calls).toEqual([{ channelId: "c1" }]);
    wrapper.unmount();
  });
});
