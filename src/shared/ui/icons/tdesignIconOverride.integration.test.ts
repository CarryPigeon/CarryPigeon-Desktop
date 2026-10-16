/**
 * @fileoverview tdesignIconOverride.integration.test.ts
 * @description shared/ui/icons｜端到端校验 TDesign 组件内置图标确实被自绘图标替换：
 * 通过 `<t-config-provider :global-config="{ icon: TD_ICON_OVERRIDES }">` 包裹真实 TDesign 组件，
 * 断言渲染出的内置图标（如 t-input 的清除按钮）满足自绘契约。
 */

import { describe, expect, it } from "vitest";
import { h } from "vue";
import { mount } from "@vue/test-utils";
import { ConfigProvider, Input } from "tdesign-vue-next";
import { ICON_STROKE_WIDTH } from "./lucide-sprite";
import { TD_ICON_OVERRIDES } from "./tdIconOverrides";

/**
 * 在 TDesign 全局图标配置下挂载子组件。
 *
 * @param child - 需要挂载的 TDesign 组件。
 * @returns 挂载后的包装器。
 */
function mountWithIconOverrides(child: ReturnType<typeof h>) {
  return mount(ConfigProvider, {
    props: { globalConfig: { icon: TD_ICON_OVERRIDES } },
    slots: { default: () => child },
  });
}

describe("TDesign 内置图标覆盖（集成）", () => {
  it("t-input 的清除按钮渲染自绘图标且保持点击透传", async () => {
    const wrapper = mountWithIconOverrides(
      h(Input, { modelValue: "abc", clearable: true, onUpdate: { modelValue: () => {} } }),
    );

    // TDesign 仅在 hover / focus 时渲染清除按钮
    await wrapper.find(".t-input").trigger("mouseenter");

    const clear = wrapper.find(".t-input__suffix-clear");
    expect(clear.exists()).toBe(true);
    expect(clear.element.tagName.toLowerCase()).toBe("svg");
    expect(clear.attributes("stroke-width")).toBe(String(ICON_STROKE_WIDTH));
    expect(clear.attributes("stroke")).toBe("currentColor");
    // 自绘 class 必须同时保留 TDesign 期望的 t-icon class（布局与命中区域依赖）
    expect(clear.attributes("class")).toContain("t-icon");
    wrapper.unmount();
  });
});
