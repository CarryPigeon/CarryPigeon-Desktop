/**
 * @fileoverview ComposerHost.test.ts
 * @description chat｜composer：发送按钮内嵌输入区的结构与禁用态验证。
 */

import { afterEach, describe, expect, it } from "vitest";
import { markRaw } from "vue";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import ComposerHost from "./ComposerHost.vue";
import { clearAttachments } from "@/features/chat/message-flow/upload/presentation/runtime/fileAttachmentStore";

/** 待发送附件是模块级响应式 Map，用例间需清空，避免串扰。 */
afterEach(() => {
  clearAttachments();
});

/**
 * 挂载 composer。
 *
 * @param props - 覆盖默认 props。
 * @returns 测试用 wrapper。
 */
function mountComposer(props: Record<string, unknown> = {}) {
  return mount(ComposerHost, {
    props: { domainId: "Core:Text", domainOptions: [], draft: "", currentUserId: "u1", ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } })],
      // vitest 未启用 TDesign 自动导入解析器：桩掉文本域 / 图标 / 弹层组件，仅断言结构与行为。
      stubs: { "t-textarea": true, AppIcon: true, "t-popup": true },
    },
  });
}

describe("ComposerHost 发送按钮内嵌输入区", () => {
  it("Core:Text 且草稿非空：发送按钮位于输入区内且可点击派发 send", async () => {
    const wrapper = mountComposer({ draft: "hello" });

    const send = wrapper.find(".cp-composer__inputArea button.cp-composer__send--overlay");
    expect(send.exists()).toBe(true);
    expect((send.element as HTMLButtonElement).disabled).toBe(false);

    await send.trigger("click");
    expect(wrapper.emitted("send")).toHaveLength(1);
  });

  it("草稿为空：发送按钮仍内嵌于输入区但处于禁用态", () => {
    const wrapper = mountComposer({ draft: "   " });

    const send = wrapper.find(".cp-composer__inputArea button.cp-composer__send--overlay");
    expect(send.exists()).toBe(true);
    expect((send.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("插件 composer 生效：输入区不渲染发送按钮，改为提示文案", () => {
    const wrapper = mountComposer({ domainId: "Plugin:Demo", pluginComposer: markRaw({ template: "<div />" }) });

    expect(wrapper.find(".cp-composer__inputArea button.cp-composer__send--overlay").exists()).toBe(false);
    expect(wrapper.find(".cp-composer__actions").exists()).toBe(true);
  });

  it("Core:Voice 域：不渲染发送按钮，改为语音录制面板", () => {
    const wrapper = mountComposer({ domainId: "Core:Voice" });

    expect(wrapper.find(".cp-composer__inputArea button.cp-composer__send--overlay").exists()).toBe(false);
    expect(wrapper.find(".cp-composer__voice").exists()).toBe(true);
  });

  it("折叠态占位条的发送按钮不带内嵌定位标记", () => {
    const wrapper = mountComposer();

    const collapsed = wrapper.find(".cp-composer__collapsed button.cp-composer__send");
    expect(collapsed.exists()).toBe(true);
    expect(collapsed.classes()).not.toContain("cp-composer__send--overlay");
  });
});
