/**
 * @fileoverview tdIconOverrides.test.ts
 * @description shared/ui/icons｜TDesign 内置图标覆盖契约：
 * 覆盖组件必须自带 `t-icon t-icon-<kebab>` class（TDesign 布局/命中区域依赖）
 * 并透传 attrs（class / onMousedown 等），否则输入框清除按钮会失去交互。
 */

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ICON_STROKE_WIDTH } from "./lucide-sprite";
import { TD_ICON_OVERRIDES, TD_ICON_OVERRIDE_KEYS } from "./tdIconOverrides";

describe("TDesign 图标覆盖", () => {
  it("覆盖组件渲染自绘 svg，并携带 TDesign 期望的 class 与 1em 尺寸", () => {
    const offenders: string[] = [];
    for (const key of TD_ICON_OVERRIDE_KEYS) {
      const component = TD_ICON_OVERRIDES[key];
      const wrapper = mount(component);
      const svg = wrapper.find("svg");
      const classes = svg.attributes("class") ?? "";
      const kebab = key
        .replace(/Icon$/u, "")
        .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
        .toLowerCase();
      if (
        !svg.exists() ||
        !classes.includes("t-icon") ||
        !classes.includes(`t-icon-${kebab}`) ||
        svg.attributes("width") !== "1em" ||
        svg.attributes("stroke-width") !== String(ICON_STROKE_WIDTH) ||
        svg.attributes("stroke") !== "currentColor"
      ) {
        offenders.push(`${key}: class="${classes}" width=${svg.attributes("width")}`);
      }
      wrapper.unmount();
    }

    expect(offenders).toEqual([]);
  });

  it("透传 attrs：TDesign 传入的 class 与 onMousedown 均生效", async () => {
    const onMousedown = vi.fn();
    const wrapper = mount(TD_ICON_OVERRIDES.CloseCircleFilledIcon, {
      attrs: { class: "t-input__suffix-clear", onMousedown },
    });

    const svg = wrapper.find("svg");
    expect(svg.attributes("class")).toContain("t-input__suffix-clear");
    await svg.trigger("mousedown");
    expect(onMousedown).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
