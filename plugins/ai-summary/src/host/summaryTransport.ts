import type { PluginChannelMessage } from "@/features/plugins/api-types";
import type { Context, PluginNetworkService } from "@/features/plugins/sdk";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { buildSummarizeMessages, MAX_SUMMARIZE_MESSAGES, resolveAiTarget } from "../domain/aiProvider";
import { buildAuthHeaders, buildChatCompletionBody, buildChatCompletionsUrl, parseChatCompletionResponse } from "../domain/openaiClient";
import { buildChannelMessageLines, parseSummarizeResponse, type SummarizeResult, type SummarySource } from "../domain/summarizeRequest";
import { ensureBackendLoaded } from "./backendPreference";
import { getContext } from "./bridge";
import { getProviderSecretStatus } from "./clientAi";
import { ensureProviderLoaded } from "./providerConfig";

const SERVER_PATH = "/api/ai/summarize";
const SERVER_TIMEOUT_MS = 30_000;

export type PreparedSummary = {
  context: Context;
  network: PluginNetworkService;
  url: string;
  destination: string;
  source: SummarySource;
  channelId: string;
  messages: readonly PluginChannelMessage[];
  scopeCount: number;
  timeoutMs: number;
  headers: Record<string, string>;
  body: string;
  usingAutoFallback: boolean;
};

type PrepareResult = { ok: true; request: PreparedSummary } | {
  ok: false;
  reason: "unavailable" | "not-configured" | "incomplete-config" | "invalid-url" | "api-key-missing" | "secrets-unavailable" | "empty";
  provider?: string;
};

type SendResult = { ok: true; result: SummarizeResult; source: SummarySource } | {
  ok: false;
  reason: "unavailable" | "timeout" | "failed";
  status?: number;
};

/** 只准备请求，不发送消息；同一份目标和载荷供预览与确认后的请求使用。 */
export async function prepareSummary(channelId: string, scoped: readonly PluginChannelMessage[]): Promise<PrepareResult> {
  const context = getContext();
  const network = context.network;
  if (!network) return { ok: false, reason: "unavailable" };
  const messages = scoped.filter((message) => String(message.text ?? "").trim() !== "");
  if (!messages.length) return { ok: false, reason: "empty" };

  const mode = await ensureBackendLoaded();
  const common = {
    context, network, channelId, scopeCount: messages.length,
    headers: { "content-type": "application/json" },
    usingAutoFallback: mode === "auto",
  };
  if (mode !== "server") {
    const config = await ensureProviderLoaded();
    const target = resolveAiTarget(config);
    if (target) {
      const url = buildChatCompletionsUrl(target.baseUrl);
      let parsed: URL;
      try {
        parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
          return { ok: false, reason: "invalid-url" };
        }
      } catch {
        return { ok: false, reason: "invalid-url" };
      }
      if (target.requiresApiKey) {
        const secret = await getProviderSecretStatus();
        if (!secret.secureStorageAvailable) return { ok: false, reason: "secrets-unavailable" };
        if (!secret.configured) return { ok: false, reason: "api-key-missing", provider: target.label };
      }
      const sent = messages.slice(0, MAX_SUMMARIZE_MESSAGES);
      return { ok: true, request: {
        ...common,
        url: parsed.href,
        destination: parsed.href,
        source: { kind: "client", provider: target.label, model: target.model },
        messages: sent,
        timeoutMs: target.timeoutMs,
        headers: { ...common.headers, ...(target.requiresApiKey ? buildAuthHeaders() : {}) },
        body: JSON.stringify(buildChatCompletionBody({
          model: target.model,
          messages: buildSummarizeMessages(buildChannelMessageLines(sent), target.systemPrompt),
          temperature: target.temperature,
        })),
        usingAutoFallback: false,
      } };
    }
    if (config.providerChosen) return { ok: false, reason: "incomplete-config" };
    if (mode === "client") return { ok: false, reason: "not-configured" };
  }

  const origin = toHttpOrigin(context.server.serverSocket);
  if (!origin) return { ok: false, reason: "unavailable" };
  const destination = `${new URL(origin).origin}${SERVER_PATH}`;
  return { ok: true, request: {
    ...common,
    url: destination,
    destination,
    source: { kind: "server" },
    messages,
    timeoutMs: SERVER_TIMEOUT_MS,
    body: JSON.stringify({ channel_id: channelId, messages: buildChannelMessageLines(messages) }),
  } };
}

/** 宿主网络能力不支持取消；本地截止时间只结束界面等待，不表示对方未收到。 */
export async function sendPreparedSummary(request: PreparedSummary): Promise<SendResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (getContext() !== request.context) return { ok: false, reason: "unavailable" };
    const response = await Promise.race([
      request.network.fetch(request.url, {
        method: "POST", headers: request.headers, body: request.body, timeoutMs: request.timeoutMs,
      }),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), request.timeoutMs); }),
    ]);
    if (!response || response.status === 408 || response.status === 504) return { ok: false, reason: "timeout" };
    if ([0, 404, 405, 501, 503].includes(response.status)) return { ok: false, reason: "unavailable", status: response.status };
    if (!response.ok) return { ok: false, reason: "failed", status: response.status };
    const { source, channelId, messages } = request;
    if (source.kind === "client") {
      const parsed = parseChatCompletionResponse(response.status, response.bodyText);
      if (!parsed.ok) return { ok: false, reason: "failed" };
      return { ok: true, result: { summary: parsed.content, channelId, messageCount: messages.length },
        source: { ...source, model: parsed.model || source.model } };
    }
    const parsed = parseSummarizeResponse(response.bodyText);
    if (!parsed.ok) return { ok: false, reason: "failed" };
    return { ok: true, result: { summary: parsed.result.summary, channelId, messageCount: messages.length }, source };
  } catch (error) {
    const detail = typeof error === "object" && error !== null
      ? `${Reflect.get(error, "name") ?? ""} ${Reflect.get(error, "message") ?? ""} ${Reflect.get(error, "detail") ?? ""}`
      : String(error);
    return { ok: false, reason: /timeout|timed out|超时/i.test(detail) ? "timeout" : "failed" };
  } finally {
    clearTimeout(timer);
  }
}
