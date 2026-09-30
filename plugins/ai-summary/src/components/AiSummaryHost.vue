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
        <div class="ai-summary-panel__channel">
          <span class="ai-summary-panel__channel-name">{{ channelLabel }}</span>
          <span v-if="snapshot" class="ai-summary-panel__meta">
            {{ t("ai_summary_message_count", { count: scopedMessages.length }) }}
          </span>
        </div>
        <div v-if="loadedCountHint" class="ai-summary-panel__meta">{{ loadedCountHint }}</div>
        <div v-if="timeRangeLabel" class="ai-summary-panel__meta">
          {{ t("ai_summary_time_range", { range: timeRangeLabel }) }}
        </div>

        <!-- 区块：参与范围（时间范围 + 聊天区多选） -->
        <div v-if="snapshot" class="ai-summary-panel__scope">
          <div class="ai-summary-panel__scope-row">
            <span class="ai-summary-panel__scope-label">{{ t("ai_summary_scope_label") }}</span>
            <button
              type="button"
              class="ai-summary-panel__scope-chip"
              :class="{ 'ai-summary-panel__scope-chip--active': scopeMode === 'all' }"
              :aria-pressed="scopeMode === 'all'"
              @click="setScopeMode('all')"
            >
              {{ t("ai_summary_scope_all", { count: candidates.length }) }}
            </button>
            <button
              v-if="hasChatSelection"
              type="button"
              class="ai-summary-panel__scope-chip"
              :class="{ 'ai-summary-panel__scope-chip--active': scopeMode === 'selection' }"
              :aria-pressed="scopeMode === 'selection'"
              @click="setScopeMode('selection')"
            >
              {{ t("ai_summary_scope_selection", { count: selectedIds.length }) }}
            </button>
          </div>
          <div v-if="selectionHint" class="ai-summary-panel__hint">{{ selectionHint }}</div>
          <div class="ai-summary-panel__scope-row">
            <span class="ai-summary-panel__scope-label">{{ t("ai_summary_range_label") }}</span>
            <t-date-range-picker
              class="ai-summary-panel__range"
              size="small"
              clearable
              enable-time-picker
              :model-value="rangePickerValue"
              :placeholder="rangePlaceholder"
              :popup-props="{ attach: 'body' }"
              @update:model-value="handlePickerChange"
            />
          </div>
          <div class="ai-summary-panel__scope-row ai-summary-panel__scope-row--quick">
            <button
              v-for="preset in quickRanges"
              :key="preset.kind"
              type="button"
              class="ai-summary-panel__range-quick"
              :class="{ 'ai-summary-panel__range-quick--active': activeQuick === preset.kind }"
              :aria-pressed="activeQuick === preset.kind"
              @click="applyQuickRange(preset.kind)"
            >
              {{ t(preset.labelKey) }}
            </button>
          </div>
        </div>

        <div v-if="reading" class="ai-summary-panel__hint">{{ t("ai_summary_reading") }}</div>
        <div v-if="truncated" class="ai-summary-panel__hint">
          {{ t("ai_summary_truncated", { count: snapshot?.messages.length ?? 0 }) }}
        </div>
        <div v-if="snapshot?.hasMoreHistory" class="ai-summary-panel__hint">
          {{ t("ai_summary_more_history") }}
        </div>
        <div v-if="scopeEmpty" class="ai-summary-panel__hint">{{ t("ai_summary_scope_empty") }}</div>
        <div class="ai-summary-panel__actions">
          <t-button
            v-if="canLoadMore"
            class="ai-summary-panel__load-more"
            size="small"
            variant="outline"
            :disabled="loading || reading"
            @click="handleLoadMore"
          >
            {{ t("ai_summary_load_more") }}
          </t-button>
          <t-button
            class="ai-summary-panel__run"
            size="small"
            :loading="loading"
            :disabled="reading || !snapshot || scopeEmpty"
            @click="regenerate"
          >
            {{ result ? t("ai_summary_regenerate") : t("ai_summary_run") }}
          </t-button>
        </div>
        <div v-if="noticeText" class="ai-summary-panel__hint">{{ noticeText }}</div>
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
import type {
  PluginAiFailureCode,
  PluginChannelMessage,
  PluginCurrentChannelMessagesSnapshot,
} from "@/features/plugins/api-types";
import { getContext } from "../host/bridge";
import { createLogger } from "../shared/logger";
import {
  buildChannelMessageLines,
  buildSummarizeRequestBody,
  isCacheFresh,
  latestMessageIdOf,
  parseCachedSummary,
  parseSummarizeResponse,
  type CachedSummary,
  type SummarizeResult,
  type SummarySource,
} from "../domain/summarizeRequest";
import {
  computeScopeFingerprint,
  filterMessagesByRange,
  normalizeTimeRange,
  quickRangeOf,
  resolveScopeMessages,
  type QuickRangeKind,
  type ScopeMode,
  type ScopeTimeRange,
} from "../domain/summarizeScope";
import { t } from "../i18n";

