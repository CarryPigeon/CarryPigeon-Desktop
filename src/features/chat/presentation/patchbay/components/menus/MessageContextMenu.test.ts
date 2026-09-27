/**
 * @fileoverview MessageContextMenu.test.ts
 * @description chat｜menus：消息右键菜单「消息本体 / 消息引用块」两种形态的渲染与动作派发验证。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import MessageContextMenu from "./MessageContextMenu.vue";

const messages = {
  zh_cn: {
    copy_message: "复制信息",
    jump_to_referenced_message: "跳转到被回复的消息",
    reply_message: "回复",
    forward_message: "转发",
    bookmark: "收藏",
    remove_bookmark: "取消收藏",
    pin_message: "置顶",
    unpin_message: "取消置顶",
    recall_message: "撤回",
    select_message: "多选",
  },
};

/**
 * 挂载消息右键菜单。
 *
 * @param props - 覆盖默认 props。
 * @returns 测试用 wrapper。
 */
function mountMenu(props: Record<string, unknown> = {}) {
  return mount(MessageContextMenu, {
    props: { open: true, x: 10, y: 10, ...props },
    global: {
      // 菜单通过 <teleport to="body"> 渲染；测试中就地渲染，便于用 wrapper 查询。
      stubs: { teleport: true },
      plugins: [createI18n({ legacy: false, locale: "zh_cn", messages })],
    },
  });
}

describe("MessageContextMenu 菜单形态", () => {
  it("默认（消息本体）形态渲染消息动作且不含跳转项", () => {
    const wrapper = mountMenu();

    const labels = wrapper.findAll(".cp-msgmenu__item").map((item) => item.text());
    expect(labels).toContain("回复");
    expect(labels).toContain("多选");
    expect(labels).not.toContain("跳转到被回复的消息");
  });

  it("引用块形态仅渲染跳转项", async () => {
    const wrapper = mountMenu({ mode: "reference" });

    const labels = wrapper.findAll(".cp-msgmenu__item").map((item) => item.text());
    expect(labels).toEqual(["跳转到被回复的消息"]);

    await wrapper.find(".cp-msgmenu__item").trigger("click");

    expect(wrapper.emitted("action")?.[0]).toEqual(["jump"]);
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
