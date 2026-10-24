/**
 * @fileoverview AiSummaryHost 面板单测。
 * @description
 * 覆盖：读取当前频道而非手动粘贴、无频道/空频道/旧宿主提示、缓存新鲜与过期语义、
 * 「加载更多历史」翻页后自动重新生成、缓存不落消息正文、自配 provider（经
 * `ctx.network.fetch` 直连 + `ctx.secrets` 密钥预检）优先/回退/失败语义与重复点击保护，
 * 以及参与范围（时间范围 + 聊天区多选）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type {
  PluginChannelHistoryLoadResult,
  PluginChannelMessage,
  PluginCurrentChannelMessagesSnapshot,
} from "@/features/plugins/api-types";
import type { Context } from "@/features/plugins/sdk";
import { bindContext, unbindContext } from "../host/bridge";
import { resetBackendPreferenceForTests } from "../host/backendPreference";
import { resetProviderConfigForTests, PROVIDER_CONFIG_STORAGE_KEY } from "../host/providerConfig";
import { SUMMARIZE_BACKEND_STORAGE_KEY, type SummarizeBackend } from "../domain/summarizeBackend";
import type { AiProviderConfig } from "../domain/aiProvider";
import { computeScopeFingerprint } from "../domain/summarizeScope";
import AiSummaryHost from "./AiSummaryHost.vue";

/** 受控按钮 stub：转发 click，保证测试可点击。 */
const ButtonStub = defineComponent({
  name: "TButton",
  props: {
    size: { type: String, default: "" },
    variant: { type: String, default: "" },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: ["click"],
  setup(props, { slots, emit }) {
    return () =>
      h(
        "button",
        {
          type: "button",
          disabled: props.disabled,
          onClick: () => emit("click"),
        },
        slots.default?.(),
      );
  },
});

/** 日期区间选择器 stub：暴露 `emit` 供测试直接驱动范围变化。 */
const RangePickerStub = defineComponent({
  name: "TDateRangePicker",
  props: {
    modelValue: { type: Array, default: () => [] },
    placeholder: { type: Array, default: () => [] },
    clearable: { type: Boolean, default: false },
    enableTimePicker: { type: Boolean, default: false },
    size: { type: String, default: "" },
  },
  emits: ["update:modelValue"],
  setup() {
    return () => h("div", { class: "stub-range-picker" });
  },
});

type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};
type FetchResponse = { ok: boolean; status: number; bodyText: string; headers: Record<string, string> };

const storage = new Map<string, unknown>();
let fetchImpl: (input: string, init?: FetchInit) => Promise<FetchResponse>;
let fetchCalls: Array<{ input: string; init?: FetchInit }> = [];
/** API Key（`ctx.secrets.status("api_key")`）是否已配置。 */
let secretConfigured = true;
let secretStatusCalls = 0;
/** `ctx.network` 是否注入；false 表示旧宿主（无网络能力）。 */
let networkEnabled = true;
/** `ctx.messages` 是否注入；false 表示旧宿主（无读取能力）。 */
let messagesApiEnabled = true;
let messagesState: PluginCurrentChannelMessagesSnapshot;
let loadMoreImpl: (() => Promise<PluginChannelHistoryLoadResult>) | null = null;
let readCalls = 0;
let loadMoreCalls = 0;

/**
 * 构造频道消息。
 *
 * @param messageId - 消息 id。
 * @param text - 文本投影。
 * @param timeMs - 发送时间（ms）。
 * @returns 插件可见消息。
 */
function message(messageId: string, text: string, timeMs = 1): PluginChannelMessage {
  return { messageId, senderId: "u1", senderName: "Alice", timeMs, text };
}

/**
 * 构造读取快照。
 *
 * @param messages - 消息列表。
 * @param overrides - 覆盖字段（如 hasMoreHistory、selectedMessageIds）。
 * @returns 快照。
 */
function snapshotOf(
  messages: PluginChannelMessage[],
  overrides: Partial<PluginCurrentChannelMessagesSnapshot> = {},
): PluginCurrentChannelMessagesSnapshot {
  return {
    channelId: "c1",
    channelName: "研发",
    totalCount: messages.length,
    truncated: false,
    hasMoreHistory: false,
    capturedAtMs: 1000,
    messages,
    selectedMessageIds: [],
    selectedTotalCount: 0,
    ...overrides,
  };
}

