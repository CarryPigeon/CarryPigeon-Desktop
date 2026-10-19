/**
 * @fileoverview SectionHead.test.ts
 * @description shared/ui｜分区头：图标/标题/副标题/操作槽渲染。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SectionHead from "./SectionHead.vue";

describe("SectionHead", () => {
  it("渲染图标瓦片、标题与副标题", () => {
    const wrapper = mount(SectionHead, {
      props: { icon: "setting", title: "通用偏好", subtitle: "主题、语言与启动行为" },
    });

    expect(wrapper.find(".cp-section-head__icon").exists()).toBe(true);
    expect(wrapper.find(".cp-section-head__title").text()).toBe("通用偏好");
    expect(wrapper.find(".cp-section-head__sub").text()).toBe("主题、语言与启动行为");
  });

  it("无图标/副标题时不渲染空节点，操作槽可注入", () => {
    const wrapper = mount(SectionHead, {
      props: { title: "插件设置" },
      slots: { actions: '<button class="custom-action">动作</button>' },
    });

    expect(wrapper.find(".cp-section-head__icon").exists()).toBe(false);
    expect(wrapper.find(".cp-section-head__sub").exists()).toBe(false);
    expect(wrapper.find(".custom-action").exists()).toBe(true);
  });
});
