/**
 * @fileoverview CoreTextMessageBubble.test.ts
 * @description message-flow｜presentation：消息引用块（回复 / 引用预览）右键跳转事件验证。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import CoreTextMessageBubble from "./CoreTextMessageBubble.vue";

/**
 * 挂载消息气泡。
 *
 * @param props - 覆盖默认 props。
 * @returns 测试用 wrapper。
 */
function mountBubble(props: Record<string, unknown> = {}) {
  return mount(CoreTextMessageBubble, {
    props: { messageId: "m1", text: "hello", ...props },
    global: {
      // 断言按钮 aria-label 时使用真实文案。
      plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } })],
      // vitest 未启用 TDesign 自动导入解析器，桩掉图标组件即可（不影响按钮行为断言）。
      stubs: { "t-icon": true },
    },
  });
}

/**
 * 读取首次派发的引用菜单载荷。
 *
 * @param wrapper - 测试用 wrapper。
 * @returns 被引用消息 id；未派发时返回 null。
 */
function emittedReferenceId(wrapper: ReturnType<typeof mountBubble>): string | null {
  const events = wrapper.emitted("openReferenceMenu");
  if (!events || events.length === 0) return null;
  return (events[0][0] as { messageId: string }).messageId;
}

describe("CoreTextMessageBubble 引用块右键", () => {
  it("右键回复摘要派发被回复消息 id", async () => {
    const wrapper = mountBubble({
      reply: { messageId: "m0", senderName: "Alice", preview: "hi", createdAt: 1 },
    });

    const block = wrapper.find(".cp-coreText__reply");
    expect(block.classes()).toContain("cp-coreText__reply--jumpable");

    await block.trigger("contextmenu");

    expect(emittedReferenceId(wrapper)).toBe("m0");
  });

  it("右键内联引用派发被引用消息 id", async () => {
    const wrapper = mountBubble({
      quoteReply: { messageId: "q1", userId: "u1", preview: "quote" },
    });

    const block = wrapper.find(".cp-quoteReply");
    expect(block.classes()).toContain("cp-quoteReply--jumpable");

    await block.trigger("contextmenu");

    expect(emittedReferenceId(wrapper)).toBe("q1");
  });

  it("仅凭 replyToId 渲染的迷你引用的右键同样可跳转", async () => {
    const wrapper = mountBubble({ replyText: "Alice: hi", replyToId: "m0" });

    const block = wrapper.find(".cp-replyMini");
    expect(block.classes()).toContain("cp-replyMini--jumpable");

    await block.trigger("contextmenu");

    expect(emittedReferenceId(wrapper)).toBe("m0");
  });

  it("原消息不可用时右键不拦截事件（交由消息行菜单处理）", async () => {
    const wrapper = mountBubble({
      reply: { messageId: "m0", senderName: "Alice", preview: "hi", createdAt: 1, unavailable: true },
    });

    const block = wrapper.find(".cp-coreText__reply");
    expect(block.classes()).not.toContain("cp-coreText__reply--jumpable");

    await block.trigger("contextmenu");

    expect(wrapper.emitted("openReferenceMenu")).toBeUndefined();
  });

  it("无引用内容时不渲染引用块", () => {
    const wrapper = mountBubble();

    expect(wrapper.find(".cp-coreText__reply").exists()).toBe(false);
    expect(wrapper.find(".cp-quoteReply").exists()).toBe(false);
    expect(wrapper.find(".cp-replyMini").exists()).toBe(false);
  });
});

describe("CoreTextMessageBubble 引用块跳转按钮", () => {
  it("回复摘要渲染「跳转到被回复的消息」按钮并派发被回复消息 id", async () => {
    const wrapper = mountBubble({
      reply: { messageId: "m0", senderName: "Alice", preview: "hi", createdAt: 1 },
    });

    const button = wrapper.find(".cp-coreText__reply .cp-jumpRef");
    expect(button.exists()).toBe(true);
    expect(button.attributes("aria-label")).toBe(zh_cn.jump_to_referenced_message);

    await button.trigger("click");

    expect(wrapper.emitted("jumpReference")?.[0]).toEqual(["m0"]);
  });

  it("内联引用渲染跳转按钮并派发被引用消息 id", async () => {
    const wrapper = mountBubble({
      quoteReply: { messageId: "q1", userId: "u1", preview: "quote" },
    });

    const button = wrapper.find(".cp-quoteReply .cp-jumpRef");
    expect(button.exists()).toBe(true);

    await button.trigger("click");

    expect(wrapper.emitted("jumpReference")?.[0]).toEqual(["q1"]);
  });

  it("仅有 replyToId 的迷你引用渲染跳转按钮", async () => {
    const wrapper = mountBubble({ replyText: "Alice: hi", replyToId: "m0" });

    const button = wrapper.find(".cp-replyMini .cp-jumpRef");
    expect(button.exists()).toBe(true);

    await button.trigger("click");

    expect(wrapper.emitted("jumpReference")?.[0]).toEqual(["m0"]);
  });

  it("原消息不可用时不渲染跳转按钮", () => {
    const wrapper = mountBubble({
      reply: { messageId: "m0", senderName: "Alice", preview: "hi", createdAt: 1, unavailable: true },
    });

    expect(wrapper.find(".cp-coreText__reply .cp-jumpRef").exists()).toBe(false);
  });
});
