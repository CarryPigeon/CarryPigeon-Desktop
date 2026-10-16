/**
 * @fileoverview PageHeader.test.ts
 * @description shared/ui｜组件：页面头部返回按钮复用统一控件，标题/副标题/操作槽渲染正确。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import PageHeader from "./PageHeader.vue";
import BackButton from "./BackButton.vue";

const i18n = createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } });

/** 以指定 props 挂载页面头部。 */
function mountHeader(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(PageHeader, { props: { title: "标题", ...props }, slots, global: { plugins: [i18n] } });
}

describe("PageHeader", () => {
  it("back 为假时不渲染返回按钮", () => {
    const wrapper = mountHeader();

    expect(wrapper.findComponent(BackButton).exists()).toBe(false);
    wrapper.unmount();
  });

  it("back 为真时返回按钮为统一共享控件且保留既有 testid", async () => {
    const wrapper = mount(PageHeader, {
      props: { title: "标题", back: true },
      attrs: { "data-testid": "settings-header" },
      global: { plugins: [i18n] },
    });

    const back = wrapper.find('[data-testid="page-header-back"]');
    expect(wrapper.findComponent(BackButton).exists()).toBe(true);
    expect(back.exists()).toBe(true);
    expect(back.classes()).toContain("cp-back-btn");
    expect(back.text()).toBe(zh_cn.back);
    // 页面级 data-testid 仍落在 <header> 根节点上
    expect(wrapper.find("header").attributes("data-testid")).toBe("settings-header");

    await back.trigger("click");
    expect(wrapper.emitted("back")).toHaveLength(1);
    wrapper.unmount();
  });

  it("backLabel 覆盖默认文案", () => {
    const wrapper = mountHeader({ back: true, backLabel: "回列表" });

    expect(wrapper.find(".cp-back-btn").text()).toBe("回列表");
    wrapper.unmount();
  });

  it("渲染标题、副标题与操作槽，副标题为空时不渲染", () => {
    const wrapper = mountHeader(
      { title: "设置", subtitle: "通用 · 数据" },
      { actions: "<button class=\"custom-action\">动作</button>" },
    );

    expect(wrapper.find(".cp-page-header__name").text()).toBe("设置");
    expect(wrapper.find(".cp-page-header__sub").text()).toBe("通用 · 数据");
    expect(wrapper.find(".custom-action").exists()).toBe(true);
    wrapper.unmount();

    const withoutSub = mountHeader({ title: "设置" });
    expect(withoutSub.find(".cp-page-header__sub").exists()).toBe(false);
    withoutSub.unmount();
  });
});
