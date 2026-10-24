<script setup lang="ts">
/**
 * @fileoverview ModuleCard.vue
 * @description plugins｜组件：ModuleCard。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { resolveLatestPluginCatalogVersion } from "@/features/plugins/domain/types/pluginTypes";
import type {
  InstalledPluginStateLike,
  PluginCatalogEntryLike,
  PluginProgress,
} from "@/features/plugins/domain/types/pluginTypes";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import ModuleProgress from "./ModuleProgress.vue";
type PluginCatalogViewEntry = PluginCatalogEntryLike;
type InstalledStateView = InstalledPluginStateLike;
type PluginProgressView = PluginProgress;

const props = defineProps<{
  plugin: PluginCatalogViewEntry;
  installed: InstalledStateView | null;
  progress: PluginProgressView | null;
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

/**
 * 计算卡片展示的版本号。
 *
 * 规则：
 * - 已安装时显示当前版本；
 * - 未安装时显示目录中的最新版本。
 *
 * @returns 版本文本；缺失时返回 `"—"`。
 */
function computeDisplayVersion(): string {
  const installed = String(props.installed?.currentVersion ?? "").trim();
  if (installed) return installed;
  const latest = resolveLatestPluginCatalogVersion(props.plugin);
  return latest || "—";
}

const displayVersion = computed(computeDisplayVersion);

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
          <span class="cp-module-card__versionValue">{{ displayVersion }}</span>
        </div>
      </div>
      <div class="cp-module-card__badges">
        <LabelBadge v-if="props.plugin.required" variant="required" :label="t('badge_required')" :title="t('module_required')" />
        <LabelBadge v-if="props.hasUpdate" variant="update" :label="t('badge_update')" :title="t('module_update')" />
        <LabelBadge v-if="isFailed" variant="failed" :label="t('badge_failed')" :title="t('module_failed')" />
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
/* 样式：插件模块卡片｜规格：内嵌分组卡（cp-card）+ 无位移 hover + 胶囊动作按钮 */
.cp-module-card {
  @include cp-card;

  position: relative;
  display: flex;
  flex-direction: column;
  padding: 14px;
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
}

/* hover 只变底色/描边，不做上浮（与工作台行列表一致） */
.cp-module-card:hover {
  border-color: var(--cp-highlight-border);
  background: color-mix(in oklab, var(--cp-panel) 88%, var(--cp-hover-bg));
}

/* 聚焦（路由 focus / 抽屉选中）：高亮描边 + ring */
.cp-module-card[data-focused="true"] {
  border-color: var(--cp-highlight-border-strong);
  box-shadow: var(--cp-highlight-ring);
}

/* 锁定遮罩：warn 状态 token，不叠加嵌套模糊 */
.cp-module-card__disabled {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 10px;
  padding: 18px;
  border: 1px dashed var(--cp-warn-border);
  border-radius: var(--cp-radius-card);
  background: color-mix(in oklab, var(--cp-panel) 84%, transparent);
}

.cp-module-card__disabledTitle {
  @include cp-section-label;

  color: var(--cp-warn);
}

.cp-module-card__disabledSub {
  font-size: 12px;
  line-height: 1.4;
  color: var(--cp-text-muted);
  text-align: center;
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
  font-size: 15px;
  line-height: 1.2;
  letter-spacing: 0.02em;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-module-card__version {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  color: var(--cp-text-muted);
}

.cp-module-card__versionLabel {
  opacity: 0.7;
}

.cp-module-card__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.cp-module-card__tagline {
  margin-top: 10px;
  min-height: 32px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--cp-text-muted);
}

.cp-module-card__mono {
  margin-top: 10px;
}

/* domain 端口点阵：保留品牌识别，仅收敛投影为边框色 */
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
  box-shadow: 0 0 0 3px var(--cp-border-light);
}

.cp-module-card__progress {
  margin-top: 12px;
}

.cp-module-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
}

/* 动作按钮：主操作用 highlight、危险操作用 danger */
.cp-module-action {
  @include cp-pill-button;

  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
}

.cp-module-action.primary {
  @include cp-pill-button(primary);

  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
}

.cp-module-action.danger {
  @include cp-pill-button(danger);

  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
</style>