const logger = createLogger("AiSummaryHost");

/** 宿主频道消息读取能力（`host.messages`）。 */
type HostMessagesApi = NonNullable<ReturnType<typeof getContext>["host"]["messages"]>;

/** 日期区间选择器的绑定值（与 TDesign `DateRangeValue` 兼容）。 */
type RangePickerValue = Array<Date | string | number>;

/** 快速范围按钮定义。 */
const quickRanges: Array<{ kind: QuickRangeKind; labelKey: string }> = [
  { kind: "none", labelKey: "ai_summary_range_none" },
  { kind: "hour", labelKey: "ai_summary_range_hour" },
  { kind: "today", labelKey: "ai_summary_range_today" },
  { kind: "week", labelKey: "ai_summary_range_week" },
];

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
const reading = ref(false);
const loading = ref(false);
const currentChannelId = ref("");
const currentChannelName = ref("");
const snapshot = ref<PluginCurrentChannelMessagesSnapshot | null>(null);
const result = ref<SummarizeResult | null>(null);
const fromCache = ref(false);
const errorText = ref("");
const noticeText = ref("");
const source = ref<SummarySource | null>(null);

/** 参与范围：时间范围（ms 端点；null = 该侧不限）。 */
const rangeStartMs = ref<number | null>(null);
const rangeEndMs = ref<number | null>(null);
/** 当前生效的快速范围预设（手动选择自定义区间时置空）。 */
const activeQuick = ref<QuickRangeKind | null>("none");
/**
 * 用户手动指定的消息范围模式。
 *
 * `null` 表示跟随聊天区多选：打开面板时若聊天区有可参与的多选消息，默认"仅选中"。
 */
const modeOverride = ref<ScopeMode | null>(null);

/** 面板标题栏右侧的频道标签（读取失败时回退为空，不展示占位名）。 */
const channelLabel = computed(() => currentChannelName.value || currentChannelId.value);

/** 归一化后的参与时间范围。 */
const timeRange = computed(() =>
  normalizeTimeRange({ startMs: rangeStartMs.value, endMs: rangeEndMs.value }),
);

/** 频道已载入的消息（旧宿主可能不提供字段，做防御式读取）。 */
const allMessages = computed<PluginChannelMessage[]>(() => {
  const raw = snapshot.value?.messages;
  return Array.isArray(raw) ? raw : [];
});

/** 聊天区当前多选中、且本次快照中可参与总结的消息 id。 */
const selectedIds = computed<string[]>(() => {
  const raw = snapshot.value?.selectedMessageIds;
  return Array.isArray(raw) ? raw : [];
});

/** 聊天区当前多选的原始条数（含不可参与总结的条目）。 */
const chatSelectionTotal = computed(() => {
  const raw = Number(snapshot.value?.selectedTotalCount);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0;
});

/** 是否有聊天区多选可作为范围。 */
const hasChatSelection = computed(() => chatSelectionTotal.value > 0);

/** 当前生效的消息范围模式（未手动指定时跟随聊天区多选）。 */
const scopeMode = computed<ScopeMode>(
  () => modeOverride.value ?? (selectedIds.value.length > 0 ? "selection" : "all"),
);

