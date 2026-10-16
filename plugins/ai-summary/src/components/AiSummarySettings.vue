<template>
  <!-- 组件：AiSummarySettings｜职责：插件设置项（AI 摘要后端选择） -->
  <div class="ai-summary-settings">
    <div
      class="ai-summary-settings__options"
      role="radiogroup"
      :aria-label="t('ai_summary_settings_title')"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="ai-summary-settings__option"
        role="radio"
        :aria-checked="backend === option.value"
        :data-active="backend === option.value"
        :data-testid="`ai-summary-backend-${option.value}`"
        @click="choose(option.value)"
      >
        {{ t(option.labelKey) }}
      </button>
    </div>

    <div class="ai-summary-settings__hint">{{ t(hintKey) }}</div>

    <div v-if="saveFailed" class="ai-summary-settings__error">
      {{ t("ai_summary_backend_save_failed") }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview AI 总结插件的设置项控件：选择总结后端（自动 / 仅客户端 AI / 仅服务端）。
 * @description 由插件入口通过 `ctx.ui.registerSettingsItem` 注册到宿主设置页「插件设置」分区。
 */

import { computed, onMounted, ref } from "vue";
import type { SummarizeBackend } from "../domain/summarizeBackend";
import { ensureBackendLoaded, setBackend, useBackendPreference } from "../host/backendPreference";
import { t } from "../i18n";

const backend = useBackendPreference();
const saveFailed = ref(false);

const options: ReadonlyArray<{ value: SummarizeBackend; labelKey: string; hintKey: string }> = [
  { value: "auto", labelKey: "ai_summary_backend_auto", hintKey: "ai_summary_backend_hint_auto" },
  { value: "client", labelKey: "ai_summary_backend_client", hintKey: "ai_summary_backend_hint_client" },
  { value: "server", labelKey: "ai_summary_backend_server", hintKey: "ai_summary_backend_hint_server" },
];

/** 当前档位的说明文案 key。 */
const hintKey = computed(
  () => options.find((option) => option.value === backend.value)?.hintKey ?? "ai_summary_backend_hint_auto",
);

/**
 * 切换后端档位并持久化。
 *
 * @param next - 目标档位。
 */
async function choose(next: SummarizeBackend): Promise<void> {
  saveFailed.value = false;
  const ok = await setBackend(next);
  saveFailed.value = !ok;
}

onMounted(() => {
  void ensureBackendLoaded();
});
</script>

<style scoped lang="scss">
// 设置项控件：使用宿主全局 --cp-* 变量，与设置页卡片风格保持一致。
.ai-summary-settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-summary-settings__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-summary-settings__option {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.ai-summary-settings__option:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
  background: var(--cp-hover-bg);
}

.ai-summary-settings__option[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

.ai-summary-settings__hint {
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.45;
}

.ai-summary-settings__error {
  font-size: 12px;
  color: var(--cp-danger);
}
</style>
