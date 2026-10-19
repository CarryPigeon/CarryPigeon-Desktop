<script setup lang="ts">
/**
 * @fileoverview AI 服务设置卡片（provider 选择 / 密钥 / 模型拉取）。
 * @description
 * 供设置页「AI 服务」分区复用：配置客户端自选的 OpenAI 兼容 AI provider。
 *
 * 安全说明：
 * - API Key 仅通过 `saveSecret` 单向写入 Rust 侧系统凭据管理器，本组件不保存、不回读明文；
 * - 其余非敏感配置（provider/base URL/模型/提示词/采样参数）落在 localStorage。
 */

import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  AI_PROVIDER_PRESETS,
  getAiCapabilities,
  getAiProviderPreset,
  type AiProviderConfig,
  type AiProviderId,
  type ClientAiStatus,
} from "../../api";
import AppIcon from "@/shared/ui/AppIcon.vue";

const { t } = useI18n();
const ai = getAiCapabilities();

const presets = AI_PROVIDER_PRESETS;
const config = ref<AiProviderConfig>(ai.getConfig());
const status = ref<ClientAiStatus | null>(null);
const secretConfigured = ref(false);
const apiKeyInput = ref("");
const models = ref<string[]>([]);
const fetchingModels = ref(false);
const savingKey = ref(false);
const message = ref<{ tone: "ok" | "error"; text: string } | null>(null);

/** 当前是否选择了客户端 provider（非"跟随服务端"）。 */
const isClientProvider = computed(() => config.value.providerId !== "server");

/** 当前预设备注。 */
const presetHint = computed(() => getAiProviderPreset(config.value.providerId).hint);

/** 状态胶囊的展示状态。 */
const statusState = computed(() => {
  if (!isClientProvider.value) return "server";
  return status.value?.ready ? "ready" : "pending";
});

/** 状态胶囊文案。 */
const statusText = computed(() => {
  if (!isClientProvider.value) return t("settings_ai_status_server");
  if (status.value?.ready) return t("settings_ai_status_ready");
  if (!status.value?.secureStorageAvailable && secretConfigured.value === false) {
    return t("settings_ai_secure_storage_unavailable");
  }
  return t("settings_ai_status_not_ready");
});

/**
 * 刷新状态快照与密钥配置状态。
 */
async function refreshStatus(): Promise<void> {
  status.value = await ai.getStatus(config.value);
  const secret = await ai.getSecretStatus(config.value.providerId);
  secretConfigured.value = secret.configured;
  if (!secret.secureStorageAvailable && isClientProvider.value) {
    status.value = { ...status.value, secureStorageAvailable: false };
  }
}

/**
 * 切换 provider：套用预设默认 base URL / 模型（用户仍可覆盖）。
 *
 * 状态刷新由 `providerId` watcher 触发，此处不重复调用。
 *
 * @param event - select 变更事件。
 */
async function onProviderChange(event: Event): Promise<void> {
  const next = (event.target as HTMLSelectElement).value as AiProviderId;
  const preset = getAiProviderPreset(next);
  config.value = {
    ...config.value,
    providerId: next,
    baseUrl: preset.baseUrl,
    model: preset.model,
  };
  models.value = [];
  apiKeyInput.value = "";
  message.value = null;
}

/**
 * 拉取模型列表（`GET {baseUrl}/models`）。
 */
async function fetchModels(): Promise<void> {
  if (fetchingModels.value) return;
  if (!config.value.baseUrl.trim()) {
    message.value = { tone: "error", text: t("settings_ai_base_url_required") };
    return;
  }
  fetchingModels.value = true;
  try {
    const res = await ai.fetchModels(config.value);
    if (!res.ok) {
      message.value = {
        tone: "error",
        text: `${t("settings_ai_models_failed")}${res.status > 0 ? ` (HTTP ${res.status})` : ""}${res.error ? ` ${res.error}` : ""}`,
      };
      models.value = [];
      return;
    }
    models.value = res.models;
    message.value = {
      tone: res.models.length > 0 ? "ok" : "error",
      text:
        res.models.length > 0
          ? t("settings_ai_models_loaded", { count: res.models.length })
          : t("settings_ai_models_empty"),
    };
  } finally {
    fetchingModels.value = false;
  }
}

/**
 * 从拉取结果中选择模型。
 *
 * @param event - select 变更事件。
 */
function onModelPick(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value) config.value = { ...config.value, model: value };
}

/**
 * 保存 API Key（只写不读；成功后清空输入框）。
 */
async function saveKey(): Promise<void> {
  const key = apiKeyInput.value.trim();
  if (!key) {
    message.value = { tone: "error", text: t("settings_ai_enter_key") };
    return;
  }
  savingKey.value = true;
  try {
    await ai.saveSecret(config.value.providerId, key);
    apiKeyInput.value = "";
    await refreshStatus();
    message.value = { tone: "ok", text: t("settings_ai_key_saved_toast") };
  } catch (e) {
    message.value = { tone: "error", text: `${t("settings_ai_key_save_failed")} ${String(e)}` };
  } finally {
    savingKey.value = false;
  }
}