/** 时间范围内的候选消息（"全部"口径的计数用）。 */
const candidates = computed(() => filterMessagesByRange(allMessages.value, timeRange.value));

/** 实际参与总结的消息（时间范围 ∩ 消息范围，时间升序）。 */
const scopedMessages = computed(() =>
  resolveScopeMessages(allMessages.value, timeRange.value, scopeMode.value, selectedIds.value),
);

/** 范围为空（频道有消息但被范围排除）：提示且禁用生成按钮。 */
const scopeEmpty = computed(
  () => Boolean(snapshot.value) && allMessages.value.length > 0 && scopedMessages.value.length === 0,
);

/** 参与条数少于已载入条数时的说明文案。 */
const loadedCountHint = computed(() => {
  const loaded = allMessages.value.length;
  if (!snapshot.value || loaded === 0 || scopedMessages.value.length >= loaded) return "";
  return t("ai_summary_loaded_count", { loaded });
});

/** 多选相关提示：无多选时给可发现性引导；部分选中项不可参与时给出解释。 */
const selectionHint = computed(() => {
  if (!snapshot.value) return "";
  if (!hasChatSelection.value) return t("ai_summary_scope_selection_hint");
  if (chatSelectionTotal.value > selectedIds.value.length) {
    return t("ai_summary_scope_selection_partial", {
      total: chatSelectionTotal.value,
      usable: selectedIds.value.length,
    });
  }
  return "";
});

/** 日期区间选择器的绑定值（ms ↔ Date）。 */
const rangePickerValue = computed<RangePickerValue>(() => {
  const { startMs, endMs } = timeRange.value;
  const value: RangePickerValue = [];
  if (startMs !== null) value.push(new Date(startMs));
  if (endMs !== null) value.push(new Date(endMs));
  return value;
});

/** 选择器占位文案（起止两端）。 */
const rangePlaceholder = computed(() => [
  t("ai_summary_range_placeholder"),
  t("ai_summary_range_placeholder"),
]);

/** 参与总结消息的时间范围（HH:mm–HH:mm）；不足一条时不展示。 */
const timeRangeLabel = computed(() => {
  const messages = scopedMessages.value;
  if (messages.length === 0) return "";
  const first = Number(messages[0]?.timeMs) || 0;
  const last = Number(messages[messages.length - 1]?.timeMs) || 0;
  if (!first || !last) return "";
  if (first === last) return formatClock(first);
  return `${formatClock(first)} – ${formatClock(last)}`;
});

/**
 * 时间戳 → 本地 HH:mm。
 *
 * @param ms - 时间戳（ms）。
 * @returns 展示用时间。
 */
function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** 是否因超过单次上限被裁剪。 */
const truncated = computed(() => Boolean(snapshot.value?.truncated));

/** 是否可继续向更早历史翻页。 */
const canLoadMore = computed(() => Boolean(snapshot.value?.hasMoreHistory));

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
 * 读取宿主注入的 `host.messages` 能力（未注入/读取失败时返回 undefined）。
 *
 * @returns 频道消息读取能力或 undefined。
 */
function getHostMessages(): HostMessagesApi | undefined {
  try {
    return getContext().host.messages;
  } catch {
    return undefined;
  }
}

/**
 * 应用一个时间范围（归一化：逆序交换、结束补到分钟末尾）。
 *
 * @param range - 待应用的端点。
 * @param quick - 对应的快速范围预设；自定义区间传 `null`。
 */
function applyRange(range: Partial<ScopeTimeRange>, quick: QuickRangeKind | null = null): void {
  const normalized = normalizeTimeRange(range);
  rangeStartMs.value = normalized.startMs;
  rangeEndMs.value = normalized.endMs;
  activeQuick.value = quick;
}

/**
 * 应用快速范围预设（不限 / 最近 1 小时 / 今天 / 最近 7 天）。
 *
 * @param kind - 预设类型。
 */
