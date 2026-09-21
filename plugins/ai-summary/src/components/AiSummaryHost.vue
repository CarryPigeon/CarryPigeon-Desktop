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
          <t-button size="small" :loading="loading" @click="summarize(currentChannelId)">
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { getContext } from "../host/bridge";
import { createLogger } from "../shared/logger";
import {
  buildSummarizeRequestBody,
  parseSummarizeResponse,
  type SummarizeResult,
} from "../domain/summarizeRequest";
import { t } from "../i18n";

const logger = createLogger("AiSummaryHost");

/** 总结结果缓存存储 key（按频道隔离） */
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

/** 从插件存储读取缓存结果（容错：异常或形状不符时视为无缓存）。 */
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

/** 执行总结：打开面板 → 读缓存 → 发起 POST /api/ai/summarize → 缓存结果。 */
async function summarize(channelId: string): Promise<void> {
  const ch = String(channelId ?? "").trim();
  visible.value = true;
  errorText.value = "";
  if (!ch) {
    logger.warn("ai_summary_no_channel");
    errorText.value = t("ai_summary_failed");
    return;
  }
  currentChannelId.value = ch;

  // 先展示该频道的缓存结果（若有）。
  const cached = await loadCachedResult(ch);
  if (cached && !result.value) {
    result.value = cached;
    fromCache.value = true;
  }

  const requestBody = buildSummarizeRequestBody(ch, messageText.value);
  if (requestBody.messages.length === 0) {
    errorText.value = t("ai_summary_empty_messages");
    return;
  }

  loading.value = true;
  try {
    // 网络能力由 "network" 权限注入；相对路径会被宿主拼接到当前 server origin。
    const res = await getContext().host.network?.fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!res || !res.ok) {
      logger.warn("ai_summary_fetch_failed", { status: res?.status ?? -1 });
      errorText.value = t("ai_summary_failed");
      return;
    }
    const parsed = parseSummarizeResponse(res.bodyText);
    if (!parsed.ok) {
      logger.warn("ai_summary_parse_failed", { error: parsed.error });
      errorText.value = t("ai_summary_failed");
      return;
    }
    result.value = parsed.result;
    fromCache.value = false;
    // 结果按频道缓存。
    try {
      await getContext().host.storage.set(resultStorageKey(ch), {
        summary: parsed.result.summary,
        channelId: ch,
        messageCount: parsed.result.messageCount,
      });
    } catch (e) {
      logger.warn("ai_summary_cache_save_failed", { error: String(e) });
    }
  } catch (e) {
    logger.error("ai_summary_request_error", { error: String(e) });
    errorText.value = t("ai_summary_failed");
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
}
</style>
