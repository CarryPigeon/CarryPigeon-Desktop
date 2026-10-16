/**
 * @fileoverview BackButton.test.ts
 * @description shared/ui｜组件：统一返回按钮的文案、testid 与交互契约。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import BackButton from "./BackButton.vue";

const i18n = createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } });

/** 以指定 props 挂载返回按钮。 */
function mountButton(props: Record<string, unknown> = {}) {
  return mount(BackButton, { props, global: { plugins: [i18n] } });
}

describe("BackButton", () => {
  it("默认使用 i18n back 文案与默认 testid", () => {
    const wrapper = mountButton();

    expect(wrapper.find(".cp-back-btn").text()).toBe(zh_cn.back);
    expect(wrapper.find(".cp-back-btn").attributes("data-testid")).toBe("page-back");
    wrapper.unmount();
  });

  it("label 非空时覆盖 i18n 文案，空字符串仍回退", () => {
    const custom = mountButton({ label: "回枢纽" });
    expect(custom.find(".cp-back-btn").text()).toBe("回枢纽");
    custom.unmount();

    const blank = mountButton({ label: "   " });
    expect(blank.find(".cp-back-btn").text()).toBe(zh_cn.back);
    blank.unmount();
  });

  it("testId 可覆盖，便于各页面定位", () => {
    const wrapper = mountButton({ testId: "settings-header-back" });

    expect(wrapper.find(".cp-back-btn").attributes("data-testid")).toBe("settings-header-back");
    wrapper.unmount();
  });

  it("点击触发一次 click 事件", async () => {
    const wrapper = mountButton();

    await wrapper.find(".cp-back-btn").trigger("click");

    expect(wrapper.emitted("click")).toHaveLength(1);
    wrapper.unmount();
  });
});