function applyQuickRange(kind: QuickRangeKind): void {
  applyRange(quickRangeOf(kind, Date.now()), kind);
}

/**
 * 日期区间选择器变化回调（同时承担"清除"：空值 → 不限时间）。
 *
 * @param value - TDesign 传入的区间值（Date/字符串/时间戳混排）。
 */
function handlePickerChange(value: unknown): void {
  const list = Array.isArray(value) ? value : [];
  const startRaw = list[0] == null ? Number.NaN : new Date(list[0]).getTime();
  const endRaw = list[1] == null ? Number.NaN : new Date(list[1]).getTime();
  applyRange({
    startMs: Number.isFinite(startRaw) ? startRaw : null,
    endMs: Number.isFinite(endRaw) ? endRaw : null,
  });
}

/**
 * 手动指定消息范围模式（"全部" / "仅选中"）。
 *
 * @param mode - 目标模式。
 */
function setScopeMode(mode: ScopeMode): void {
  modeOverride.value = mode;
}

/**
 * 从插件存储读取缓存（容错：异常或形状不符时视为无缓存）。
 *
 * @param channelId - 频道 id。
 * @returns 缓存或 null。
 */
async function loadCachedSummary(channelId: string): Promise<CachedSummary | null> {
  try {
    const raw = await getContext().host.storage.get(resultStorageKey(channelId));
    return parseCachedSummary(raw);
  } catch (e) {
    logger.warn("ai_summary_cache_load_failed", { error: String(e) });
    return null;
  }
}

/**
 * 展示缓存结果并标明来源。
 *
 * @param cached - 已落盘缓存。
 */
function applyCached(cached: CachedSummary): void {
  result.value = {
    summary: cached.summary,
    channelId: cached.channelId || currentChannelId.value,
    messageCount: cached.messageCount,
  };
  fromCache.value = true;
  source.value =
    cached.sourceKind === "client"
      ? { kind: "client", provider: cached.provider, model: cached.model }
      : { kind: "server" };
}

/**
 * 落盘结果与来源（只保存摘要与指纹，绝不保存消息正文；缓存失败不影响本次展示）。
 *
 * @param summary - 总结正文。
 * @param messageCount - 参与总结的消息条数（用于缓存新鲜度判定）。
 * @param messages - 参与总结的消息（用于记录集合指纹与末条 id）。
 * @param src - 结果来源。
 */
