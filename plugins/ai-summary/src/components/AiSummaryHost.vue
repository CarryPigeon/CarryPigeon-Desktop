<template>
  <div v-if="visible" class="ai-summary-host">
    <div class="ai-summary-panel">
      <div class="ai-summary-panel__header">
        <t-icon name="city-12" />
        <span class="ai-summary-panel__title">{{ t("ai_summary_panel_title") }}</span>
        <t-button size="small" variant="text" @click="close">
          {{ t("ai_summary_close") }}
        </t-button>
      </div>
      <div class="ai-summary-panel__body">
        <div class="ai-summary-panel__label">{{ t("ai_summary_messages_label") }}</div>
        <t-textarea
          v-model="messageText"
          class="ai-summary-panel__textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
          :placeholder="t('ai_summary_messages_placeholder')"
        />
        <div class="ai-summary-panel__actions">
          <t-button
            size="small"
            :loading="loading"
            :disabled="!currentChannelId"
            @click="summarize(currentChannelId)"
          >
            {{ t("ai_summary_run") }}
          </t-button>
        </div>
        <div v-if="errorText" class="ai-summary-panel__error">{{ errorText }}</div>
        <div v-if="result" class="ai-summary-panel__result">
          <div class="ai-summary-panel__result-title">
            {{ t("ai_summary_result_title") }}
            <span v-if="fromCache" class="ai-summary-panel__cached">{{ t("ai_summary_cached") }}</span>
          </div>
          <div class="ai-summary-panel__result-body">{{ result.summary }}</div>
          <div class="ai-summary-panel__result-meta">
            {{ t("ai_summary_message_count", { count: result.messageCount }) }}
          </div>
          <div v-if="sourceLabel" class="ai-summary-panel__result-source">{{ sourceLabel }}</div>
        </div>
        <div v-if="showConfigureHint" class="ai-summary-panel__hint">
          {{ t("ai_summary_configure_hint") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { PluginAiFailureCode } from "@/features/plugins/api-types";
import { getContext } from "../host/bridge";
import { createLogger } from "../shared/logger";
import {
  buildSummarizeRequestBody,
  parseSummarizeResponse,
  type SummarizeResult,
} from "../domain/summarizeRequest";
import { t } from "../i18n";

const logger = createLogger("AiSummaryHost");

/** 总结来源：客户端自配 provider 或服务端端点。 */
type SummarySource =
  | { kind: "client"; provider: string; model: string }
  | { kind: "server" };

/**
 * 总结结果缓存存储 key（按频道隔离）。
 *
 * @param channelId - 频道 id。
 * @returns 存储 key。
 */
function resultStorageKey(channelId: string): string {
  return `ai_summary.result:${channelId}`;
}

const visible = ref(false);
const loading = ref(false);
const messageText = ref("");
const currentChannelId = ref("");
const result = ref<SummarizeResult | null>(null);
const fromCache = ref(false);
const errorText = ref("");
const source = ref<SummarySource | null>(null);

/** 当前结果来源文案（客户端 provider / 服务端）。 */
const sourceLabel = computed(() => {
  const s = source.value;
  if (!s) return "";
  if (s.kind === "client") {
    return t("ai_summary_source_client", { provider: s.provider, model: s.model });
  }
  return t("ai_summary_source_server");
});

/**
 * 是否展示"可配置客户端 AI"的引导。
 *
 * 仅在本次走服务端回退、且插件确实拿到了 `host.ai` 能力（即宿主支持客户端 AI）
 * 时展示，避免对未升级宿主或无该权限的场景产生误导。
 */
const showConfigureHint = computed(
  () => source.value?.kind === "server" && getHostAi() !== undefined,
);

/**
 * 读取宿主注入的 `host.ai` 能力（未注入/读取失败时返回 undefined）。
 *
 * @returns ai 能力或 undefined。
 */
function getHostAi(): NonNullable<ReturnType<typeof getContext>["host"]["ai"]> | undefined {
  try {
    return getContext().host.ai;
  } catch {
    return undefined;
  }
}

/**
 * 从插件存储读取缓存结果（容错：异常或形状不符时视为无缓存）。
 *
 * @param channelId - 频道 id。
 * @returns 缓存结果或 null。
 */
async function loadCachedResult(channelId: string): Promise<SummarizeResult | null> {
  try {
    const raw = await getContext().host.storage.get(resultStorageKey(channelId));
    if (typeof raw === "object" && raw !== null) {
      const r = raw as Record<string, unknown>;
      if (typeof r.summary === "string" && r.summary.trim() !== "") {
        const countNum = Number(r.messageCount);
        return {
          summary: r.summary,
          channelId: String(r.channelId ?? channelId),
          messageCount: Number.isFinite(countNum) ? countNum : 0,
        };
      }
    }
  } catch (e) {
    logger.warn("ai_summary_cache_load_failed", { error: String(e) });
  }
  return null;
}

/**
 * 读取缓存中记录的结果来源（用于展示"（缓存）"时仍能标明来源）。
 *
 * @param channelId - 频道 id。
 * @returns 来源描述或 null。
 */
async function loadCachedSource(channelId: string): Promise<SummarySource | null> {
  try {
    const raw = await getContext().host.storage.get(resultStorageKey(channelId));
    if (typeof raw === "object" && raw !== null) {
      const r = raw as Record<string, unknown>;
      const kind = r.sourceKind;
      if (kind === "client" && typeof r.provider === "string") {
        return { kind: "client", provider: r.provider, model: String(r.model ?? "") };
      }
      if (kind === "server") return { kind: "server" };
    }
  } catch (e) {
    logger.warn("ai_summary_cache_source_load_failed", { error: String(e) });
  }
  return null;
}

/**
 * 组装失败文案：附 HTTP 状态码，便于区分「服务端未实现该接口」与「请求/解析失败」。
 *
 * @param status - 响应状态码；未知时省略。
 * @returns 展示用错误文案。
 */
function failedText(status?: number): string {
  const base = t("ai_summary_failed");
  return typeof status === "number" && status > 0 ? `${base}（HTTP ${status}）` : base;
}

/**
 * 把客户端 AI 的失败分类转成可操作文案。
 *
 * @param code - 失败分类。
 * @param error - 原始（已脱敏）错误描述。
 * @param status - 上游状态码。
 * @param provider - provider 展示名。
 * @returns 展示用错误文案。
 */
function clientFailureText(
  code: PluginAiFailureCode,
  error: string,
  status?: number,
  provider?: string,
): string {
  if (code === "incomplete-config") return t("ai_summary_incomplete_config");
  if (code === "api-key-missing") return t("ai_summary_api_key_missing", { provider: provider ?? "" });
  const suffix = typeof status === "number" && status > 0 ? ` / HTTP ${status}` : "";
  return `${t("ai_summary_failed")}（${provider ? `${provider}: ` : ""}${error}${suffix}）`;
}

/**
 * 落盘结果与来源（缓存失败不影响本次展示）。
 *
 * @param channelId - 频道 id。
 * @param summary - 总结正文。
 * @param messageCount - 消息条数。
 * @param src - 结果来源。
 */
async function saveResult(
  channelId: string,
  summary: string,
  messageCount: number,
  src: SummarySource,
): Promise<void> {
  try {
    await getContext().host.storage.set(resultStorageKey(channelId), {
      summary,
      channelId,
      messageCount,
      sourceKind: src.kind,
      ...(src.kind === "client" ? { provider: src.provider, model: src.model } : {}),
    });
  } catch (e) {
    logger.warn("ai_summary_cache_save_failed", { error: String(e) });
  }
}

/**
 * 执行总结。
 *
 * 顺序：
 * 1. 客户端 AI（`host.ai.summarize`，用户自配 provider，密钥由宿主代持）；
 * 2. 未配置客户端 AI（`not-configured`）→ 回退服务端 `/api/ai/summarize`；
 * 3. 已配置但调用失败 → 直接给出可操作提示，**不静默回退**（否则用户会误以为
 *    自己配的模型在生效）。
 *
 * @param channelId - 频道 id。
 */
async function summarize(channelId: string): Promise<void> {
  const ch = String(channelId ?? "").trim();
  visible.value = true;
  errorText.value = "";
  if (!ch) {
    // 未选择频道：给出可操作的提示，而不是笼统的「请求失败」（也不发请求）。
    logger.warn("ai_summary_no_channel");
    errorText.value = t("ai_summary_no_channel");
    return;
  }
  // 切换频道：先丢弃上一个频道的结果与来源，避免跨频道残留。
  if (currentChannelId.value !== ch) {
    result.value = null;
    fromCache.value = false;
    source.value = null;
  }
  currentChannelId.value = ch;

  // 先展示该频道的缓存结果（若有）。
  const cached = await loadCachedResult(ch);
  if (cached && !result.value) {
    result.value = cached;
    fromCache.value = true;
    source.value = await loadCachedSource(ch);
  }

  const requestBody = buildSummarizeRequestBody(ch, messageText.value);
  if (requestBody.messages.length === 0) {
    errorText.value = t("ai_summary_empty_messages");
    return;
  }

  loading.value = true;
  try {
    const ai = getHostAi();
    if (ai) {
      const client = await ai.summarize({ channelId: ch, messages: requestBody.messages });
      if (client.ok) {
        result.value = {
          summary: client.summary,
          channelId: ch,
          messageCount: client.messageCount,
        };
        fromCache.value = false;
        source.value = { kind: "client", provider: client.provider, model: client.model };
        await saveResult(ch, client.summary, client.messageCount, source.value);
        return;
      }
      if (client.code !== "not-configured") {
        logger.warn("ai_summary_client_failed", { code: client.code, status: client.status ?? -1 });
        errorText.value = clientFailureText(client.code, client.error, client.status, client.provider);
        return;
      }
      // not-configured：用户选择跟随服务端，继续走下面的服务端端点。
    }

    // 服务端端点：网络能力由 "network" 权限注入；相对路径会被宿主拼接到当前 server origin。
    const res = await getContext().host.network?.fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!res || !res.ok) {
      logger.warn("ai_summary_fetch_failed", { status: res?.status ?? -1 });
      errorText.value = failedText(res?.status);
      return;
    }
    const parsed = parseSummarizeResponse(res.bodyText);
    if (!parsed.ok) {
      logger.warn("ai_summary_parse_failed", { error: parsed.error });
      errorText.value = failedText(res.status);
      return;
    }
    result.value = parsed.result;
    fromCache.value = false;
    source.value = { kind: "server" };
    await saveResult(ch, parsed.result.summary, parsed.result.messageCount, source.value);
  } catch (e) {
    logger.error("ai_summary_request_error", { error: String(e) });
    errorText.value = failedText();
  } finally {
    loading.value = false;
  }
}

function close(): void {
  visible.value = false;
}

defineExpose({
  summarize,
});
</script>

<style scoped lang="scss">
// AI 总结浮层面板：右上角固定定位。
.ai-summary-host {
  position: fixed;
  top: 48px;
  right: 16px;
  z-index: 3000;
}

.ai-summary-panel {
  width: 340px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  background: var(--cp-surface);
  box-shadow: 0 4px 16px rgb(0 0 0 / 15%);
  font-size: 13px;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--cp-border);
    color: var(--cp-text);
  }

  &__title {
    flex: 1;
    font-weight: 600;
  }

  &__body {
    padding: 12px;
  }

  &__label {
    margin-bottom: 6px;
    color: var(--cp-text-muted, #999);
  }

  &__textarea {
    width: 100%;
  }

  &__actions {
    margin-top: 8px;
    text-align: right;
  }

  &__error {
    margin-top: 8px;
    color: var(--td-error-color, #d54941);
    font-size: 12px;
  }

  &__hint {
    margin-top: 8px;
    color: var(--cp-text-muted, #999);
    font-size: 11px;
    line-height: 1.5;
  }

  &__result {
    margin-top: 10px;
    padding: 10px;
    border: 1px solid var(--cp-border);
    border-radius: 6px;
    background: var(--cp-accent-soft, rgb(0 82 217 / 4%));
  }

  &__result-title {
    margin-bottom: 6px;
    font-weight: 600;
    color: var(--cp-text);
  }

  &__cached {
    font-size: 11px;
    font-weight: 400;
    color: var(--cp-text-muted, #999);
  }

  &__result-body {
    color: var(--cp-text);
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__result-meta {
    margin-top: 6px;
    font-size: 11px;
    color: var(--cp-text-muted, #999);
  }

  &__result-source {
    margin-top: 2px;
    font-size: 11px;
    color: var(--cp-text-muted, #999);
  }
}
</style>
