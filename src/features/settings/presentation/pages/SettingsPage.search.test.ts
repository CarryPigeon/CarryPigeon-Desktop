/**
 * @fileoverview SettingsPage.search.test.ts
 * @description 设置页分区 Tab 切换、搜索与「插件设置」分区（含 catalog 锚点漂移校验）：
 * - 内置设置项索引中的每个锚点都必须真实存在于 DOM（防止改模板忘改索引）；
 * - 左栏导航即 Tab：一次只显示一个分区面板，点导航切换面板（不滚动整页）；
 * - 搜索命中内置项并跳转高亮；Esc / 清空按钮恢复分区导航；
 * - 插件设置项渲染在「插件设置」分区，可被搜索命中并跳转到插件项锚点。
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import { defineComponent, h } from "vue";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import type { PluginSettingsContribution } from "@/features/plugins/api-types";
import {
  SETTINGS_CATALOG,
  SETTINGS_SECTIONS,
  findSettingsAnchor,
} from "@/features/settings/presentation/settingsCatalog";

/** 插件设置项控件桩（用于断言宿主确实渲染了插件组件）。 */
const PluginControlStub = defineComponent({
  name: "PluginSettingsControlStub",
  setup() {
    return () => h("div", { class: "plugin-settings-control" }, "plugin-control");
  },
});

const ensureRuntimeLoaded = vi.fn(async () => {});
let contributions: PluginSettingsContribution[] = [];

vi.mock("@/features/plugins/api", () => ({
  getPluginsCapabilities: () => ({
    forServer: () => ({
      listPluginSettingsItems: () => contributions,
      ensureRuntimeLoaded,
    }),
  }),
}));

vi.mock("@/features/about/api", () => ({
  getAboutCapabilities: () => ({
    getAppInfo: async () => ({ name: "CarryPigeon", version: "0.0.0" }),
  }),
}));

let wrapper: VueWrapper | null = null;
const scrollIntoView = vi.fn();

/** 构造一条当前 server 的插件设置项。 */
function contribution(): PluginSettingsContribution {
  return {
    id: "backend",
    title: "AI 摘要后端",
    description: "选择生成总结所走的通道",
    keywords: ["后端", "backend", "服务端"],
    order: 10,
    component: PluginControlStub,
    pluginId: "ai-summary",
    serverSocket: "srv-a",
  };
}

/**
 * 挂载设置页（i18n + 内存路由；仅 stub t-dialog，搜索框为原生 input 无需 stub）。
 *
 * @returns 已挂载的 wrapper。
 */
async function mountPage(): Promise<VueWrapper> {
  const { default: SettingsPage } = await import("./SettingsPage.vue");
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/settings", component: { template: "<div />" } }],
  });
  await router.push("/settings");
  await router.isReady();

  const mounted = mount(SettingsPage, {
    attachTo: document.body,
    global: {
      plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } }), router],
      stubs: { "t-dialog": true, "t-select": true, "t-option": true, "t-switch": true },
    },
  });
  await flushPromises();
  return mounted;
}

beforeAll(() => {
  // jsdom 未实现 scrollIntoView。
  Element.prototype.scrollIntoView = scrollIntoView;
});

beforeEach(async () => {
  contributions = [];
  scrollIntoView.mockClear();
  ensureRuntimeLoaded.mockClear();
  const { currentServerSocket } = await import("@/features/server-connection/api");
  currentServerSocket.value = "srv-a";
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
});