/**
 * 预设自配 provider 配置（写入插件存储，模拟设置项已保存）。
 *
 * @param overrides - 覆盖字段（如 baseUrl 置空模拟配置不完整）。
 */
function persistProviderConfig(overrides: Partial<AiProviderConfig> = {}): void {
  const config: AiProviderConfig = {
    providerId: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    systemPrompt: "",
    temperature: 0.3,
    timeoutMs: 30000,
    providerChosen: true,
    ...overrides,
  };
  storage.set(PROVIDER_CONFIG_STORAGE_KEY, config);
}

/** 服务端 `/api/ai/summarize` 的成功响应。 */
function serverOkResponse(summary: string, messageCount: number): FetchResponse {
  return {
    ok: true,
    status: 200,
    bodyText: JSON.stringify({ summary, channel_id: "c1", message_count: messageCount }),
    headers: {},
  };
}

/** OpenAI 兼容 `chat/completions` 的成功响应。 */
function chatOkResponse(summary: string, model = "deepseek-flash"): FetchResponse {
  return {
    ok: true,
    status: 200,
    bodyText: JSON.stringify({
      choices: [{ message: { role: "assistant", content: summary } }],
      model,
    }),
    headers: {},
  };
}

/**
 * 默认 fetch 路由：按 URL 分流到服务端端点或 provider 端点。
 *
 * @param input - 请求 URL。
 * @returns 模拟响应。
 */
function routedFetch(input: string): Promise<FetchResponse> {
  if (input.startsWith("/api/ai/summarize")) {
    return Promise.resolve(serverOkResponse("默认总结", 2));
  }
  if (input.endsWith("/chat/completions")) {
    return Promise.resolve(chatOkResponse("自配总结"));
  }
  return Promise.resolve({ ok: false, status: 404, bodyText: "", headers: {} });
}

/** 绑定 stub 宿主上下文（storage / 可选 network / secrets / 可选 messages）。 */
function bindStubContext(): void {
  const messages = messagesApiEnabled
    ? {
        readCurrentChannel: async () => {
          readCalls += 1;
          return messagesState;
        },
        loadMoreHistory: async () => {
          loadMoreCalls += 1;
          return loadMoreImpl ? loadMoreImpl() : { loadedCount: 0, loadedDelta: 0, hasMore: false };
        },
      }
    : undefined;
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
    network: networkEnabled
      ? {
          fetch(input: string, init?: FetchInit) {
            fetchCalls.push({ input, init });
            return fetchImpl(input, init);
          },
        }
      : undefined,
    secrets: {
      async status(name: string) {
        secretStatusCalls += 1;
        return {
          configured: secretConfigured && name === "api_key",
          secureStorageAvailable: true,
        };
      },
      async set() {},
      async clear() {},
    },
    messages,
  } as unknown as Context;
  bindContext(ctx);
}

/**
 * 挂载面板（不自动打开）。
 *
 * @returns 面板 wrapper 与 summarize 入口。
 */
async function mountHost(): Promise<{
  wrapper: ReturnType<typeof mount>;
  summarize(channelId: string): Promise<void>;
}> {
  bindStubContext();
  const wrapper = mount(AiSummaryHost, {
    global: {
      stubs: { AppIcon: true, "t-button": ButtonStub, "t-date-range-picker": RangePickerStub },
    },
  });
  const vm = wrapper.vm as unknown as {
    summarize(c: string): Promise<void>;
  };
  return {
    wrapper,
    summarize: (channelId: string) => vm.summarize(channelId),
  };
}

/**
 * 点击「加载更多历史」并等待异步链路（翻页 → 重读 → 重新生成）结束。
 *
 * @param wrapper - 面板 wrapper。
 */
async function clickLoadMore(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find(".ai-summary-panel__load-more").trigger("click");
  await flushPromises();
}

/**
 * 点击「生成总结 / 重新生成」并等待异步链路结束。
 *
 * @param wrapper - 面板 wrapper。
 */
async function clickRun(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find(".ai-summary-panel__run").trigger("click");
  await flushPromises();
}

