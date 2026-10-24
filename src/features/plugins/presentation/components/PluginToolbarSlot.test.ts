/**
 * @fileoverview PluginToolbarSlot.test.ts
 * @description plugins｜组件：插件工具栏入口是顶栏里的无外框图标按钮。
 *
 * 契约：
 * - 入口使用 TDesign `text` 变体（transparent 边框/底色）。若回退成 `outline` 变体，
 *   顶栏每个插件图标又会各套一圈可见边框，与相邻的搜索/设置/@提醒铃铛图标不一致；
 * - 只有图标、没有标签的入口必须按 32×32 图标按钮渲染：默认插槽不能输出任何节点
 *   （空白文本也会被 TDesign 当成文本槽，多出 8px 左边距，让按钮变宽且图标偏左）。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { Comment, defineComponent, h, Text, type VNode } from "vue";
import PluginToolbarSlot from "./PluginToolbarSlot.vue";
import slotSource from "./PluginToolbarSlot.vue?raw";

/** 判断默认插槽是否算“有文本”：模拟 TDesign 的 `:not(:empty)` 判定（空格也算内容）。 */
function slotHasText(nodes: unknown[]): boolean {
  return nodes.some((node) => {
    const vnode = node as VNode | null;
    if (!vnode) return false;
    if (vnode.type === Comment) return false;
    if (vnode.type === Text) return String(vnode.children ?? "").trim().length > 0;
    return true;
  });
}

/** TDesign t-button 的轻量替身：把 variant / 图标入口标记暴露为 class，便于断言。 */
const TButtonStub = defineComponent({
  name: "TButton",
  props: {
    variant: { type: String, default: "" },
    size: { type: String, default: "" },
  },
  setup(props, { slots }) {
    return () => {
      const content = slots.default?.() ?? [];
      const classes = [`t-button--variant-${props.variant}`];
      // 与 TDesign 一致：有文本才保留文本槽，纯图标入口不产生文本槽。
      classes.push(slotHasText(content) ? "stub-has-text" : "stub-icon-only");
      return h("button", { class: classes }, [slots.icon?.(), content]);
    };
  },
});

/** 测试图标。 */
const TestIcon = defineComponent({ render: () => h("i", { class: "test-icon" }) });

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

/** 挂载只含图标入口的工具栏插槽。 */
function mountIconOnlySlot(label = "") {
  return mount(PluginToolbarSlot, {
    props: {
      actions: [{ id: "theme", label, icon: TestIcon, order: 1, onClick: () => {} }],
      chatContext: { channelId: "c1" },
    },
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

  it("图标入口不产生文本槽（否则会被空标签撑宽并让图标偏左）", () => {
    const wrapper = mountIconOnlySlot();
    const button = wrapper.find("button");
    expect(button.classes()).toContain("plugin-toolbar-slot__btn--iconOnly");
    expect(button.classes()).toContain("stub-icon-only");
    expect(button.classes()).not.toContain("stub-has-text");
    expect(button.find(".test-icon").exists()).toBe(true);
    wrapper.unmount();
  });

  it("纯空白标签也按图标入口处理", () => {
    const wrapper = mountIconOnlySlot("   ");
    const button = wrapper.find("button");
    expect(button.classes()).toContain("plugin-toolbar-slot__btn--iconOnly");
    expect(button.classes()).toContain("stub-icon-only");
    wrapper.unmount();
  });

  it("带标签入口保留文本槽与标签文案", () => {
    const wrapper = mount(PluginToolbarSlot, {
      props: {
        actions: [{ id: "notice", label: " 公告 ", icon: TestIcon, order: 1, onClick: () => {} }],
        chatContext: { channelId: "c1" },
      },
      global: { components: { "t-button": TButtonStub } },
    });
    const button = wrapper.find("button");
    expect(button.classes()).toContain("stub-has-text");
    expect(button.classes()).not.toContain("plugin-toolbar-slot__btn--iconOnly");
    expect(button.text()).toBe("公告");
    wrapper.unmount();
  });

  it("图标入口样式契约：32×32、内边距 0、与宿主图标按钮同规格", () => {
    expect(slotSource).toMatch(/--iconOnly\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*padding:\s*0;/);
    expect(slotSource).toMatch(/border-radius:\s*var\(--cp-radius-sm\);/);
    expect(slotSource).toMatch(/gap:\s*6px;/);
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
