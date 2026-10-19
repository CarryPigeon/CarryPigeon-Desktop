/**
 * @fileoverview PanelSwitch.test.ts
 * @description shared/ui｜开关组件：可访问性与状态切换。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import PanelSwitch from "./PanelSwitch.vue";

describe("PanelSwitch", () => {
  it("以 role=switch 暴露开关状态与可访问名称", () => {
    const wrapper = mount(PanelSwitch, {
      props: { modelValue: false, label: "自动登录" },
    });
    const button = wrapper.get("button");
    expect(button.attributes("role")).toBe("switch");
    expect(button.attributes("aria-checked")).toBe("false");
    expect(button.attributes("aria-label")).toBe("自动登录");
  });

  it("点击时向父组件发出取反后的值", async () => {
    const wrapper = mount(PanelSwitch, {
      props: { modelValue: false, label: "开关" },
    });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([true]);
  });

  it("禁用时不发出事件", async () => {
    const wrapper = mount(PanelSwitch, {
      props: { modelValue: true, label: "开关", disabled: true },
    });
    const button = wrapper.get("button");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });
});
