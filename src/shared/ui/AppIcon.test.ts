/**
 * @fileoverview AppIcon.test.ts
 * @description shared/ui｜组件：自绘图标契约（stroke-only、24×24、currentColor、1.75、round）
 * 与注册表完整性兜底。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AppIcon from "./AppIcon.vue";
import { ICON_STROKE_WIDTH, LUCIDE_SPRITE } from "./icons/lucide-sprite";

describe("AppIcon", () => {
  it("渲染自绘 svg 并满足统一契约", () => {
    const wrapper = mount(AppIcon, { props: { name: "close" } });
    const svg = wrapper.find("svg.app-icon");

    expect(svg.exists()).toBe(true);
    expect(svg.attributes("viewBox")).toBe("0 0 24 24");
    expect(svg.attributes("fill")).toBe("none");
    expect(svg.attributes("stroke")).toBe("currentColor");
    expect(svg.attributes("stroke-width")).toBe(String(ICON_STROKE_WIDTH));
    expect(svg.attributes("stroke-linecap")).toBe("round");
    expect(svg.attributes("stroke-linejoin")).toBe("round");
    wrapper.unmount();
  });

  it("默认尺寸为 1em（跟随容器 font-size）", () => {
    const wrapper = mount(AppIcon, { props: { name: "close" } });

    expect(wrapper.find("svg.app-icon").attributes("width")).toBe("1em");
    expect(wrapper.find("svg.app-icon").attributes("height")).toBe("1em");
    wrapper.unmount();
  });

  it("数字尺寸转换为 px", () => {
    const wrapper = mount(AppIcon, { props: { name: "close", size: 18 } });

    expect(wrapper.find("svg.app-icon").attributes("width")).toBe("18px");
    wrapper.unmount();
  });

  it("title 非空时具备 img 语义", () => {
    const wrapper = mount(AppIcon, { props: { name: "close", title: "关闭" } });
    const svg = wrapper.find("svg.app-icon");

    expect(svg.attributes("role")).toBe("img");
    expect(svg.attributes("aria-hidden")).toBeUndefined();
    expect(wrapper.find("title").text()).toBe("关闭");
    wrapper.unmount();
  });

  it("未知图标名降级为可见兜底标记", () => {
    const wrapper = mount(AppIcon, { props: { name: "not-an-icon" } });

    expect(wrapper.find("svg.app-icon").exists()).toBe(false);
    expect(wrapper.find(".app-icon--missing").text()).toBe("?");
    wrapper.unmount();
  });

  it("注册表内每个图标都包含可绘制图形", () => {
    const emptyKeys: string[] = [];
    for (const key of Object.keys(LUCIDE_SPRITE)) {
      const wrapper = mount(AppIcon, { props: { name: key } });
      const drawn = wrapper.find("svg.app-icon").element.querySelectorAll("path, circle, rect, line, polyline, ellipse, polygon");
      if (drawn.length === 0) emptyKeys.push(key);
      wrapper.unmount();
    }

    expect(emptyKeys).toEqual([]);
  });
});