/**
 * 点击范围 chip（"全部" / "聊天中已选"）并等待异步链路结束。
 *
 * @param wrapper - 面板 wrapper。
 * @param index - chip 序号（0 = 全部，1 = 聊天中已选）。
 */
async function clickScopeChip(wrapper: ReturnType<typeof mount>, index: number): Promise<void> {
  await wrapper.findAll(".ai-summary-panel__scope-chip")[index]!.trigger("click");
  await flushPromises();
}

/**
 * 点击时间范围快捷按钮。
 *
 * @param wrapper - 面板 wrapper。
 * @param label - 按钮文案。
 */
async function clickQuickRange(wrapper: ReturnType<typeof mount>, label: string): Promise<void> {
  const target = wrapper.findAll(".ai-summary-panel__range-quick").find((btn) => btn.text() === label);
  if (!target) throw new Error(`quick range button not found: ${label}`);
  await target.trigger("click");
  await flushPromises();
}

/**
 * 通过日期区间选择器 stub 驱动自定义范围。
 *
 * @param wrapper - 面板 wrapper。
 * @param range - 起止时间（`undefined` 表示清除该侧）。
 */
async function setPickerRange(
  wrapper: ReturnType<typeof mount>,
  range: [Date | undefined, Date | undefined],
): Promise<void> {
  const picker = wrapper.findComponent({ name: "TDateRangePicker" });
  picker.vm.$emit("update:modelValue", range.filter((item) => item != null));
  await flushPromises();
}