describe("SettingsPage 设置搜索", () => {
  it("内置设置项索引的每个锚点都存在于 DOM（漂移校验）", async () => {
    wrapper = await mountPage();
    const missing = SETTINGS_CATALOG.filter((entry) => findSettingsAnchor(entry.id) === null).map(
      (entry) => entry.id,
    );
    expect(missing).toEqual([]);
  });

  it("输入查询后结果列表替换分区导航，命中内置项并跳转高亮", async () => {
    wrapper = await mountPage();
    const input = wrapper.find('[data-testid="settings-search-input"]');
    expect(input.exists()).toBe(true);
    // 无查询时展示分区导航，不展示结果列表。
    expect(wrapper.find(".cp-settings__nav").exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-search-results"]').exists()).toBe(false);

    await input.setValue("强调色");
    await flushPromises();

    const results = wrapper.find('[data-testid="settings-search-results"]');
    expect(results.exists()).toBe(true);
    expect(wrapper.find(".cp-settings__nav").exists()).toBe(false);
    expect(wrapper.find('[data-testid="settings-search-result-general-accent"]').exists()).toBe(true);
    // 结果行展示分区名。
    expect(results.text()).toContain("通用");

    await wrapper.find('[data-testid="settings-search-result-general-accent"]').trigger("click");
    await flushPromises();
    expect(scrollIntoView).toHaveBeenCalled();
    expect(findSettingsAnchor("general-accent")?.classList.contains("cp-settings__flash")).toBe(true);

    // Esc 清空后恢复分区导航。
    await input.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find('[data-testid="settings-search-results"]').exists()).toBe(false);
    expect(wrapper.find(".cp-settings__nav").exists()).toBe(true);
  });

  it("搜索命中其它分区的设置项时，先把右栏切到该分区再高亮", async () => {
    wrapper = await mountPage();
    const input = wrapper.find('[data-testid="settings-search-input"]');
    await input.setValue("全局免打扰");
    await flushPromises();

    scrollIntoView.mockClear();
    await wrapper.find('[data-testid="settings-search-result-business-global-dnd"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="settings-section-business"]').isVisible()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-general"]').isVisible()).toBe(false);
    expect(scrollIntoView).toHaveBeenCalled();

    // Esc 恢复导航后，左栏高亮落在被跳转的分区上。
    await input.trigger("keydown", { key: "Escape" });
    await flushPromises();
    expect(wrapper.find('[data-testid="settings-nav-business"]').attributes("aria-selected")).toBe("true");
  });

  it("无匹配时给出空态提示，清空按钮恢复导航", async () => {
    wrapper = await mountPage();
    const input = wrapper.find('[data-testid="settings-search-input"]');
    await input.setValue("绝不存在的设置项");
    await flushPromises();

    expect(wrapper.find('[data-testid="settings-search-results"]').text()).toContain("未找到匹配的设置项");
    expect(wrapper.find('[data-testid="settings-search-results"]').findAll(".cp-settings__result")).toHaveLength(0);

    await wrapper.find('[data-testid="settings-search-clear"]').trigger("click");
    await flushPromises();
    expect(wrapper.find(".cp-settings__nav").exists()).toBe(true);
  });

  it("无插件设置项时不渲染插件分区与导航项", async () => {
    wrapper = await mountPage();
    expect(wrapper.find('[data-testid="settings-section-plugins"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="settings-nav-plugins"]').exists()).toBe(false);
  });

  it("渲染插件设置项、可搜索、可跳转到插件项锚点", async () => {
    contributions = [contribution()];
    wrapper = await mountPage();

    // 插件分区与导航项出现，且宿主渲染了插件控件与来源标签。
    expect(wrapper.find('[data-testid="settings-nav-plugins"]').exists()).toBe(true);
    const section = wrapper.find('[data-testid="settings-section-plugins"]');
    expect(section.exists()).toBe(true);
    expect(section.find(".plugin-settings-control").exists()).toBe(true);
    expect(section.text()).toContain("ai-summary");
    expect(
      wrapper.find('[data-testid="settings-plugin-item-ai-summary-backend"]').exists(),
    ).toBe(true);

    const input = wrapper.find('[data-testid="settings-search-input"]');
    await input.setValue("摘要");
    await flushPromises();
    const result = wrapper.find('[data-testid="settings-search-result-plugin:ai-summary:backend"]');
    expect(result.exists()).toBe(true);
    expect(result.text()).toContain("插件设置");

    scrollIntoView.mockClear();
    await result.trigger("click");
    await flushPromises();
    expect(scrollIntoView).toHaveBeenCalled();
    expect(
      findSettingsAnchor("plugin:ai-summary:backend")?.classList.contains("cp-settings__flash"),
    ).toBe(true);
  });

  it("挂载时会触发一次当前 server 的插件运行时加载", async () => {
    wrapper = await mountPage();
    expect(ensureRuntimeLoaded).toHaveBeenCalledTimes(1);
  });
});

