<script setup lang="ts">
/**
 * @fileoverview ModuleCard.vue
 * @description plugins｜组件：ModuleCard。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "@/features/plugins/domain/types/pluginTypes";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import ModuleProgress from "./ModuleProgress.vue";

const props = defineProps<{
  plugin: PluginCatalogEntry;
  installed: InstalledPluginState | null;
  progress: PluginProgress | null;
  focused?: boolean;
  hasUpdate?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}>();

const emit = defineEmits<{
  (e: "install"): void;
  (e: "update"): void;
  (e: "enable"): void;
  (e: "disable"): void;
  (e: "uninstall"): void;
  (e: "detail"): void;
}>();

/**
 * 判断模块是否已安装（存在 currentVersion）。
 *
 * @returns 已安装则为 `true`。
 */
function computeIsInstalled(): boolean {
  return Boolean(props.installed?.currentVersion);
}

const isInstalled = computed(computeIsInstalled);

/**
 * 判断模块是否处于启用且健康状态。
 *
 * @returns 启用且 status=ok 则为 `true`。
 */
function computeIsEnabled(): boolean {
  return Boolean(props.installed?.enabled && props.installed?.status === "ok");
}

const isEnabled = computed(computeIsEnabled);

/**
 * 判断模块是否处于失败态。
 *
 * @returns status=failed 则为 `true`。
 */
function computeIsFailed(): boolean {
  return Boolean(props.installed?.status === "failed");
}

const isFailed = computed(computeIsFailed);

const { t } = useI18n();

/**
 * 将 CSS 变量名转换为可直接用于 inline style 的 `var(...)` 字符串。
 *
 * @param colorVar - CSS 变量名（例如 `--cp-domain-core`）。
 * @returns 例如 `var(--cp-domain-core)`。
 */
function domainColor(colorVar: string): string {
  return `var(${colorVar})`;
}
</script>

<template>
  <!-- 组件：ModuleCard｜职责：插件模块卡片（端口/状态/动作） -->
  <!-- 区块：<article> .cp-module-card -->
  <article class="cp-module-card" :data-focused="Boolean(props.focused)">
    <div v-if="props.disabled" class="cp-module-card__disabled" :title="props.disabledReason || ''">
      <div class="cp-module-card__disabledTitle">LOCKED</div>
      <div class="cp-module-card__disabledSub">{{ props.disabledReason || "Server_id required" }}</div>
    </div>
    <header class="cp-module-card__head">
      <div class="cp-module-card__title">
        <div class="cp-module-card__name">{{ props.plugin.name }}</div>
        <div class="cp-module-card__version">
          <span class="cp-module-card__versionLabel">v</span>
          <span class="cp-module-card__versionValue">{{
            props.installed?.currentVersion || props.plugin.versions[0] || "—"
          }}</span>
        </div>
      </div>
      <div class="cp-module-card__badges">
        <LabelBadge v-if="props.plugin.required" variant="required" label="REQUIRED" :title="t('module_required')" />
        <LabelBadge v-if="props.hasUpdate" variant="update" label="UPDATE" :title="t('module_update')" />
        <LabelBadge v-if="isFailed" variant="failed" label="FAILED" :title="t('module_failed')" />
      </div>
    </header>

    <div class="cp-module-card__tagline">{{ props.plugin.tagline }}</div>
    <div class="cp-module-card__mono">
      <MonoTag :value="props.plugin.pluginId" title="plugin_id" :copyable="true" />
    </div>

    <div class="cp-ports" aria-label="domains">
      <span
        v-for="d in props.plugin.providesDomains"
        :key="d.id"
        class="cp-port"
        :title="d.label"
        :style="{ background: domainColor(d.colorVar) }"
      ></span>
    </div>

    <div v-if="props.progress" class="cp-module-card__progress">
      <ModuleProgress :progress="props.progress" />
    </div>

    <footer class="cp-module-card__actions">
      <button
        v-if="!isInstalled"
        class="cp-module-action primary"
        type="button"
        :disabled="Boolean(props.disabled)"
        @click="emit('install')"
      >
        {{ t("install") }}
      </button>
      <button
        v-else-if="props.hasUpdate"
        class="cp-module-action primary"
        type="button"
        :disabled="Boolean(props.disabled)"
        @click="emit('update')"
      >
        {{ t("update") }}
      </button>
      <button
        v-else-if="!isEnabled"
        class="cp-module-action primary"
        type="button"
        :disabled="Boolean(props.disabled)"
        @click="emit('enable')"
      >
        {{ t("enable") }}
      </button>
      <button v-else class="cp-module-action" type="button" :disabled="Boolean(props.disabled)" @click="emit('disable')">{{ t("disable") }}</button>

      <button class="cp-module-action" type="button" :disabled="Boolean(props.disabled)" @click="emit('detail')">{{ t("details") }}</button>
      <button
        v-if="isInstalled && !props.plugin.required"
        class="cp-module-action danger"
        type="button"
        :disabled="Boolean(props.disabled)"
        @click="emit('uninstall')"
      >
        {{ t("uninstall") }}
      </button>
    </footer>
  </article>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；卡片包含标题区、domain 端口点阵、进度条与动作区。 */
.cp-module-card {
  position: relative;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 14px;
  box-shadow: var(--cp-shadow-soft);
  transition:
    transform var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
}

.cp-module-card__disabled {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  background: color-mix(in oklab, var(--cp-panel) 72%, transparent);
  backdrop-filter: blur(2px);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 10px;
  padding: 18px;
  z-index: 3;
  border: 1px dashed color-mix(in oklab, var(--cp-warn) 32%, var(--cp-border));
}

.cp-module-card__disabledTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text);
}

.cp-module-card__disabledSub {
  font-size: 12px;
  color: var(--cp-text-muted);
  text-align: center;
  line-height: 1.4;
}

.cp-module-card[data-focused="true"] {
  border-color: var(--cp-highlight-border-strong);
  box-shadow:
    var(--cp-shadow-soft),
    var(--cp-highlight-ring);
}

.cp-module-card:hover {
  transform: translateY(-2px);
  border-color: var(--cp-highlight-border);
  background: color-mix(in oklab, var(--cp-panel) 86%, var(--cp-hover-bg));
}

.cp-module-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cp-module-card__title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cp-module-card__name {
  font-family: var(--cp-font-display);
  font-weight: 700;
  letter-spacing: 0.02em;
  font-size: 16px;
  color: var(--cp-text);
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-module-card__version {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-module-card__versionLabel {
  opacity: 0.7;
}

.cp-module-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.cp-module-card__tagline {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.35;
  min-height: 32px;
}

.cp-module-card__mono {
  margin-top: 10px;
}

.cp-ports {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.cp-port {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.10);
}

.cp-module-card__progress {
  margin-top: 12px;
}

.cp-module-card__actions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cp-module-action {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: var(--cp-highlight-border);
  }
}

.cp-module-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.cp-module-action.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));

  &:hover {
    border-color: rgba(34, 197, 94, 0.42);
    background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
  }
}

.cp-module-action.danger {
  border-color: color-mix(in oklab, var(--cp-danger) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 12%, var(--cp-panel-muted));

  &:hover {
    border-color: rgba(239, 68, 68, 0.46);
    background: color-mix(in oklab, var(--cp-danger) 16%, var(--cp-hover-bg));
  }
}
</style>
