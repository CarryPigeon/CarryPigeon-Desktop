/**
 * @fileoverview GroupNoticeBubble 消息渲染器单测。
 * @description
 * 覆盖 group_notice domain 的渲染契约：`data` → 卡片（标题 / 正文 / 级别文案 / 时间）映射，
 * 未知级别兜底为 info，以及 data 缺失或字段类型异常时不抛错（远端消息容错路径）。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import GroupNoticeBubble from "./GroupNoticeBubble.vue";

/**
 * 挂载渲染器（stub 掉 t-icon，避免依赖宿主 TDesign 全局注册）。
 *
 * @param data - 插件消息 domain 数据。
 * @returns 组件 wrapper。
 */
function mountBubble(data: unknown) {
  return mount(GroupNoticeBubble, {
    props: { data },
    global: { stubs: { "t-icon": true } },
  });
}

describe("GroupNoticeBubble", () => {
  it("渲染标题、正文与级别文案", () => {
    const wrapper = mountBubble({
      noticeId: "n1",
      title: "服务器维护通知",
      body: "本周六 02:00-04:00 例行维护。",
      level: "warning",
      issuedAt: 1_700_000_000_000,
    });

    expect(wrapper.text()).toContain("服务器维护通知");
    expect(wrapper.text()).toContain("本周六 02:00-04:00 例行维护。");
    expect(wrapper.text()).toContain("WARNING");
    expect(wrapper.classes()).toContain("group-notice-bubble--warning");
    // issued_at 为合法毫秒时间戳时展示时间行。
    expect(wrapper.find(".group-notice-bubble__time").exists()).toBe(true);
  });

  it("三档级别各自着色，critical 文案为大写标签", () => {
    for (const level of ["info", "warning", "critical"] as const) {
      const wrapper = mountBubble({ noticeId: "n", title: "t", body: "b", level });
      expect(wrapper.classes()).toContain(`group-notice-bubble--${level}`);
      expect(wrapper.text()).toContain(level.toUpperCase());
    }
  });

  it("未知级别兜底为 info", () => {
    const wrapper = mountBubble({ noticeId: "n", title: "t", body: "b", level: "urgent" });

    expect(wrapper.classes()).toContain("group-notice-bubble--info");
    expect(wrapper.text()).toContain("INFO");
  });

  it("缺字段 / 非对象 data：不抛错且不显示时间行", () => {
    for (const data of [null, undefined, {}, "not-an-object", 42]) {
      const wrapper = mountBubble(data);
      expect(wrapper.text()).toContain("INFO");
      expect(wrapper.find(".group-notice-bubble__time").exists()).toBe(false);
    }
  });

  it("同时兼容宿主下划线命名的字段（Python/服务端风格）", () => {
    const wrapper = mountBubble({
      notice_id: "n2",
      title: "群规提醒",
      body: "请勿在公共频道发布广告内容。",
      level: "info",
      issued_at: "1700000000000",
    });

    expect(wrapper.text()).toContain("群规提醒");
    expect(wrapper.find(".group-notice-bubble__time").exists()).toBe(true);
  });
});
