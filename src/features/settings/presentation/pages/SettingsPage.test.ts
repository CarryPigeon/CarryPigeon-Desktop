/**
 * @fileoverview SettingsPage.test.ts
 * @description settings｜页面：退出登录已从设置页移出（改由「服务器管理」按服务器执行）。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import { zh_cn } from "@/app/i18n/messages/zh_cn";

vi.mock("@/features/about/api", () => ({
  getAboutCapabilities: () => ({
    getAppInfo: async () => ({ name: "CarryPigeon", version: "0.0.0" }),
  }),
}));

// 设置页会读取「当前 server 插件注册的设置项」并触发一次运行时加载：
// 本测试只关心页面外壳，故把 plugins 能力面隔离为无贡献、无副作用的桩，
// 避免在 jsdom 中尝试真实加载插件产物（噪声与耗时）。
vi.mock("@/features/plugins/api", () => ({
  getPluginsCapabilities: () => ({
    forServer: () => ({
      listPluginSettingsItems: () => [],
      ensureRuntimeLoaded: async () => {},
    }),
  }),
}));

let wrapper: VueWrapper | null = null;

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe("SettingsPage", () => {
  it("不再渲染退出登录入口（已移至服务器管理）", async () => {
    const { default: SettingsPage } = await import("./SettingsPage.vue");
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/settings", component: { template: "<div />" } }] });
    await router.push("/settings");
    await router.isReady();

    wrapper = mount(SettingsPage, {
      global: {
        plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } }), router],
        stubs: { "t-input": true, "t-select": true, "t-option": true, "t-dialog": true, "t-switch": true },
      },
    });
    await Promise.resolve();

    expect(wrapper.find('[data-testid="settings-logout"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("退出登录");
    // 空置的「账号」分区与导航项也应一并移除
    expect(wrapper.find('[data-testid="settings-section-account"]').exists()).toBe(false);
    expect(wrapper.findAll(".cp-settings__navBtn").some((btn) => btn.text().includes("账号"))).toBe(false);
  });

  it("页头只保留统一返回按钮，不再渲染「进入聊天」入口", async () => {
    const { default: SettingsPage } = await import("./SettingsPage.vue");
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/settings", component: { template: "<div />" } }] });
    await router.push("/settings");
    await router.isReady();

    wrapper = mount(SettingsPage, {
      global: {
        plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } }), router],
        stubs: { "t-input": true, "t-select": true, "t-option": true, "t-dialog": true, "t-switch": true },
      },
    });
    await Promise.resolve();

    const backButtons = wrapper.findAll(".cp-back-btn");
    expect(backButtons).toHaveLength(1);
    expect(backButtons[0]!.attributes("data-testid")).toBe("page-header-back");

    expect(wrapper.find('[data-testid="settings-open-patchbay"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("进入聊天");
  });
});
