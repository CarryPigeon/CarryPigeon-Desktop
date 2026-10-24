<template>
  <!-- 组件：AiProviderSettings｜职责：插件自管 AI provider 配置（服务来源 / 密钥 / 模型 / 高级参数） -->
  <div class="ai-provider-settings">
    <!-- 区块：状态胶囊｜用途：展示当前配置是否可用 -->
    <div class="ai-provider-settings__status" :data-state="statusState">
      <span class="ai-provider-settings__dot" />
      <span>{{ statusText }}</span>
    </div>

    <!-- 区块：服务来源 -->
    <div class="ai-provider-settings__row">
      <label class="ai-provider-settings__label" for="ai-provider-settings-provider">
        {{ t("ai_settings_provider") }}
      </label>
      <div class="ai-provider-settings__controlWrap">
        <select
          id="ai-provider-settings-provider"
          v-model="providerId"
          class="ai-provider-settings__control"
          data-testid="ai-provider-select"
        >
          <option v-for="preset in presets" :key="preset.id" :value="preset.id">
            {{ preset.label }}
          </option>
        </select>
      </div>
    </div>
    <div v-if="presetHint" class="ai-provider-settings__hint">{{ presetHint }}</div>

    <div class="ai-provider-settings__row">
      <label class="ai-provider-settings__label" for="ai-provider-settings-base-url">
        {{ t("ai_settings_base_url") }}
      </label>
      <input
        id="ai-provider-settings-base-url"
        v-model.trim="baseUrl"
        class="ai-provider-settings__control"
        data-testid="ai-provider-base-url"
        type="text"
        spellcheck="false"
        placeholder="https://api.example.com/v1"
      />
    </div>

    <div class="ai-provider-settings__row">
      <label class="ai-provider-settings__label" for="ai-provider-settings-model">
        {{ t("ai_settings_model") }}
      </label>
      <div class="ai-provider-settings__inline">
        <input
          id="ai-provider-settings-model"
          v-model.trim="model"
          class="ai-provider-settings__control"
          data-testid="ai-provider-model"
          type="text"
          spellcheck="false"
          :placeholder="t('ai_settings_model_placeholder')"
        />
        <button
          class="ai-provider-settings__btn"
          data-testid="ai-provider-fetch-models"
          type="button"
          :disabled="fetchingModels"
          @click="fetchModels"
        >
          {{ fetchingModels ? t("ai_settings_fetching") : t("ai_settings_fetch_models") }}
        </button>
      </div>
    </div>

    <div v-if="models.length > 0" class="ai-provider-settings__row">
      <label class="ai-provider-settings__label" for="ai-provider-settings-model-pick">
        {{ t("ai_settings_model_pick") }}
      </label>
      <div class="ai-provider-settings__controlWrap">
        <select
          id="ai-provider-settings-model-pick"
          class="ai-provider-settings__control"
          @change="onModelPick"
        >
          <option value="">{{ t("ai_settings_model_pick_placeholder") }}</option>
          <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
    </div>

    <div v-if="requiresApiKey" class="ai-provider-settings__row">
      <label class="ai-provider-settings__label" for="ai-provider-settings-key">
        {{ t("ai_settings_api_key") }}
      </label>
      <div class="ai-provider-settings__inline">
        <input
          id="ai-provider-settings-key"
          v-model="apiKeyInput"
          class="ai-provider-settings__control"
          data-testid="ai-provider-api-key"
          type="password"
          autocomplete="off"
          spellcheck="false"
          :placeholder="t('ai_settings_api_key_placeholder')"
        />
        <button
          class="ai-provider-settings__btn ai-provider-settings__btn--primary"
          data-testid="ai-provider-save-key"
          type="button"
          :disabled="savingKey || apiKeyInput.trim() === ''"
          @click="saveKey"
        >
          {{ t("ai_settings_save_key") }}
        </button>
        <button
          class="ai-provider-settings__btn"
          data-testid="ai-provider-clear-key"
          type="button"
          :disabled="savingKey || !secretConfigured"
          @click="clearKey"
        >
          {{ t("ai_settings_clear_key") }}
        </button>
      </div>
      <div class="ai-provider-settings__hint">
        {{ secretConfigured ? t("ai_settings_api_key_saved") : t("ai_settings_api_key_not_set") }} ·
        {{ t("ai_settings_secret_hint") }}
      </div>
    </div>

    <details class="ai-provider-settings__advanced">
      <summary>{{ t("ai_settings_advanced") }}</summary>
      <div class="ai-provider-settings__advancedBody">
        <div class="ai-provider-settings__row">
          <label class="ai-provider-settings__label" for="ai-provider-settings-temp">
            {{ t("ai_settings_temperature") }}
          </label>
          <input
            id="ai-provider-settings-temp"
            v-model.number="temperature"
            class="ai-provider-settings__control"
            type="number"
            min="0"
            max="2"
            step="0.1"
          />
        </div>
        <div class="ai-provider-settings__row">
          <label class="ai-provider-settings__label" for="ai-provider-settings-timeout">
            {{ t("ai_settings_timeout") }}
          </label>
          <input
            id="ai-provider-settings-timeout"
            v-model.number="timeoutMs"
            class="ai-provider-settings__control"
            type="number"
            min="1000"
            max="120000"
            step="1000"
          />
        </div>
        <div class="ai-provider-settings__row ai-provider-settings__row--area">
          <label class="ai-provider-settings__label" for="ai-provider-settings-prompt">
            {{ t("ai_settings_system_prompt") }}
          </label>
          <textarea
            id="ai-provider-settings-prompt"
            v-model="systemPrompt"
            class="ai-provider-settings__control"
            rows="3"
            :placeholder="t('ai_settings_system_prompt_placeholder')"
          />
        </div>
      </div>
    </details>

    <div v-if="message" class="ai-provider-settings__msg" :data-tone="message.tone">
      {{ message.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview AI 总结插件的 provider 设置项控件（从宿主「AI 服务」设置迁移）。
 * @description
 * 由插件入口通过 `ctx.ui.registerSettingsItem` 注册到宿主设置页「插件设置」分区。
 *
 * 安全说明：
 * - API Key 仅经 `ctx.secrets.set` 单向写入系统凭据管理器，本组件不保存、不回读明文；
 * - 其余非敏感配置（provider/base URL/模型/提示词/采样参数）经 `ctx.storage` 按 server 持久化。
 */

import { computed, onMounted, ref, watch } from "vue";
import {
  AI_PROVIDER_PRESETS,
  getAiProviderPreset,
  resolveAiTarget,
  type AiProviderId,
} from "../domain/aiProvider";
import { fetchProviderModels, getProviderSecretStatus } from "../host/clientAi";
import { getContext } from "../host/bridge";
import { API_KEY_SECRET_NAME } from "../domain/openaiClient";
import { applyProviderConfig, ensureProviderLoaded, useProviderConfig } from "../host/providerConfig";
import { t } from "../i18n";

const presets = AI_PROVIDER_PRESETS;
const config = useProviderConfig();

/** 表单字段（直接映射配置对象，watch 统一持久化）。 */
const providerId = computed<AiProviderId>({
  get: () => config.value.providerId,
  set: (next) => onProviderChange(next),
});
const baseUrl = computed({
  get: () => config.value.baseUrl,
  set: (v) => update({ baseUrl: v }),
});
const model = computed({
  get: () => config.value.model,
  set: (v) => update({ model: v }),
});
const systemPrompt = computed({
  get: () => config.value.systemPrompt,
  set: (v) => update({ systemPrompt: v }),
});
const temperature = computed({
  get: () => config.value.temperature,
  set: (v) => update({ temperature: v }),
});
const timeoutMs = computed({
  get: () => config.value.timeoutMs,
  set: (v) => update({ timeoutMs: v }),
});

const secretConfigured = ref(false);
const secureStorageAvailable = ref(true);
const apiKeyInput = ref("");
const models = ref<string[]>([]);
const fetchingModels = ref(false);
const savingKey = ref(false);
const message = ref<{ tone: "ok" | "error"; text: string } | null>(null);

/** 当前预设（未知 id 由领域层回退到首个预设）。 */
const preset = computed(() => getAiProviderPreset(config.value.providerId));
const presetHint = computed(() => preset.value.hint);
const requiresApiKey = computed(() => preset.value.requiresApiKey);

/** 目标是否解析成功（base URL + 模型名齐全）。 */
const targetReady = computed(() => resolveAiTarget(config.value) !== null);

/** 状态胶囊的展示状态与文案。 */
const statusState = computed(() => {
  if (!targetReady.value) return "pending";
  if (!requiresApiKey.value || secretConfigured.value) return "ready";
  return "pending";
});
const statusText = computed(() => {
  if (!targetReady.value) return t("ai_settings_status_not_ready");
  if (!requiresApiKey.value || secretConfigured.value) return t("ai_settings_status_ready");
  if (!secureStorageAvailable.value) return t("ai_settings_secure_storage_unavailable");
  return t("ai_settings_status_not_ready");
});

/**
 * 更新配置片段并即时持久化（storage 写入成本低，无需额外"保存"按钮）。
 *
 * @param patch - 待合并的字段。
 */
function update(patch: Partial<typeof config.value>): void {
  applyProviderConfig({ ...config.value, ...patch });
}

/**
 * 切换 provider：套用预设默认 base URL / 模型并标记"已显式选择"
 * （用于区分「未配置可回退」与「配置不完整需提示」）。
 *
 * @param next - 目标 provider id。
 */
function onProviderChange(next: AiProviderId): void {
  const p = getAiProviderPreset(next);
  applyProviderConfig({
    ...config.value,
    providerId: next,
    baseUrl: p.baseUrl,
    model: p.model,
    providerChosen: true,
  });
  models.value = [];
  apiKeyInput.value = "";
  message.value = null;
}

/**
 * 刷新密钥状态（不发起 AI 请求）。
 */
async function refreshSecretStatus(): Promise<void> {
  const status = await getProviderSecretStatus();
  secretConfigured.value = status.configured;
  secureStorageAvailable.value = status.secureStorageAvailable;
}

/**
 * 拉取模型列表（`GET {baseUrl}/models`）。
 */
async function fetchModels(): Promise<void> {
  if (fetchingModels.value) return;
  if (!config.value.baseUrl.trim()) {
    message.value = { tone: "error", text: t("ai_settings_base_url_required") };
    return;
  }
  fetchingModels.value = true;
  try {
    const res = await fetchProviderModels({
      baseUrl: config.value.baseUrl,
      timeoutMs: config.value.timeoutMs,
      requiresApiKey: preset.value.requiresApiKey,
    });
    if (!res.ok) {
      message.value = {
        tone: "error",
        text: `${t("ai_settings_models_failed")}${res.status > 0 ? ` (HTTP ${res.status})` : ""}${res.error ? ` ${res.error}` : ""}`,
      };
      models.value = [];
      return;
    }
    models.value = res.models;
    message.value = {
      tone: "ok",
      text: t("ai_settings_models_loaded", { count: res.models.length }),
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
  if (value) update({ model: value });
}

/**
 * 保存 API Key（只写不读；成功后清空输入框）。
 */
async function saveKey(): Promise<void> {
  const key = apiKeyInput.value.trim();
  if (!key) {
    message.value = { tone: "error", text: t("ai_settings_enter_key") };
    return;
  }
  savingKey.value = true;
  try {
    await getContext().secrets?.set(API_KEY_SECRET_NAME, key);
    apiKeyInput.value = "";
    await refreshSecretStatus();
    message.value = {
      tone: secretConfigured.value || !secureStorageAvailable.value ? "ok" : "error",
      text: secureStorageAvailable.value
        ? t("ai_settings_key_saved_toast")
        : t("ai_settings_secure_storage_unavailable"),
    };
  } catch (e) {
    message.value = { tone: "error", text: `${t("ai_settings_key_save_failed")} ${String(e)}` };
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
    await getContext().secrets?.clear(API_KEY_SECRET_NAME);
    await refreshSecretStatus();
    message.value = { tone: "ok", text: t("ai_settings_key_cleared_toast") };
  } catch (e) {
    message.value = { tone: "error", text: `${t("ai_settings_key_clear_failed")} ${String(e)}` };
  } finally {
    savingKey.value = false;
  }
}

// 影响"是否就绪"的字段变化时刷新密钥状态（provider 切换改变是否需要密钥）。
watch(
  () => config.value.providerId,
  () => {
    void refreshSecretStatus();
  },
);

onMounted(() => {
  void ensureProviderLoaded().then(() => refreshSecretStatus());
});
</script>

<style scoped lang="scss">
// 设置项控件：使用宿主全局 --cp-* 变量，与设置页卡片风格保持一致。
.ai-provider-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-provider-settings__status {
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

.ai-provider-settings__status[data-state="ready"] {
  border-color: color-mix(in oklab, var(--cp-accent) 45%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 10%, transparent);
  color: var(--cp-accent);
}

.ai-provider-settings__dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentcolor;
}

.ai-provider-settings__row {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.ai-provider-settings__row--area {
  align-items: start;
}

.ai-provider-settings__label {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--cp-text-muted);
}

.ai-provider-settings__control {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  background: var(--cp-field-bg, var(--cp-panel-muted));
  color: var(--cp-text);
  font-size: 12.5px;
  line-height: 1.4;
  padding: 6px 10px;
}

.ai-provider-settings__controlWrap {
  position: relative;
  min-width: 0;
}

.ai-provider-settings__inline {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ai-provider-settings__inline .ai-provider-settings__control {
  flex: 1;
  width: auto;
}

.ai-provider-settings__hint {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.ai-provider-settings__btn {
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0 12px;
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

.ai-provider-settings__btn:hover:not(:disabled) {
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.ai-provider-settings__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ai-provider-settings__btn--primary {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
}

.ai-provider-settings__advanced {
  border-top: 1px solid var(--cp-border-light);
  padding-top: 10px;
  font-size: 12.5px;
  color: var(--cp-text-muted);
}

.ai-provider-settings__advanced summary {
  cursor: pointer;
}

.ai-provider-settings__advancedBody {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
}

.ai-provider-settings__msg {
  font-size: 12px;
  line-height: 1.5;
}

.ai-provider-settings__msg[data-tone="ok"] {
  color: var(--cp-accent);
}

.ai-provider-settings__msg[data-tone="error"] {
  color: var(--cp-danger);
}

// 窄面板：标签与控件上下堆叠。
@media (max-width: 560px) {
  .ai-provider-settings__row {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 4px;
  }

  .ai-provider-settings__inline {
    flex-wrap: wrap;
  }
}
</style>
