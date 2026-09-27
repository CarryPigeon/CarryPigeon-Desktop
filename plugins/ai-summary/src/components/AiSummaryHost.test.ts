/**
 * @fileoverview AiSummaryHost 面板单测。
 * @description
 * 覆盖：未选频道与空消息的提示文案、正常总结与缓存、HTTP 失败带状态码、
 * 切频道不残留上一频道的总结结果，以及客户端 AI（`host.ai`）优先/回退/失败语义。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import type { PluginAiSummarizeResult, PluginContext } from "@/features/plugins/api-types";
import { bindContext, unbindContext } from "../host/bridge";
import AiSummaryHost from "./AiSummaryHost.vue";

/** 受控 textarea stub：让 v-model 能在测试里被写入。 */
const TextareaStub = defineComponent({
  name: "TTextarea",
  props: { modelValue: { type: String, default: "" } },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    return () =>
      h("textarea", {
        value: props.modelValue,
        onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLTextAreaElement).value),
      });
  },
});

type FetchResponse = { ok: boolean; status: number; bodyText: string; headers: Record<string, string> };

const storage = new Map<string, unknown>();
let fetchImpl: (input: string, init?: { method?: string; body?: string }) => Promise<FetchResponse>;
let fetchCalls: Array<{ input: string; init?: { method?: string; body?: string } }> = [];
/** 客户端 AI 实现；为 null 表示宿主未注入 `host.ai`（旧宿主）。 */
let aiImpl: ((input: { channelId: string; messages: readonly string[] }) => Promise<PluginAiSummarizeResult>) | null =
  null;
let aiConfigured = true;
let aiCalls: Array<{ channelId: string; messages: readonly string[] }> = [];

/** 绑定 stub 宿主上下文（storage / network / 可选 ai）。 */
function bindStubContext(): void {
  const ai = aiImpl
    ? {
        isConfigured: async () => aiConfigured,
        summarize: async (input: { channelId: string; messages: readonly string[] }) => {
          aiCalls.push({ channelId: input.channelId, messages: input.messages });
          return aiImpl!(input);
        },
      }
    : undefined;
  const ctx = {
    lang: "zh_cn",
    host: {
      storage: {
        async get(key: string) {
          return storage.get(key) ?? null;
        },
        async set(key: string, value: unknown) {
          storage.set(key, value);
        },
      },
      network: {
        fetch(input: string, init?: { method?: string; body?: string }) {
          fetchCalls.push({ input, init });
          return fetchImpl(input, init);
        },
      },
      ai,
    },
  } as unknown as PluginContext;
  bindContext(ctx);
}

/**
 * 挂载面板并打开（先以空消息触发一次：只打开面板，不产生网络请求，textarea 才会渲染）。
 *
 * 说明：每次挂载前重新绑定 stub 上下文，使测试体内对 `aiImpl` / `fetchImpl` 的改写生效。
 *
 * @returns 面板 wrapper 与 summarize 入口。
 */
async function mountHost(): Promise<{ wrapper: ReturnType<typeof mount>; summarize(channelId: string): Promise<void> }> {
  bindStubContext();
  const wrapper = mount(AiSummaryHost, {
    global: { stubs: { "t-icon": true, "t-button": true, "t-textarea": TextareaStub } },
  });
  const summarize = (channelId: string) =>
    (wrapper.vm as unknown as { summarize(c: string): Promise<void> }).summarize(channelId);
  await summarize("c1");
  return { wrapper, summarize };
}

function okResponse(summary: string, messageCount: number): FetchResponse {
  return {
    ok: true,
    status: 200,
    bodyText: JSON.stringify({ summary, channel_id: "c1", message_count: messageCount }),
    headers: {},
  };
}