async function saveResult(
  summary: string,
  messageCount: number,
  messages: readonly PluginChannelMessage[],
  src: SummarySource,
): Promise<void> {
  try {
    const payload: CachedSummary = {
      summary,
      channelId: currentChannelId.value,
      messageCount,
      latestMessageId: latestMessageIdOf(messages),
      scopeFingerprint: computeScopeFingerprint(messages),
      capturedAtMs: Date.now(),
      sourceKind: src.kind,
      provider: src.kind === "client" ? src.provider : "",
      model: src.kind === "client" ? src.model : "",
    };
    await getContext().host.storage.set(resultStorageKey(currentChannelId.value), payload);
  } catch (e) {
    logger.warn("ai_summary_cache_save_failed", { error: String(e) });
  }
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
 * 读取宿主当前频道的消息快照，并同步面板状态。
 *
 * 频道变化时清空上一频道的结果、来源与范围设置，避免跨频道残留。
 *
 * @param messagesApi - 宿主频道消息读取能力。
 * @returns 快照；宿主未选择频道或读取失败时返回 null（已写入错误文案）。
 */
async function readSnapshot(
  messagesApi: HostMessagesApi,
): Promise<PluginCurrentChannelMessagesSnapshot | null> {
  reading.value = true;
  try {
    const snap = await messagesApi.readCurrentChannel();
    const nextId = String(snap?.channelId ?? "").trim();
    if (!nextId) {
      logger.warn("ai_summary_no_current_channel");
      errorText.value = t("ai_summary_no_channel");
      return null;
    }
    if (currentChannelId.value !== nextId) {
      result.value = null;
      fromCache.value = false;
      source.value = null;
      noticeText.value = "";
      // 范围按频道隔离：切换频道后回到"不限时间 + 跟随聊天多选"。
      modeOverride.value = null;
      rangeStartMs.value = null;
      rangeEndMs.value = null;
      activeQuick.value = "none";
    }
    currentChannelId.value = nextId;
    currentChannelName.value = String(snap.channelName ?? "").trim() || nextId;
    snapshot.value = snap;
    return snap;
  } catch (e) {
    logger.error("ai_summary_read_failed", { error: String(e) });
    errorText.value = failedText();
    return null;
  } finally {
    reading.value = false;
  }
}

/**
 * 执行总结请求。
 *
 * 顺序：
 * 1. 客户端 AI（`host.ai.summarize`，用户自配 provider，密钥由宿主代持）；
 * 2. 未配置客户端 AI（`not-configured`）→ 回退服务端 `/api/ai/summarize`；
 * 3. 已配置但调用失败 → 直接给出可操作提示，**不静默回退**（否则用户会误以为
 *    自己配的模型在生效）。
 *
 * @param channelId - 频道 id。
 * @param messages - 参与总结的频道消息（已按范围收敛）。
 */
async function requestSummary(
  channelId: string,
  messages: readonly PluginChannelMessage[],
): Promise<void> {
  loading.value = true;
  try {
    const ai = getHostAi();
    if (ai) {
      const client = await ai.summarize({ channelId, messages: buildChannelMessageLines(messages) });
      if (client.ok) {
        result.value = {
          summary: client.summary,
          channelId,
          messageCount: messages.length,
        };
        fromCache.value = false;
        source.value = { kind: "client", provider: client.provider, model: client.model };
        await saveResult(client.summary, messages.length, messages, source.value);
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
    const requestBody = buildSummarizeRequestBody(channelId, messages);
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
    await saveResult(parsed.result.summary, messages.length, messages, source.value);
  } catch (e) {
    logger.error("ai_summary_request_error", { error: String(e) });
    errorText.value = failedText();
  } finally {
    loading.value = false;
  }
}

/**
 * 重新读取当前频道并按需生成总结。
 *
 * 缓存新鲜度以"实际参与总结的消息集合指纹"判定：范围与时间线都未变时直接复用，
 * 因此翻页载入范围外历史不会产生多余请求。
 *
 * @param requestedChannelId - 工具栏点击时注入的频道 id（用于漂移校验；数据以宿主快照为准）。
 * @param force - 为 true 时忽略新鲜缓存，强制重新生成。
 */
async function refresh(requestedChannelId: string, force: boolean): Promise<void> {
  const messagesApi = getHostMessages();
  if (!messagesApi) {
    logger.warn("ai_summary_messages_api_missing");
    errorText.value = t("ai_summary_unsupported_host");
    return;
  }
  const snap = await readSnapshot(messagesApi);
  if (!snap) return;
  if (snap.channelId !== requestedChannelId) {
    // 面板总结的始终是宿主当前频道（点击后用户可能已切换频道）。
    logger.warn("ai_summary_channel_drift", { requested: requestedChannelId, actual: snap.channelId });
  }
  if (snap.messages.length === 0) {
    errorText.value = t("ai_summary_empty_messages");
    return;
  }

  const scoped = scopedMessages.value;
  if (scoped.length === 0) {
    // 范围把消息全部排除（时间范围过窄 / 多选消息不可参与）：给出可操作提示且不发请求。
    logger.warn("ai_summary_scope_empty", {
      mode: scopeMode.value,
      rangeStartMs: timeRange.value.startMs ?? -1,
      rangeEndMs: timeRange.value.endMs ?? -1,
    });
    errorText.value = t("ai_summary_scope_empty");
    return;
  }

  const cached = await loadCachedSummary(snap.channelId);
  if (cached && !force && isCacheFresh(cached, scoped)) {
    // 参与总结的消息集合未变：直接复用缓存，避免同一批消息重复消耗 token。
    applyCached(cached);
    return;
  }
  if (cached) applyCached(cached);

  await requestSummary(snap.channelId, scoped);
}

/**
 * 执行总结（工具栏入口；`AiSummaryHost` 经 `defineExpose` 暴露给插件入口）。
 *
 * @param channelId - 宿主注入的当前频道 id。
 */
async function summarize(channelId: string): Promise<void> {
  visible.value = true;
  errorText.value = "";
  noticeText.value = "";
  // 每次打开都重新跟随聊天区多选（用户手动切换的范围模式不跨次保留）。
  modeOverride.value = null;
  if (reading.value || loading.value) return;
  const ch = String(channelId ?? "").trim();
  if (!ch) {
    // 未选择频道：给出可操作的提示，而不是笼统的「请求失败」（也不发请求）。
    logger.warn("ai_summary_no_channel");
    errorText.value = t("ai_summary_no_channel");
    return;
  }
  await refresh(ch, false);
}

/** 忽略缓存强制重新生成（面板「重新生成」按钮）。 */
async function regenerate(): Promise<void> {
  errorText.value = "";
  noticeText.value = "";
  if (reading.value || loading.value) return;
  await refresh(currentChannelId.value, true);
}

/**
 * 向更早历史翻页一页并按需重新生成总结（面板「加载更多历史」按钮）。
 *
 * 说明：翻页会向聊天视图补入更早消息，属显式用户动作；若新载入的消息落入当前范围，
 * 集合指纹随之变化并自动重新生成；范围未变时直接命中缓存，不产生多余请求。
 */
async function handleLoadMore(): Promise<void> {
  if (reading.value || loading.value) return;
  errorText.value = "";
  noticeText.value = "";
  const messagesApi = getHostMessages();
  if (!messagesApi) {
    logger.warn("ai_summary_messages_api_missing");
    errorText.value = t("ai_summary_unsupported_host");
    return;
  }

  reading.value = true;
  let loadResult: Awaited<ReturnType<HostMessagesApi["loadMoreHistory"]>> | null = null;
  try {
    loadResult = await messagesApi.loadMoreHistory();
  } catch (e) {
    logger.warn("ai_summary_load_more_failed", { error: String(e) });
  } finally {
    reading.value = false;
  }

  if (!loadResult) {
    errorText.value = t("ai_summary_load_more_failed");
    return;
  }
  if (loadResult.loadedDelta <= 0) {
    if (loadResult.hasMore) {
      errorText.value = t("ai_summary_load_more_failed");
    } else {
      noticeText.value = t("ai_summary_load_more_none");
    }
    return;
  }
  noticeText.value = t("ai_summary_load_more_done", { count: loadResult.loadedDelta });
  await refresh(currentChannelId.value, false);
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
  width: 380px;
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

  &__channel {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
    color: var(--cp-text);
  }

  &__channel-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    margin-bottom: 4px;
    color: var(--cp-text-muted, #999);
    font-size: 11px;
  }

  // 参与范围区：范围 chip + 时间范围选择器。
  &__scope {
    margin: 8px 0;
    padding: 8px;
    border: 1px solid var(--cp-border);
    border-radius: 6px;
  }

  &__scope-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;

    &--quick {
      margin-bottom: 0;
    }
  }

  &__scope-label {
    color: var(--cp-text-muted, #999);
    font-size: 11px;
  }

  &__scope-chip {
    padding: 4px 8px;
    border: 1px solid var(--cp-border);
    border-radius: 12px;
    background: transparent;
    color: var(--cp-text);
    font-size: 11px;
    cursor: pointer;

    &--active {
      border-color: var(--cp-accent, #0052d9);
      background: var(--cp-accent-soft, rgb(0 82 217 / 8%));
      color: var(--cp-accent, #0052d9);
    }
  }

  &__range {
    flex: 1;
    min-width: 200px;
  }

  &__range-quick {
    padding: 2px 6px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: transparent;
    color: var(--cp-text-muted, #999);
    font-size: 11px;
    cursor: pointer;

    &--active {
      border-color: var(--cp-border);
      color: var(--cp-text);
    }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
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