/**
 * 清除已保存的 API Key。
 */
async function clearKey(): Promise<void> {
  savingKey.value = true;
  try {
    await ai.clearSecret(config.value.providerId);
    await refreshStatus();
    message.value = { tone: "ok", text: t("settings_ai_key_cleared_toast") };
  } catch (e) {
    message.value = { tone: "error", text: `${t("settings_ai_key_clear_failed")} ${String(e)}` };
  } finally {
    savingKey.value = false;
  }
}

// 配置项本地即时持久化（localStorage 写入成本极低，无需额外"保存"按钮）。
// 注意：这里刻意不回写 `config.value`——`saveConfig` 会返回新对象，回写会让
// deep watcher 自触发形成死循环；越界值由领域层在落盘时裁剪，Rust 侧再做一次兜底裁剪。
watch(
  config,
  (next) => {
    ai.saveConfig(next);
  },
  { deep: true },
);

// 影响"是否就绪"的字段变化时刷新状态：provider 切换、base URL 与模型名改动都会
// 改变可用性；其余字段（温度/超时/提示词）不影响就绪判定，无需重复打 IPC。
watch(
  () => [config.value.providerId, config.value.baseUrl, config.value.model].join("|"),
  () => {
    void refreshStatus();
  },
);

onMounted(() => {
  void refreshStatus();
});
</script>
<template>
  <!-- 组件：AiProviderSettings｜职责：AI 服务设置（服务来源 / 密钥 / 模型 / 高级参数） -->
  <div class="cp-ai">
    <!-- 区块：状态胶囊｜用途：展示当前 AI 配置是否可用 -->
    <div class="cp-ai__status" :data-state="statusState">
      <span class="cp-ai__dot" />
      <span class="cp-ai__statusText">{{ statusText }}</span>
    </div>

    <!-- 区块：服务来源 -->
    <div class="cp-ai__row">
      <label class="cp-ai__label" for="cp-ai-provider">{{ t("settings_ai_provider") }}</label>
      <div class="cp-ai__controlWrap">
        <select
          id="cp-ai-provider"
          class="cp-ai__control cp-field cp-ai__select"
          data-testid="ai-provider"
          :value="config.providerId"
          @change="onProviderChange"
        >
          <option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.label }}</option>
        </select>
        <AppIcon class="cp-ai__selectIcon" name="chevron-down" :size="14" />
      </div>
    </div>
    <div v-if="presetHint" class="cp-ai__hint cp-ai__hint--outside">{{ presetHint }}</div>

    <template v-if="isClientProvider">
      <div class="cp-ai__row">
        <label class="cp-ai__label" for="cp-ai-base-url">{{ t("settings_ai_base_url") }}</label>
        <input
          id="cp-ai-base-url"
          v-model.trim="config.baseUrl"
          class="cp-ai__control cp-field"
          data-testid="ai-base-url"
          type="text"
          spellcheck="false"
          placeholder="https://api.example.com/v1"
        />
      </div>

      <div class="cp-ai__row">
        <label class="cp-ai__label" for="cp-ai-model">{{ t("settings_ai_model") }}</label>
        <div class="cp-ai__inline">
          <input
            id="cp-ai-model"
            v-model.trim="config.model"
            class="cp-ai__control cp-field"
            data-testid="ai-model"
            type="text"
            spellcheck="false"
            :placeholder="t('settings_ai_model_placeholder')"
          />
          <button
            class="cp-ai__btn"
            data-testid="ai-fetch-models"
            type="button"
            :disabled="fetchingModels"
            @click="fetchModels"
          >
            {{ fetchingModels ? t("settings_ai_fetching") : t("settings_ai_fetch_models") }}
          </button>
        </div>
      </div>

      <div v-if="models.length > 0" class="cp-ai__row">
        <label class="cp-ai__label" for="cp-ai-model-pick">{{ t("settings_ai_model_pick") }}</label>
        <div class="cp-ai__controlWrap">
          <select id="cp-ai-model-pick" class="cp-ai__control cp-field cp-ai__select" @change="onModelPick">
            <option value="">{{ t("settings_ai_model_pick_placeholder") }}</option>
            <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
          </select>
          <AppIcon class="cp-ai__selectIcon" name="chevron-down" :size="14" />
        </div>
      </div>

      <div class="cp-ai__row">
        <label class="cp-ai__label" for="cp-ai-key">{{ t("settings_ai_api_key") }}</label>
        <div class="cp-ai__inline">
          <input
            id="cp-ai-key"
            v-model="apiKeyInput"
            class="cp-ai__control cp-field"
            data-testid="ai-api-key"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="t('settings_ai_api_key_placeholder')"
          />
          <button
            class="cp-ai__btn cp-ai__btn--primary"
            data-testid="ai-save-key"
            type="button"
            :disabled="savingKey || apiKeyInput.trim() === ''"
            @click="saveKey"
          >
            {{ t("settings_ai_save_key") }}
          </button>
          <button
            class="cp-ai__btn"
            data-testid="ai-clear-key"
            type="button"
            :disabled="savingKey || !secretConfigured"
            @click="clearKey"
          >
            {{ t("settings_ai_clear_key") }}
          </button>
        </div>
        <div class="cp-ai__hint">
          {{ secretConfigured ? t("settings_ai_api_key_saved") : t("settings_ai_api_key_not_set") }} ·
          {{ t("settings_ai_secret_hint") }}
        </div>
      </div>

      <details class="cp-ai__advanced">
        <summary class="cp-ai__summary">{{ t("settings_ai_advanced") }}</summary>
        <div class="cp-ai__advancedBody">
          <div class="cp-ai__row">
            <label class="cp-ai__label" for="cp-ai-temp">{{ t("settings_ai_temperature") }}</label>
            <input
              id="cp-ai-temp"
              v-model.number="config.temperature"
              class="cp-ai__control cp-field"
              type="number"
              min="0"
              max="2"
              step="0.1"
            />
          </div>
          <div class="cp-ai__row">
            <label class="cp-ai__label" for="cp-ai-timeout">{{ t("settings_ai_timeout") }}</label>
            <input
              id="cp-ai-timeout"
              v-model.number="config.timeoutMs"
              class="cp-ai__control cp-field"
              type="number"
              min="1000"
              max="120000"
              step="1000"
            />
          </div>
          <div class="cp-ai__row cp-ai__row--area">
            <label class="cp-ai__label" for="cp-ai-prompt">{{ t("settings_ai_system_prompt") }}</label>
            <textarea
              id="cp-ai-prompt"
              v-model="config.systemPrompt"
              class="cp-ai__control cp-field"
              rows="3"
              :placeholder="t('settings_ai_system_prompt_placeholder')"
            />
          </div>
        </div>
      </details>
    </template>

    <div v-if="message" class="cp-ai__msg" :data-tone="message.tone">{{ message.text }}</div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：AiProviderSettings（沿用宿主 `--cp-*` token，与设置页行式布局对齐） */
