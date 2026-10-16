/**
 * @fileoverview PluginCenterGridHeader.test.ts
 * @description plugins｜组件：插件中心头部只保留统一返回控件，不再渲染「返回聊天」。
 */

import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import PluginCenterGridHeader from "./PluginCenterGridHeader.vue";

const i18n = createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } });

/** 挂载插件中心头部。 */
function mountHeader() {
  return mount(PluginCenterGridHeader, {
    props: { serverSocket: "ws://127.0.0.1:1", serverId: "srv-1", modulesCount: 3 },
    global: { plugins: [i18n] },
  });
}

describe("PluginCenterGridHeader", () => {
  it("渲染唯一的统一返回控件并透出 back 事件", async () => {
    const wrapper = mountHeader();

    const back = wrapper.find(".cp-back-btn");
    expect(back.exists()).toBe(true);
    expect(back.attributes("data-testid")).toBe("plugin-center-back");
    expect(back.text()).toBe(zh_cn.back);

    await back.trigger("click");
    expect(wrapper.emitted("back")).toHaveLength(1);
    wrapper.unmount();
  });

  it("不再渲染「返回聊天」按钮", () => {
    const wrapper = mountHeader();

    expect(wrapper.text()).not.toContain("返回聊天");
    expect(wrapper.findAll("button")).toHaveLength(3);
    wrapper.unmount();
  });

  it("刷新与 Domains 事件保持可用", async () => {
    const wrapper = mountHeader();

    const buttons = wrapper.findAll(".cp-plugins__headBtn");
    await buttons[0]!.trigger("click");
    await buttons[1]!.trigger("click");

    expect(wrapper.emitted("refresh")).toHaveLength(1);
    expect(wrapper.emitted("openDomains")).toHaveLength(1);
    wrapper.unmount();
  });
});