describe("AiSummaryHost", () => {
  beforeEach(() => {
    storage.clear();
    fetchCalls = [];
    aiCalls = [];
    aiImpl = null;
    aiConfigured = true;
    fetchImpl = async () => okResponse("默认总结", 0);
    bindStubContext();
  });

  afterEach(() => {
    unbindContext();
  });

  it("未选择频道：给出可操作提示且不发起请求", async () => {
    const { wrapper, summarize } = await mountHost();

    await summarize("");

    expect(wrapper.text()).toContain("请先选择一个频道");
    expect(wrapper.text()).not.toContain("总结请求失败");
    expect(fetchCalls).toHaveLength(0);
  });

  it("未填写消息：提示至少输入一条，且不发起请求", async () => {
    const { wrapper, summarize } = await mountHost();

    await summarize("c1");

    expect(wrapper.text()).toContain("请至少输入一条消息");
    expect(fetchCalls).toHaveLength(0);
  });

  it("正常总结：请求体含 channel_id 与逐行消息，并渲染结果与缓存", async () => {
    const { wrapper, summarize } = await mountHost();
    await wrapper.find("textarea").setValue("第一条\n\n 第二条 ");

    await summarize("c1");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.input).toBe("/api/ai/summarize");
    expect(JSON.parse(String(fetchCalls[0]!.init?.body))).toEqual({
      channel_id: "c1",
      messages: ["第一条", "第二条"],
    });
    expect(wrapper.text()).toContain("默认总结");
    expect(storage.get("ai_summary.result:c1")).toMatchObject({ summary: "默认总结" });
  });

  it("HTTP 失败：文案带状态码，便于区分服务端未实现", async () => {
    fetchImpl = async () => ({ ok: false, status: 503, bodyText: "", headers: {} });
    const { wrapper, summarize } = await mountHost();
    await wrapper.find("textarea").setValue("第一条");

    await summarize("c1");

    expect(wrapper.text()).toContain("总结请求失败（HTTP 503）");
  });

  it("切换频道：不残留上一频道的总结结果", async () => {
    const { wrapper, summarize } = await mountHost();
    await wrapper.find("textarea").setValue("第一条");
    await summarize("c1");
    expect(wrapper.text()).toContain("默认总结");

    // 切到新频道且未填写消息：旧频道结果必须被清掉。
    await wrapper.find("textarea").setValue("");
    await summarize("c2");

    expect(wrapper.text()).not.toContain("默认总结");
    expect(wrapper.text()).toContain("请至少输入一条消息");
  });

  it("命中频道缓存时展示缓存结果并标记（缓存）", async () => {
    storage.set("ai_summary.result:c1", { summary: "历史总结", channelId: "c1", messageCount: 3 });
    fetchImpl = async () => ({ ok: false, status: 500, bodyText: "", headers: {} });
    const { wrapper, summarize } = await mountHost();
    await wrapper.find("textarea").setValue("第一条");

    await summarize("c1");

    expect(wrapper.text()).toContain("历史总结");
    expect(wrapper.text()).toContain("（缓存）");
  });

  describe("客户端 AI（host.ai）", () => {
    it("已配置客户端 AI：优先生效，不再请求服务端，并标注来源", async () => {
      aiImpl = async () => ({
        ok: true,
        summary: "客户端总结",
        messageCount: 2,
        provider: "DeepSeek",
        model: "deepseek-flash",
      });
      const { wrapper, summarize } = await mountHost();
      await wrapper.find("textarea").setValue("第一条\n第二条");

      await summarize("c1");

      expect(aiCalls).toHaveLength(1);
      expect(aiCalls[0]!.messages).toEqual(["第一条", "第二条"]);
      expect(fetchCalls).toHaveLength(0);
      expect(wrapper.text()).toContain("客户端总结");
      expect(wrapper.text()).toContain("来源：DeepSeek · deepseek-flash");
      expect(wrapper.text()).not.toContain("总结请求失败");
      // 来源一并落缓存，便于展示缓存结果时仍能标注
      expect(storage.get("ai_summary.result:c1")).toMatchObject({
        summary: "客户端总结",
        sourceKind: "client",
        provider: "DeepSeek",
      });
    });

    it("not-configured：回退服务端端点", async () => {
      aiImpl = async () => ({ ok: false, code: "not-configured", error: "not configured" });
      const { wrapper, summarize } = await mountHost();
      await wrapper.find("textarea").setValue("第一条");

      await summarize("c1");

      expect(aiCalls).toHaveLength(1);
      expect(fetchCalls).toHaveLength(1);
      expect(wrapper.text()).toContain("默认总结");
      expect(wrapper.text()).toContain("来源：聊天服务端 /api/ai/summarize");
    });

    it("已选 provider 但缺密钥：给出可操作提示，且不静默回退服务端", async () => {
      aiImpl = async () => ({
        ok: false,
        code: "api-key-missing",
        error: "api key is not configured",
        provider: "DeepSeek",
      });
      const { wrapper, summarize } = await mountHost();
      await wrapper.find("textarea").setValue("第一条");

      await summarize("c1");

      expect(fetchCalls).toHaveLength(0);
      expect(wrapper.text()).toContain("已选择 DeepSeek，但尚未配置 API Key");
    });

    it("配置不完整：提示去设置页补全，不回退服务端", async () => {
      aiImpl = async () => ({
        ok: false,
        code: "incomplete-config",
        error: "base url or model is empty",
        provider: "自定义（OpenAI 兼容）",
      });
      const { wrapper, summarize } = await mountHost();
      await wrapper.find("textarea").setValue("第一条");

      await summarize("c1");

      expect(fetchCalls).toHaveLength(0);
      expect(wrapper.text()).toContain("客户端 AI 配置不完整");
    });

    it("请求失败：提示带 provider 与状态码，不回退服务端（避免误导用户）", async () => {
      aiImpl = async () => ({
        ok: false,
        code: "request-failed",
        error: "invalid api key",
        status: 401,
        provider: "DeepSeek",
      });
      const { wrapper, summarize } = await mountHost();
      await wrapper.find("textarea").setValue("第一条");

      await summarize("c1");

      expect(fetchCalls).toHaveLength(0);
      expect(wrapper.text()).toContain("DeepSeek: invalid api key / HTTP 401");
    });

    it("宿主机未注入 host.ai（旧宿主）：直接走服务端端点，不报错", async () => {
      aiImpl = null;
      const { wrapper, summarize } = await mountHost();
      await wrapper.find("textarea").setValue("第一条");

      await summarize("c1");

      expect(fetchCalls).toHaveLength(1);
      expect(wrapper.text()).toContain("默认总结");
      // 旧宿主上不展示客户端 AI 引导，避免误导
      expect(wrapper.text()).not.toContain("设置 → AI 服务");
    });
  });
});