.cp-ai {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 状态胶囊 */
.cp-ai__status {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--cp-border);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-ai__status[data-state="ready"] {
  border-color: color-mix(in oklab, var(--cp-accent) 45%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 10%, transparent);
  color: var(--cp-accent);
}

.cp-ai__dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentcolor;
}

/* 表单行：标签列 + 控件列 */
.cp-ai__row {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.cp-ai__row--area {
  align-items: start;
}

.cp-ai__label {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--cp-text-muted);
}

/* 控件统一复用全局 `.cp-field`，此处只约束宽度 */
.cp-ai__control {
  width: 100%;
  min-width: 0;
}

.cp-ai__controlWrap {
  position: relative;
  min-width: 0;
}

.cp-ai__select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 32px !important;
  cursor: pointer;
}

.cp-ai__selectIcon {
  position: absolute;
  top: 50%;
  right: 11px;
  transform: translateY(-50%);
  color: var(--cp-text-muted);
  pointer-events: none;
}

.cp-ai__inline {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cp-ai__inline .cp-ai__control {
  flex: 1;
  width: auto;
}

/* 行内提示（居中行内第三列时跨满整行） */
.cp-ai__hint {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-ai__row > .cp-ai__hint {
  grid-column: 1 / -1;
  padding-left: 160px;
  margin-top: 2px;
}

.cp-ai__hint--outside {
  padding-left: 160px;
  margin-top: -8px;
}

.cp-ai__btn {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--cp-border);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-ai__btn:hover:not(:disabled) {
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-ai__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cp-ai__btn--primary {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
}

/* 高级参数 */
.cp-ai__advanced {
  border-top: 1px solid var(--cp-border-light);
  padding-top: 12px;
}

.cp-ai__summary {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--cp-text-muted);
  cursor: pointer;
}

.cp-ai__summary:hover {
  color: var(--cp-text);
}

.cp-ai__advancedBody {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
}

/* 结果提示 */
.cp-ai__msg {
  font-size: 12px;
  line-height: 1.5;
}

.cp-ai__msg[data-tone="ok"] {
  color: var(--cp-accent);
}

.cp-ai__msg[data-tone="error"] {
  color: var(--cp-danger);
}

/* 窄窗口：标签与控件上下堆叠 */
@media (max-width: 720px) {
  .cp-ai__row {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 6px;
  }

  .cp-ai__row > .cp-ai__hint,
  .cp-ai__hint--outside {
    padding-left: 0;
    margin-top: 0;
  }

  .cp-ai__inline {
    flex-wrap: wrap;
  }
}
</style>