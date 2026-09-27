<template>
  <div class="cp-ai">
    <div class="cp-ai__status" :data-state="statusState">
      <span class="cp-ai__dot" />
      <span class="cp-ai__statusText">{{ statusText }}</span>
    </div>

    <div class="cp-ai__row">
      <label class="cp-ai__label" for="cp-ai-provider">{{ t("settings_ai_provider") }}</label>
      <select
        id="cp-ai-provider"
        class="cp-ai__control"
        data-testid="ai-provider"
        :value="config.providerId"
        @change="onProviderChange"
      >
        <option v-for="preset in presets" :key="preset.id" :value="preset.id">{{ preset.label }}</option>
      </select>
    </div>
    <div v-if="presetHint" class="cp-ai__hint">{{ presetHint }}</div>

    <template v-if="isClientProvider">
      <div class="cp-ai__row">
        <label class="cp-ai__label" for="cp-ai-base-url">{{ t("settings_ai_base_url") }}</label>
        <input
          id="cp-ai-base-url"
          v-model.trim="config.baseUrl"
          class="cp-ai__control"
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
            class="cp-ai__control"
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
        <select id="cp-ai-model-pick" class="cp-ai__control" @change="onModelPick">
          <option value="">{{ t("settings_ai_model_pick_placeholder") }}</option>
          <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <div class="cp-ai__row">
        <label class="cp-ai__label" for="cp-ai-key">{{ t("settings_ai_api_key") }}</label>
        <div class="cp-ai__inline">
          <input
            id="cp-ai-key"
            v-model="apiKeyInput"
            class="cp-ai__control"
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
        <div class="cp-ai__row">
          <label class="cp-ai__label" for="cp-ai-temp">{{ t("settings_ai_temperature") }}</label>
          <input
            id="cp-ai-temp"
            v-model.number="config.temperature"
            class="cp-ai__control"
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
            class="cp-ai__control"
            type="number"
            min="1000"
            max="120000"
            step="1000"
          />
        </div>
        <div class="cp-ai__row">
          <label class="cp-ai__label" for="cp-ai-prompt">{{ t("settings_ai_system_prompt") }}</label>
          <textarea
            id="cp-ai-prompt"
            v-model="config.systemPrompt"
            class="cp-ai__control cp-ai__control--area"
            rows="3"
            :placeholder="t('settings_ai_system_prompt_placeholder')"
          />
        </div>
      </details>
    </template>

    <div v-if="message" class="cp-ai__msg" :data-tone="message.tone">{{ message.text }}</div>
  </div>
</template>

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

<style scoped lang="scss">
// AI 服务设置卡片：沿用宿主 CSS 变量，避免引入额外主题依赖。
.cp-ai {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    padding: 3px 10px;
    border: 1px solid var(--cp-border);
    border-radius: 999px;
    font-size: 12px;
    color: var(--cp-text-muted, #999);

    &[data-state="ready"] {
      border-color: var(--cp-accent, #0052d9);
      color: var(--cp-accent, #0052d9);
    }
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentcolor;
  }

  &__row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__label {
    font-size: 12px;
    color: var(--cp-text-muted, #999);
  }

  &__control {
    width: 100%;
    padding: 5px 8px;
    border: 1px solid var(--cp-border);
    border-radius: 4px;
    background: var(--cp-surface);
    color: var(--cp-text);
    font-size: 13px;

    &--area {
      resize: vertical;
      font-family: inherit;
    }
  }

  &__inline {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  &__btn {
    flex: 0 0 auto;
    padding: 5px 10px;
    border: 1px solid var(--cp-border);
    border-radius: 4px;
    background: var(--cp-surface);
    color: var(--cp-text);
    font-size: 12px;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &--primary {
      border-color: var(--cp-accent, #0052d9);
      color: var(--cp-accent, #0052d9);
    }
  }

  &__hint {
    font-size: 11px;
    line-height: 1.5;
    color: var(--cp-text-muted, #999);
  }

  &__advanced {
    border-top: 1px solid var(--cp-border);
    padding-top: 8px;
  }

  &__summary {
    font-size: 12px;
    color: var(--cp-text-muted, #999);
    cursor: pointer;
    margin-bottom: 8px;
  }

  &__msg {
    font-size: 12px;

    &[data-tone="ok"] {
      color: var(--cp-accent, #0052d9);
    }

    &[data-tone="error"] {
      color: var(--td-error-color, #d54941);
    }
  }
}
</style>
