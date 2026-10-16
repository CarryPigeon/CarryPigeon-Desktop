/**
 * @fileoverview AiSummarySettings（插件设置项控件）单测。
 * @description 覆盖：三档选项渲染与当前档高亮、点击切换并持久化、载入已保存档位、保存失败提示。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { Context } from "@/features/plugins/sdk";
import { bindContext, unbindContext } from "../host/bridge";
import { resetBackendPreferenceForTests, useBackendPreference } from "../host/backendPreference";
import { SUMMARIZE_BACKEND_STORAGE_KEY, type SummarizeBackend } from "../domain/summarizeBackend";
import AiSummarySettings from "./AiSummarySettings.vue";

const storage = new Map<string, unknown>();
let saveShouldFail = false;
let wrapper: VueWrapper | null = null;

/** 绑定最小宿主上下文（仅需 server.lang 与 storage）。 */
function bindStubContext(): void {
  const ctx = {
    server: { lang: "zh_cn", getUid: () => "", getCid: () => "", serverSocket: "", serverId: "" },
    storage: {
      async get(key: string) {
        return storage.get(key) ?? null;
      },
      async set(key: string, value: unknown) {
        if (saveShouldFail) throw new Error("boom");
        storage.set(key, value);
      },
    },
  } as unknown as Context;
  bindContext(ctx);
}

/**
 * 挂载设置项控件。
 *
 * @returns wrapper。
 */
function mountSettings(): VueWrapper {
  return mount(AiSummarySettings);
}

beforeEach(() => {
  storage.clear();
  saveShouldFail = false;
  resetBackendPreferenceForTests();
  bindStubContext();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  unbindContext();
});

describe("AiSummarySettings", () => {
  it("渲染三档选项，默认高亮「自动」", async () => {
    wrapper = mountSettings();
    await flushPromises();

    const options = wrapper.findAll(".ai-summary-settings__option");
    expect(options.map((option) => option.text())).toEqual(["自动", "仅客户端 AI", "仅服务端"]);
    expect(wrapper.find('[data-testid="ai-summary-backend-auto"]').attributes("data-active")).toBe("true");
    expect(wrapper.text()).toContain("优先使用客户端 AI");
  });

  it("载入已保存档位并展示对应说明", async () => {
    storage.set(SUMMARIZE_BACKEND_STORAGE_KEY, "server");
    wrapper = mountSettings();
    await flushPromises();

    expect(useBackendPreference().value).toBe("server");
    expect(wrapper.find('[data-testid="ai-summary-backend-server"]').attributes("data-active")).toBe("true");
    expect(wrapper.text()).toContain("只使用聊天服务端");
  });

  it("点击切换档位：立即生效并持久化", async () => {
    wrapper = mountSettings();
    await flushPromises();

    await wrapper.find('[data-testid="ai-summary-backend-client"]').trigger("click");
    await flushPromises();

    expect(useBackendPreference().value).toBe("client");
    expect(storage.get(SUMMARIZE_BACKEND_STORAGE_KEY)).toBe("client");
    expect(wrapper.find('[data-testid="ai-summary-backend-client"]').attributes("data-active")).toBe("true");
    expect(wrapper.text()).toContain("只使用客户端 AI");
  });

  it("持久化失败：保留已选档位并提示失败", async () => {
    wrapper = mountSettings();
    await flushPromises();
    saveShouldFail = true;

    await wrapper.find('[data-testid="ai-summary-backend-server"]').trigger("click");
    await flushPromises();

    expect(useBackendPreference().value).toBe("server");
    expect(wrapper.text()).toContain("后端偏好保存失败");
  });

  it("未绑定上下文（异常环境）时保持默认档位且不抛错", async () => {
    unbindContext();
    wrapper = mountSettings();
    await flushPromises();

    expect(useBackendPreference().value).toBe("auto");
    expect(wrapper.findAll(".ai-summary-settings__option")).toHaveLength(3);
  });

  it("档位标签可被外部状态驱动（同一模块级状态供面板与设置项共享）", async () => {
    wrapper = mountSettings();
    await flushPromises();
    useBackendPreference().value = "server" satisfies SummarizeBackend;

    await flushPromises();
    expect(wrapper.find('[data-testid="ai-summary-backend-server"]').attributes("data-active")).toBe("true");
  });
});
