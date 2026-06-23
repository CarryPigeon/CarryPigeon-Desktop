import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AnnotationToolbar from "../AnnotationToolbar.vue";

describe("AnnotationToolbar", () => {
  const defaultProps = {
    activeTool: "select" as const,
    strokeColor: "#ff4444",
    strokeWidth: 3,
    fontSize: 20,
    hasSelection: false,
  };

  it("renders all tool buttons (6 tools + 5 widths + 1 undo)", () => {
    const wrapper = mount(AnnotationToolbar, { props: defaultProps });
    expect(wrapper.findAll("button").length).toBe(12);
  });

  it("applies the active class to the active tool button", () => {
    const wrapper = mount(AnnotationToolbar, {
      props: { ...defaultProps, activeTool: "pen" },
    });
    const penBtn = wrapper.findAll(".cp-annotation-tool")[1];
    expect(penBtn.classes()).toContain("cp-annotation-tool--active");
  });

  it("emits toolChange with the correct tool id on click", async () => {
    const wrapper = mount(AnnotationToolbar, { props: defaultProps });
    await wrapper.findAll(".cp-annotation-tool")[0].trigger("click");
    expect(wrapper.emitted("toolChange")).toBeTruthy();
    expect(wrapper.emitted("toolChange")![0]).toEqual(["select"]);
  });

  it("emits colorChange on color swatch click", async () => {
    const wrapper = mount(AnnotationToolbar, { props: defaultProps });
    await wrapper.find(".cp-annotation-color-swatch").trigger("click");
    expect(wrapper.emitted("colorChange")).toBeTruthy();
  });

  it("emits widthChange on width button click", async () => {
    const wrapper = mount(AnnotationToolbar, { props: defaultProps });
    await wrapper.findAll(".cp-annotation-width")[0].trigger("click");
    expect(wrapper.emitted("widthChange")).toBeTruthy();
    expect(wrapper.emitted("widthChange")![0]).toEqual([2]);
  });

  it("emits undo on undo button click", async () => {
    const wrapper = mount(AnnotationToolbar, { props: defaultProps });
    const buttons = wrapper.findAll("button");
    await buttons[buttons.length - 1].trigger("click");
    expect(wrapper.emitted("undo")).toBeTruthy();
  });
});