describe("SettingsPage 分区 Tab 切换", () => {
  it("默认只显示「通用」面板，且仅一个 Tab 处于选中态", async () => {
    wrapper = await mountPage();

    expect(wrapper.find('[data-testid="settings-section-general"]').isVisible()).toBe(true);
    for (const id of ["business", "data", "about"]) {
      const panel = wrapper.find(`[data-testid="settings-section-${id}"]`);
      expect(panel.exists()).toBe(true);
      expect(panel.isVisible()).toBe(false);
    }

    expect(wrapper.findAll('[role="tab"][aria-selected="true"]')).toHaveLength(1);
    const activeNav = wrapper.find('[data-testid="settings-nav-general"]');
    expect(activeNav.attributes("aria-selected")).toBe("true");
    expect(activeNav.attributes("data-active")).toBe("true");
  });

  it("点击左栏导航项切换右侧面板，且不再滚动整页", async () => {
    wrapper = await mountPage();
    scrollIntoView.mockClear();

    await wrapper.find('[data-testid="settings-nav-business"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="settings-section-business"]').isVisible()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-general"]').isVisible()).toBe(false);
    expect(wrapper.find('[data-testid="settings-nav-business"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.find('[data-testid="settings-nav-general"]').attributes("aria-selected")).toBe("false");
    // 只切面板，不再对整页做 scrollIntoView。
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("每个导航项都能切到对应面板，且该分区的设置项锚点都落在面板内", async () => {
    wrapper = await mountPage();

    for (const section of SETTINGS_SECTIONS) {
      const nav = wrapper.find(`[data-testid="settings-nav-${section.id}"]`);
      // 「插件设置」无插件项时不渲染（见下一条用例）。
      if (!nav.exists()) continue;

      await nav.trigger("click");
      await flushPromises();

      const panel = wrapper.find(`[data-testid="settings-section-${section.id}"]`);
      expect(panel.exists()).toBe(true);
      expect(panel.isVisible()).toBe(true);

      for (const other of SETTINGS_SECTIONS) {
        if (other.id === section.id) continue;
        const otherPanel = wrapper.find(`[data-testid="settings-section-${other.id}"]`);
        if (otherPanel.exists()) expect(otherPanel.isVisible()).toBe(false);
      }

      const anchors = SETTINGS_CATALOG.filter((entry) => entry.sectionId === section.id).map(
        (entry) => entry.id,
      );
      expect(
        anchors.filter(
          (anchor) => panel.element.querySelector(`[data-settings-item="${anchor}"]`) === null,
        ),
      ).toEqual([]);
    }

    // 「关于」Tab 在应用信息就绪后出现。
    expect(wrapper.find('[data-testid="settings-nav-about"]').exists()).toBe(true);
  });

  it("有插件设置项时「插件设置」可作为独立 Tab 切换", async () => {
    contributions = [contribution()];
    wrapper = await mountPage();

    expect(wrapper.find('[data-testid="settings-section-plugins"]').isVisible()).toBe(false);

    await wrapper.find('[data-testid="settings-nav-plugins"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="settings-section-plugins"]').isVisible()).toBe(true);
    expect(wrapper.find('[data-testid="settings-section-general"]').isVisible()).toBe(false);
  });
});
