<script setup lang="ts">
/**
 * @fileoverview ModuleProgress.vue
 * @description plugins｜组件：ModuleProgress。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { PluginProgress } from "@/features/plugins/domain/types/pluginTypes";

const props = defineProps<{
  progress: PluginProgress;
}>();

const { t } = useI18n();

/**
 * 将内部进度阶段映射为 i18n 文案。
 *
 * @returns 可读的阶段标签。
 */
function computeStageLabel(): string {
  const s = props.progress.stage;
  if (s === "downloading") return t("install_step_downloading");
  if (s === "verifying_sha256") return t("install_step_verifying");
  if (s === "unpacking") return t("install_step_unpacking");
  if (s === "enabling") return t("enable_step_enabling");
  if (s === "checking_updates") return t("update_step_checking");
  if (s === "switching") return t("update_step_switching");
  if (s === "rolling_back") return t("update_step_rollback");
  return s;
}

const stageLabel = computed(computeStageLabel);
</script>

<template>
  <!-- 组件：ModuleProgress｜职责：安装/启用进度（状态机映射） -->
  <!-- 区块：<div> .cp-module-progress -->
  <div class="cp-module-progress" role="status" aria-live="polite">
    <div class="cp-module-progress__row">
      <div class="cp-module-progress__stage">{{ stageLabel }}</div>
      <div class="cp-module-progress__pct">{{ Math.round(props.progress.percent) }}%</div>
    </div>
    <div class="cp-module-progress__bar">
      <div class="cp-module-progress__barFill" :style="{ width: `${Math.min(100, Math.max(0, props.progress.percent))}%` }"></div>
    </div>
    <div class="cp-module-progress__msg">{{ props.progress.message }}</div>
  </div>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；进度卡包含标题行、进度条与消息行。 */
.cp-module-progress {
  border: 1px solid color-mix(in oklab, var(--cp-info) 22%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-info) 10%, var(--cp-panel));
  border-radius: 16px;
  padding: 12px 12px 10px 12px;
  box-shadow: var(--cp-shadow-soft);
}

.cp-module-progress__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.cp-module-progress__stage {
  font-family: var(--cp-font-display);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  color: var(--cp-text);
}

.cp-module-progress__pct {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-module-progress__bar {
  margin-top: 8px;
  height: 10px;
  border-radius: 999px;
  border: 1px solid var(--cp-border);
  background: rgba(148, 163, 184, 0.10);
  overflow: hidden;
}

.cp-module-progress__barFill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--cp-info) 92%, transparent),
    color-mix(in oklab, var(--cp-accent) 92%, transparent)
  );
  box-shadow: 0 10px 24px color-mix(in oklab, var(--cp-info) 18%, transparent);
  transition: width var(--cp-slow) var(--cp-ease);
}

.cp-module-progress__msg {
  margin-top: 8px;
  font-size: 12px;
  color: var(--cp-text-muted);
}
</style>
