/**
 * @fileoverview AiProviderSettings（插件自管 provider 设置项控件）单测。
 * @description 覆盖：预设下拉与状态胶囊、切换 provider 套用预设并标记已选、
 * 配置即时持久化到 ctx.storage、API Key 经 ctx.secrets 保存/清除（只写不读）、
 * 拉取模型列表、密钥缺失/存储不可用提示。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import type { Context } from "@/features/plugins/sdk";
import { bindContext, unbindContext } from "../host/bridge";
import { PROVIDER_CONFIG_STORAGE_KEY, resetProviderConfigForTests } from "../host/providerConfig";
import { API_KEY_SECRET_NAME } from "../domain/openaiClient";
import AiProviderSettings from "./AiProviderSettings.vue";

const storage = new Map<string, unknown>();
let secretConfigured = false;
let secureStorageAvailable = true;
let secretSetCalls: Array<{ name: string; value: string }> = [];
let secretClearCalls: Array<string> = [];
let fetchCalls: Array<{ input: string; init?: { headers?: Record<string, string> } }> = [];

/** 绑定最小宿主上下文（storage / secrets / network）。 */
function bindStubContext(): void {
  const ctx = {
    server: { lang: "zh_cn", getUid: () => "", getCid: () => "", serverSocket: "", serverId: "" },
    storage: {
      async get(key: string) {
        return storage.get(key) ?? null;
      },
      async set(key: string, value: unknown) {
        storage.set(key, value);
      },
    },
    secrets: {
      async set(name: string, value: string) {
        secretSetCalls.push({ name, value });
        secretConfigured = true;
      },
      async status(name: string) {
        return {
          configured: secretConfigured && name === API_KEY_SECRET_NAME,
          secureStorageAvailable,
        };
      },
      async clear(name: string) {
        secretClearCalls.push(name);
        secretConfigured = false;
      },
    },
    network: {
      async fetch(input: string, init?: { headers?: Record<string, string> }) {
        fetchCalls.push({ input, init });
        return {
          ok: true,
          status: 200,
          headers: {},
          bodyText: JSON.stringify({ data: [{ id: "deepseek-flash" }, { id: "deepseek-reasoner" }] }),
        };
      },
    },
  } as unknown as Context;
  bindContext(ctx);
}

let wrapper: VueWrapper | null = null;

/**
 * 挂载设置项控件。
 *
 * @returns wrapper。
 */
async function mountSettings(): Promise<VueWrapper> {
  const w = mount(AiProviderSettings);
  await flushPromises();
  return w;
}

/**
 * 读取已持久化的配置。
 */
function persistedConfig(): Record<string, unknown> {
  return storage.get(PROVIDER_CONFIG_STORAGE_KEY) as Record<string, unknown>;
}

beforeEach(() => {
  storage.clear();
  secretConfigured = false;
  secureStorageAvailable = true;
  secretSetCalls = [];
  secretClearCalls = [];
  fetchCalls = [];
  resetProviderConfigForTests();
  bindStubContext();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  unbindContext();
});

describe("AiProviderSettings", () => {
  it("默认未配置：状态胶囊提示未配置，选择框列出全部预设（无「跟随服务端」）", async () => {
    wrapper = await mountSettings();

    const options = wrapper.findAll("#ai-provider-settings-provider option");
    expect(options.map((o) => o.text())).toEqual([
      "OpenAI",
      "DeepSeek",
      "通义千问（阿里云百炼）",
      "Kimi（Moonshot）",
      "本地 Ollama",
      "自定义（OpenAI 兼容）",
    ]);
    expect(wrapper.find(".ai-provider-settings__status").attributes("data-state")).toBe("pending");
    expect(wrapper.text()).toContain("自配 AI 未配置");
  });

  it("切换 provider：套用预设 base URL/模型、标记已选择并持久化", async () => {
    wrapper = await mountSettings();

    await wrapper.find("#ai-provider-settings-provider").setValue("deepseek");
    await flushPromises();

    const config = persistedConfig();
    expect(config).toMatchObject({
      providerId: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      providerChosen: true,
    });
    expect((wrapper.find('[data-testid="ai-provider-base-url"]').element as HTMLInputElement).value).toBe(
      "https://api.deepseek.com",
    );
  });

  it("拉取模型列表：请求带密钥引用头，成功后可从下拉选择模型", async () => {
    wrapper = await mountSettings();
    await wrapper.find("#ai-provider-settings-provider").setValue("deepseek");
    await flushPromises();

    await wrapper.find('[data-testid="ai-provider-fetch-models"]').trigger("click");
    await flushPromises();

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe("https://api.deepseek.com/models");
    expect(fetchCalls[0]!.init?.headers).toMatchObject({
      authorization: "Bearer @secret(api_key)",
    });
    expect(wrapper.text()).toContain("已拉取 2 个模型");

    const pick = wrapper.find("#ai-provider-settings-model-pick");
    await pick.setValue("deepseek-reasoner");
    await flushPromises();
    expect(persistedConfig()).toMatchObject({ model: "deepseek-reasoner" });
  });

  it("保存 API Key：经 ctx.secrets 只写不读，成功后提示并更新状态", async () => {
    wrapper = await mountSettings();
    await wrapper.find("#ai-provider-settings-provider").setValue("deepseek");
    await flushPromises();

    await wrapper.find('[data-testid="ai-provider-api-key"]').setValue("sk-test");
    await wrapper.find('[data-testid="ai-provider-save-key"]').trigger("click");
    await flushPromises();

    expect(secretSetCalls).toEqual([{ name: "api_key", value: "sk-test" }]);
    expect(wrapper.text()).toContain("API Key 已保存到系统凭据管理器");
    expect(wrapper.find(".ai-provider-settings__status").attributes("data-state")).toBe("ready");
    // 输入框清空，密钥不留在 DOM。
    expect((wrapper.find('[data-testid="ai-provider-api-key"]').element as HTMLInputElement).value).toBe("");
  });

  it("清除 API Key：调用 ctx.secrets.clear 并回落未就绪状态", async () => {
    secretConfigured = true;
    wrapper = await mountSettings();
    await wrapper.find("#ai-provider-settings-provider").setValue("deepseek");
    await flushPromises();

    await wrapper.find('[data-testid="ai-provider-clear-key"]').trigger("click");
    await flushPromises();

    expect(secretClearCalls).toEqual(["api_key"]);
    expect(wrapper.find(".ai-provider-settings__status").attributes("data-state")).toBe("pending");
  });

  it("安全存储不可用：状态胶囊提示且保存失败给出可操作文案", async () => {
    secureStorageAvailable = false;
    wrapper = await mountSettings();
    await wrapper.find("#ai-provider-settings-provider").setValue("deepseek");
    await flushPromises();

    expect(wrapper.text()).toContain("系统凭据管理器不可用");
  });

  it("无需密钥的 provider（Ollama）：不渲染 API Key 区且配置完整即就绪", async () => {
    wrapper = await mountSettings();
    await wrapper.find("#ai-provider-settings-provider").setValue("ollama");
    await flushPromises();

    expect(wrapper.find('[data-testid="ai-provider-api-key"]').exists()).toBe(false);
    expect(wrapper.find(".ai-provider-settings__status").attributes("data-state")).toBe("ready");
    expect(persistedConfig()).toMatchObject({
      providerId: "ollama",
      baseUrl: "http://localhost:11434/v1",
    });
  });
});
