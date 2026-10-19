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
/* 样式：安装/更新进度｜规格：info 状态 token + 6px 进度条 + 微标签阶段名 */
.cp-module-progress {
  padding: 10px 12px;
  border: 1px solid var(--cp-info-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-info-bg);
}

.cp-module-progress__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

/* 阶段名：微标签（固定英文状态 + 中文都保持小号大写字距） */
.cp-module-progress__stage {
  @include cp-section-label;

  font-size: 11px;
  color: var(--cp-text);
}

.cp-module-progress__pct {
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  color: var(--cp-text-muted);
}

.cp-module-progress__bar {
  margin-top: 8px;
  height: 6px;
  border-radius: 999px;
  background: var(--cp-border-light);
  overflow: hidden;
}

.cp-module-progress__barFill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--cp-info) 92%, transparent),
    var(--cp-accent)
  );
  transition: width var(--cp-slow) var(--cp-ease);
}

.cp-module-progress__msg {
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}
</style>