describe("AiSummaryHost", () => {
  beforeEach(() => {
    storage.clear();
    fetchCalls = [];
    secretConfigured = true;
    secretStatusCalls = 0;
    networkEnabled = true;
    messagesApiEnabled = true;
    messagesState = snapshotOf([message("m1", "第一条"), message("m2", "第二条")]);
    loadMoreImpl = null;
    readCalls = 0;
    loadMoreCalls = 0;
    fetchImpl = (input) => routedFetch(input);
    // 后端偏好与 provider 配置是模块级状态：每个用例重置，避免相互污染。
    resetBackendPreferenceForTests();
    resetProviderConfigForTests();
    bindStubContext();
  });

  afterEach(() => {
    unbindContext();
  });

  it("未选择频道：给出可操作提示且不读取不请求", async () => {
    const { wrapper, summarize } = await mountHost();

    await summarize("");

    expect(wrapper.text()).toContain("请先选择一个频道");
    expect(readCalls).toBe(0);
    expect(fetchCalls).toHaveLength(0);
  });

  it("旧宿主未注入 host.messages：提示升级客户端，不发起请求", async () => {
    messagesApiEnabled = false;
    const { wrapper, summarize } = await mountHost();

    await summarize("c1");

    expect(wrapper.text()).toContain("当前客户端版本不支持读取频道消息");
    expect(fetchCalls).toHaveLength(0);
  });

  it("频道无消息：提示且不发起请求", async () => {
    messagesState = snapshotOf([]);
    const { wrapper, summarize } = await mountHost();

    await summarize("c1");

    expect(wrapper.text()).toContain("当前频道暂无可总结的消息");
    expect(fetchCalls).toHaveLength(0);
  });

  it("读取当前频道并总结：展示频道名与条数，请求体来自频道消息", async () => {
    const { wrapper, summarize } = await mountHost();

    await summarize("c1");

    expect(readCalls).toBe(1);
    expect(wrapper.text()).toContain("研发");
    expect(wrapper.text()).toContain("共 2 条消息");
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe("/api/ai/summarize");
    expect(JSON.parse(String(fetchCalls[0]!.init?.body))).toEqual({
      channel_id: "c1",
      messages: ["Alice: 第一条", "Alice: 第二条"],
    });
    expect(wrapper.text()).toContain("默认总结");
  });

  it("缓存只保存摘要与指纹，不落消息正文", async () => {
    const { summarize } = await mountHost();

    await summarize("c1");

    const raw = storage.get("ai_summary.result:c1") as Record<string, unknown>;
    expect(raw).toMatchObject({
      summary: "默认总结",
      channelId: "c1",
      messageCount: 2,
      latestMessageId: "m2",
      sourceKind: "server",
    });
    expect(raw).not.toHaveProperty("messages");
    expect(JSON.stringify(raw)).not.toContain("第一条");
  });

  it("缓存新鲜（参与消息集合未变）：直接展示缓存且不发请求", async () => {
    const scoped = [message("m1", "第一条"), message("m2", "第二条")];
    storage.set("ai_summary.result:c1", {
      summary: "历史总结",
      channelId: "c1",
      messageCount: 2,
      latestMessageId: "m2",
      scopeFingerprint: computeScopeFingerprint(scoped),
      capturedAtMs: 1,
      sourceKind: "server",
    });
    fetchImpl = async () => ({ ok: false, status: 500, bodyText: "", headers: {} });
    const { wrapper, summarize } = await mountHost();

    await summarize("c1");

    expect(wrapper.text()).toContain("历史总结");
    expect(wrapper.text()).toContain("（缓存）");
    expect(fetchCalls).toHaveLength(0);
  });

  it("旧缓存缺少集合指纹：视为过期并重新生成一次", async () => {
    storage.set("ai_summary.result:c1", {
      summary: "历史总结",
      channelId: "c1",
      messageCount: 2,
      latestMessageId: "m2",
      capturedAtMs: 1,
      sourceKind: "server",
    });
    const { wrapper, summarize } = await mountHost();

    await summarize("c1");

    expect(fetchCalls).toHaveLength(1);
    expect(wrapper.text()).toContain("默认总结");
    expect(storage.get("ai_summary.result:c1")).toMatchObject({
      scopeFingerprint: expect.stringMatching(/^[0-9a-f]{8}$/u),
    });
  });

  it("缓存过期（末条消息变化）：先展示缓存再自动重新生成", async () => {
    storage.set("ai_summary.result:c1", {
      summary: "历史总结",
      channelId: "c1",
      messageCount: 1,
      latestMessageId: "m1",
      capturedAtMs: 1,
      sourceKind: "server",
    });
    const { wrapper, summarize } = await mountHost();

    await summarize("c1");

    expect(fetchCalls).toHaveLength(1);
    expect(wrapper.text()).toContain("默认总结");
    expect(storage.get("ai_summary.result:c1")).toMatchObject({ latestMessageId: "m2" });
  });

  it("「重新生成」忽略新鲜缓存强制重新请求", async () => {
    const { summarize, wrapper } = await mountHost();
    await summarize("c1");
    expect(fetchCalls).toHaveLength(1);

    await clickRun(wrapper);

    expect(fetchCalls).toHaveLength(2);
  });

  it("「加载更多历史」翻页后按新范围自动重新生成", async () => {
    messagesState = snapshotOf([message("m2", "第二条")], { hasMoreHistory: true });
    loadMoreImpl = async () => {
      messagesState = snapshotOf([message("m1", "第一条"), message("m2", "第二条")], { hasMoreHistory: false });
      return { loadedCount: 2, loadedDelta: 1, hasMore: false };
    };
    const { wrapper, summarize } = await mountHost();
    await summarize("c1");
    expect(fetchCalls).toHaveLength(1);

    await clickLoadMore(wrapper);

    expect(loadMoreCalls).toBe(1);
    expect(wrapper.text()).toContain("已载入 1 条更早消息");
    expect(wrapper.text()).toContain("共 2 条消息");
    expect(fetchCalls).toHaveLength(2);
    expect(JSON.parse(String(fetchCalls[1]!.init?.body))).toEqual({
      channel_id: "c1",
      messages: ["Alice: 第一条", "Alice: 第二条"],
    });
  });

  it("「加载更多历史」已无更早历史：提示且不重新请求", async () => {
    messagesState = snapshotOf([message("m1", "第一条")], { hasMoreHistory: true });
    loadMoreImpl = async () => ({ loadedCount: 1, loadedDelta: 0, hasMore: false });
    const { wrapper, summarize } = await mountHost();
    await summarize("c1");

    await clickLoadMore(wrapper);

    expect(wrapper.text()).toContain("已无更早历史");
    expect(fetchCalls).toHaveLength(1);
  });

  it("「加载更多历史」失败：提示稍后重试，不抛错", async () => {
    messagesState = snapshotOf([message("m1", "第一条")], { hasMoreHistory: true });
    loadMoreImpl = async () => {
      throw new Error("boom");
    };
    const { wrapper, summarize } = await mountHost();
    await summarize("c1");

    await clickLoadMore(wrapper);

    expect(wrapper.text()).toContain("加载更早消息失败");
    expect(fetchCalls).toHaveLength(1);
  });

  it("重复点击：请求进行中不再发起第二次", async () => {
    const releaseFns: Array<() => void> = [];
    fetchImpl = async () =>
      await new Promise<FetchResponse>((resolve) => {
        releaseFns.push(() => resolve(serverOkResponse("慢总结", 2)));
      });
    const { wrapper, summarize } = await mountHost();

    const first = summarize("c1");
    await vi.waitFor(() => {
      expect(fetchCalls).toHaveLength(1);
    });
    await wrapper.find(".ai-summary-panel__run").trigger("click");
    await flushPromises();
    releaseFns.forEach((release) => release());
    await first;
    await flushPromises();

    expect(fetchCalls).toHaveLength(1);
  });

  it("HTTP 失败：文案带状态码，便于区分服务端未实现", async () => {
    fetchImpl = async () => ({ ok: false, status: 503, bodyText: "", headers: {} });
    const { wrapper, summarize } = await mountHost();

    await summarize("c1");

    expect(wrapper.text()).toContain("总结请求失败（HTTP 503）");
  });

  describe("自配 provider（插件自管）", () => {
    it("已配置 provider：直连外部端点优先生效，携带密钥引用与超时，并标注来源", async () => {
      persistProviderConfig();
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]!.input).toBe("https://api.deepseek.com/chat/completions");
      expect(fetchCalls[0]!.init?.headers).toMatchObject({
        authorization: "Bearer @secret(api_key)",
      });
      expect(fetchCalls[0]!.init?.timeoutMs).toBe(30000);
      const body = JSON.parse(String(fetchCalls[0]!.init?.body)) as {
        model: string;
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.model).toBe("deepseek-flash");
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]!.role).toBe("system");
      expect(body.messages[1]!.content).toContain("Alice: 第一条");
      expect(wrapper.text()).toContain("自配总结");
      expect(wrapper.text()).toContain("来源：DeepSeek · deepseek-flash");
      expect(wrapper.text()).not.toContain("总结请求失败");
      expect(storage.get("ai_summary.result:c1")).toMatchObject({
        summary: "自配总结",
        sourceKind: "client",
        provider: "DeepSeek",
      });
    });

    it("未配置 provider（auto 档）：回退服务端端点，不预检密钥", async () => {
      // 不写 provider 配置：目标解析为 null 且从未显式选择 → not-configured。
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(secretStatusCalls).toBe(0);
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]!.input).toBe("/api/ai/summarize");
      expect(wrapper.text()).toContain("默认总结");
      expect(wrapper.text()).toContain("来源：聊天服务端 /api/ai/summarize");
    });

    it("已选 provider 但缺密钥：给出可操作提示，且不静默回退服务端", async () => {
      persistProviderConfig();
      secretConfigured = false;
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(secretStatusCalls).toBe(1);
      expect(fetchCalls).toHaveLength(0);
      expect(wrapper.text()).toContain("已选择 DeepSeek，但尚未配置 API Key");
    });

    it("配置不完整（已选但缺 base URL）：提示去设置项补全，不回退服务端", async () => {
      persistProviderConfig({ baseUrl: "" });
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(fetchCalls).toHaveLength(0);
      expect(wrapper.text()).toContain("自管 AI 配置不完整");
    });

    it("请求失败：提示带 provider 与状态码，不回退服务端（避免误导用户）", async () => {
      persistProviderConfig();
      fetchImpl = async () =>
        Promise.resolve({
          ok: false,
          status: 401,
          bodyText: JSON.stringify({ error: { message: "invalid api key" } }),
          headers: {},
        });
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(fetchCalls).toHaveLength(1);
      expect(wrapper.text()).toContain("DeepSeek: invalid api key (HTTP 401)");
    });

    it("宿主未注入 network（旧宿主）：给出失败提示，不崩溃", async () => {
      networkEnabled = false;
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(wrapper.text()).toContain("总结请求失败");
    });
  });

  describe("后端设置项（AI 摘要后端）", () => {
    /**
     * 预设后端偏好（写入插件存储，模拟设置项已保存）。
     *
     * @param mode - 目标后端档位。
     */
    function persistBackend(mode: SummarizeBackend): void {
      storage.set(SUMMARIZE_BACKEND_STORAGE_KEY, mode);
    }

    it("server 档：即使 provider 已配置也走服务端，且不展示自配 AI 引导", async () => {
      persistBackend("server");
      persistProviderConfig();
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]!.input).toBe("/api/ai/summarize");
      expect(wrapper.text()).toContain("默认总结");
      expect(wrapper.text()).toContain("来源：聊天服务端 /api/ai/summarize");
      expect(wrapper.text()).not.toContain("设置 → 插件设置");
    });

    it("client 档：已配置 provider 时只走自配端点，不请求服务端", async () => {
      persistBackend("client");
      persistProviderConfig();
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]!.input).toBe("https://api.deepseek.com/chat/completions");
      expect(wrapper.text()).toContain("自配总结");
    });

    it("client 档：provider 未配置时不回退服务端，给出可操作提示", async () => {
      persistBackend("client");
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(fetchCalls).toHaveLength(0);
      expect(wrapper.text()).toContain("当前为「仅自配 AI」");
    });

    it("auto 档：未配置 provider 时回退服务端（保持历史行为）", async () => {
      persistBackend("auto");
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(fetchCalls).toHaveLength(1);
      expect(wrapper.text()).toContain("默认总结");
    });
  });

  describe("参与范围（时间范围 + 聊天区多选）", () => {
    /**
     * 读取指定序号请求的请求体。
     *
     * @param index - 请求序号。
     * @returns 请求体。
     */
    function bodyOf(index: number): { channel_id: string; messages: string[] } {
      return JSON.parse(String(fetchCalls[index]!.init?.body)) as {
        channel_id: string;
        messages: string[];
      };
    }

    it("聊天区有多选：默认范围「仅选中」且只发送选中消息", async () => {
      messagesState = snapshotOf([message("m1", "第一条"), message("m2", "第二条")], {
        selectedMessageIds: ["m2"],
        selectedTotalCount: 1,
      });
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(wrapper.text()).toContain("聊天中已选（1 条）");
      expect(wrapper.text()).toContain("共 1 条消息");
      expect(fetchCalls).toHaveLength(1);
      expect(bodyOf(0)).toEqual({ channel_id: "c1", messages: ["Alice: 第二条"] });
    });

    it("手动切回「全部」：按全部候选重新生成", async () => {
      messagesState = snapshotOf([message("m1", "第一条"), message("m2", "第二条")], {
        selectedMessageIds: ["m2"],
        selectedTotalCount: 1,
      });
      const { wrapper, summarize } = await mountHost();
      await summarize("c1");

      await clickScopeChip(wrapper, 0);
      await clickRun(wrapper);

      expect(fetchCalls).toHaveLength(2);
      expect(bodyOf(1)).toEqual({
        channel_id: "c1",
        messages: ["Alice: 第一条", "Alice: 第二条"],
      });
    });

    it("多选含不可参与总结的条目：提示可参与条数", async () => {
      messagesState = snapshotOf([message("m1", "第一条")], {
        selectedMessageIds: ["m1"],
        selectedTotalCount: 3,
      });
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(wrapper.text()).toContain("聊天中已选 3 条，其中 1 条可参与总结");
    });

    it("聊天区无多选：展示多选引导且不出现「聊天中已选」入口", async () => {
      const { wrapper, summarize } = await mountHost();

      await summarize("c1");

      expect(wrapper.text()).toContain("在聊天中右键消息");
      expect(wrapper.findAll(".ai-summary-panel__scope-chip")).toHaveLength(1);
    });

    it("快速范围「今天」：只发送今天的消息", async () => {
      const today = new Date();
      // 取当天 00:00 作为「今天」样本：任何时刻都早于当前时间，避免 0 点后取到未来时刻导致范围过滤为空。
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 3_600_000);
      messagesState = snapshotOf([
        message("m1", "昨天的消息", yesterday.getTime()),
        message("m2", "今天的消息", today.getTime()),
      ]);
      fetchImpl = async (input) => routedFetch(input);
      const { wrapper, summarize } = await mountHost();
      await summarize("c1");
      expect(bodyOf(0).messages).toEqual(["Alice: 昨天的消息", "Alice: 今天的消息"]);

      await clickQuickRange(wrapper, "今天");
      await clickRun(wrapper);

      expect(fetchCalls).toHaveLength(2);
      expect(bodyOf(1)).toEqual({ channel_id: "c1", messages: ["Alice: 今天的消息"] });
      expect(wrapper.text()).toContain("共 1 条消息");
    });

    it("自定义区间与清除：范围随选择器变化", async () => {
      const day1 = new Date(2026, 0, 1, 8, 0, 0, 0);
      const day2 = new Date(2026, 0, 2, 8, 0, 0, 0);
      messagesState = snapshotOf([
        message("m1", "第一天", day1.getTime()),
        message("m2", "第二天", day2.getTime()),
      ]);
      const { wrapper, summarize } = await mountHost();
      await summarize("c1");

      // 只保留第一天（结束端点补齐到该分钟末尾，故同分钟内的消息仍被包含）。
      await setPickerRange(wrapper, [day1, day1]);
      await clickRun(wrapper);

      expect(bodyOf(1)).toEqual({ channel_id: "c1", messages: ["Alice: 第一天"] });

      // 清除区间：回到不限时间。
      await setPickerRange(wrapper, [undefined, undefined]);
      await clickRun(wrapper);

      expect(bodyOf(2)).toEqual({
        channel_id: "c1",
        messages: ["Alice: 第一天", "Alice: 第二天"],
      });
    });

    it("范围把消息全部排除：提示且不发请求", async () => {
      const { wrapper, summarize } = await mountHost();
      await summarize("c1");
      expect(fetchCalls).toHaveLength(1);

      const future = new Date(Date.now() + 86_400_000);
      await setPickerRange(wrapper, [future, future]);
      await clickRun(wrapper);

      expect(wrapper.text()).toContain("当前范围内没有可总结的消息");
      expect(fetchCalls).toHaveLength(1);
    });

    it("范围变化后不命中缓存：按新范围重新请求", async () => {
      const today = new Date();
      // 取当天 00:00 作为「今天」样本：任何时刻都早于当前时间，避免 0 点后取到未来时刻导致范围过滤为空。
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 3_600_000);
      messagesState = snapshotOf([
        message("m1", "昨天的消息", yesterday.getTime()),
        message("m2", "今天的消息", today.getTime()),
      ]);
      const { wrapper, summarize } = await mountHost();
      await summarize("c1");
      expect(fetchCalls).toHaveLength(1);

      // 同一范围再次打开：命中缓存。
      await summarize("c1");
      expect(fetchCalls).toHaveLength(1);
      expect(wrapper.text()).toContain("（缓存）");

      // 收窄范围后再次打开：集合指纹变化，重新请求。
      await clickQuickRange(wrapper, "今天");
      await summarize("c1");
      expect(fetchCalls).toHaveLength(2);
      expect(bodyOf(1)).toEqual({ channel_id: "c1", messages: ["Alice: 今天的消息"] });
    });

    it("切换频道：范围与结果一并重置", async () => {
      messagesState = snapshotOf([message("m1", "第一条")], {
        selectedMessageIds: ["m1"],
        selectedTotalCount: 1,
      });
      const { wrapper, summarize } = await mountHost();
      await summarize("c1");
      await clickQuickRange(wrapper, "今天");

      messagesState = snapshotOf(
        [message("m1", "新频道消息", new Date(2020, 0, 1).getTime())],
        { channelId: "c2", channelName: "运维" },
      );
      await summarize("c2");

      // 切换频道后回到"不限时间 + 跟随聊天多选"：新频道的消息全部参与。
      expect(wrapper.text()).toContain("运维");
      expect(bodyOf(1)).toEqual({ channel_id: "c2", messages: ["Alice: 新频道消息"] });
    });
  });
});
