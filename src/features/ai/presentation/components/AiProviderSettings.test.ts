/**
 * @fileoverview AiProviderSettings 组件单测。
 * @description
 * 覆盖：配置读取与持久化、不会因回写触发的自循环、API Key 单向保存、
 * 模型列表拉取，以及"跟随服务端"时隐藏客户端字段。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { zh_cn } from "@/app/i18n/messages/zh_cn";
import { DEFAULT_AI_CONFIG, type AiProviderConfig } from "../../domain/types";

const getConfigMock = vi.fn<() => AiProviderConfig>();
const saveConfigMock = vi.fn<(c: AiProviderConfig) => AiProviderConfig>();
const getStatusMock = vi.fn();
const getSecretStatusMock = vi.fn();
const saveSecretMock = vi.fn();
const clearSecretMock = vi.fn();
const fetchModelsMock = vi.fn();

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    getAiCapabilities: () => ({
      getConfig: () => getConfigMock(),
      saveConfig: (c: AiProviderConfig) => saveConfigMock(c),
      getStatus: () => getStatusMock(),
      getSecretStatus: () => getSecretStatusMock(),
      saveSecret: (p: string, k: string) => saveSecretMock(p, k),
      clearSecret: (p: string) => clearSecretMock(p),
      fetchModels: () => fetchModelsMock(),
      summarize: vi.fn(),
    }),
  };
});

let wrapper: VueWrapper | null = null;

/** 等待一次宏任务，让 onMounted 里的异步状态刷新落地。 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 以中文 i18n 挂载组件。 */
async function mountCard(): Promise<VueWrapper> {
  const { default: AiProviderSettings } = await import("./AiProviderSettings.vue");
  return mount(AiProviderSettings, {
    global: { plugins: [createI18n({ legacy: false, locale: "zh_cn", messages: { zh_cn } })] },
  });
}

const CLIENT_CONFIG: AiProviderConfig = {
  ...DEFAULT_AI_CONFIG,
  providerId: "deepseek",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-flash",
};

describe("AiProviderSettings", () => {
  beforeEach(() => {
    getConfigMock.mockReturnValue({ ...CLIENT_CONFIG });
    saveConfigMock.mockImplementation((c) => c);
    getStatusMock.mockResolvedValue({ active: true, ready: true, secureStorageAvailable: true });
    getSecretStatusMock.mockResolvedValue({ configured: true, secureStorageAvailable: true });
    saveSecretMock.mockResolvedValue(undefined);
    clearSecretMock.mockResolvedValue(undefined);
    fetchModelsMock.mockResolvedValue({ ok: true, status: 200, models: ["deepseek-flash", "deepseek-v4-pro"] });
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  it("挂载时展示预设与就绪状态", async () => {
    wrapper = await mountCard();
    await flush();

    expect(wrapper.find('[data-testid="ai-provider"]').element).toHaveProperty("value", "deepseek");
    expect(wrapper.text()).toContain("客户端 AI 已就绪");
    // 需要密钥的 provider 显示"已配置"
    expect(wrapper.text()).toContain("已配置");
  });

  it("修改 base URL 会持久化，且不会因回写造成自循环", async () => {
    wrapper = await mountCard();
    await Promise.resolve();
    saveConfigMock.mockClear();

    const input = wrapper.find('[data-testid="ai-base-url"]');
    await input.setValue("https://api.deepseek.com/v1");
    await Promise.resolve();
    await Promise.resolve();

    expect(saveConfigMock).toHaveBeenCalled();
    // 自循环会让调用次数随微任务无限增长；这里断言落在合理范围内。
    const calls = saveConfigMock.mock.calls;
    expect(calls.length).toBeLessThan(5);
    expect(calls[calls.length - 1]![0].baseUrl).toBe("https://api.deepseek.com/v1");
  });

  it("保存 API Key：走单向 saveSecret 并清空输入框", async () => {
    wrapper = await mountCard();
    await Promise.resolve();

    const input = wrapper.find('[data-testid="ai-api-key"]');
    await input.setValue("  sk-test  ");
    await wrapper.find('[data-testid="ai-save-key"]').trigger("click");
    await Promise.resolve();
    await Promise.resolve();

    expect(saveSecretMock).toHaveBeenCalledWith("deepseek", "sk-test");
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).toContain("API Key 已保存到系统凭据管理器");
  });

  it("未输入密钥时保存按钮禁用", async () => {
    wrapper = await mountCard();
    await Promise.resolve();

    const btn = wrapper.find('[data-testid="ai-save-key"]');
    expect((btn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("拉取模型列表：成功后可渲染出选项", async () => {
    wrapper = await mountCard();
    await Promise.resolve();

    await wrapper.find('[data-testid="ai-fetch-models"]').trigger("click");
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchModelsMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain("已拉取 2 个模型");
    expect(wrapper.text()).toContain("deepseek-v4-pro");
  });

  it("拉取失败：给出带状态码的提示", async () => {
    fetchModelsMock.mockResolvedValue({ ok: false, status: 401, models: [], error: "invalid api key" });
    wrapper = await mountCard();
    await Promise.resolve();

    await wrapper.find('[data-testid="ai-fetch-models"]').trigger("click");
    await Promise.resolve();
    await Promise.resolve();

    expect(wrapper.text()).toContain("拉取模型列表失败");
    expect(wrapper.text()).toContain("HTTP 401");
  });

  it("跟随服务端：隐藏客户端 provider 字段并展示服务端状态", async () => {
    getConfigMock.mockReturnValue({ ...DEFAULT_AI_CONFIG, providerId: "server" });
    wrapper = await mountCard();
    await Promise.resolve();

    expect(wrapper.find('[data-testid="ai-base-url"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="ai-api-key"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("跟随服务端");
  });

  it("切换到需要密钥的 provider 后，未配置时展示未就绪而非已配置", async () => {
    getConfigMock.mockReturnValue({ ...DEFAULT_AI_CONFIG, providerId: "server" });
    getSecretStatusMock.mockResolvedValue({ configured: false, secureStorageAvailable: true });
    getStatusMock.mockResolvedValue({ active: true, ready: false, secureStorageAvailable: true });
    wrapper = await mountCard();
    await Promise.resolve();

    await wrapper.find('[data-testid="ai-provider"]').setValue("openai");
    await Promise.resolve();
    await Promise.resolve();

    // 切换时套用预设 base URL / 模型
    expect(saveConfigMock).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="ai-base-url"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("未就绪");
    expect(wrapper.text()).toContain("未配置");
  });

  it("补全 base URL 后状态徽标立即刷新（不回退到旧判定）", async () => {
    // 初次挂载：provider 已选 custom 但 base URL 为空 → 未就绪
    getConfigMock.mockReturnValue({ ...DEFAULT_AI_CONFIG, providerId: "custom" });
    getSecretStatusMock.mockResolvedValue({ configured: true, secureStorageAvailable: true });
    getStatusMock.mockResolvedValueOnce({ active: false, ready: false, secureStorageAvailable: true });
    getStatusMock.mockResolvedValue({ active: true, ready: true, secureStorageAvailable: true });
    wrapper = await mountCard();
    await flush();
    expect(wrapper.text()).toContain("未就绪");

    await wrapper.find('[data-testid="ai-base-url"]').setValue("http://127.0.0.1:18082/v1");
    await flush();
    await flush();

    expect(wrapper.text()).toContain("客户端 AI 已就绪");
  });
});
