<script setup lang="ts">
/**
 * @fileoverview ModuleDetailDrawer.vue
 * @description Plugin detail drawer (permissions/source/sha256/domains/errors).
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { InstalledPluginState, PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    plugin: PluginCatalogEntry | null;
    installed: InstalledPluginState | null;
    hasUpdate?: boolean;
    disabled?: boolean;
    disabledReason?: string;
  }>(),
  {
    plugin: null,
    installed: null,
    hasUpdate: false,
    disabled: false,
    disabledReason: "",
  },
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "install", version: string): void;
  (e: "update"): void;
  (e: "enable"): void;
  (e: "disable"): void;
  (e: "switchVersion", version: string): void;
  (e: "rollback"): void;
}>();

/**
 * Whether the plugin can be installed (not installed yet).
 *
 * @returns `true` when install action should be shown.
 */
function computeCanInstall(): boolean {
  return Boolean(props.plugin && !props.installed?.currentVersion);
}

const canInstall = computed(computeCanInstall);

/**
 * Whether the installed plugin can be enabled.
 *
 * @returns `true` when enable action should be shown.
 */
function computeCanEnable(): boolean {
  return Boolean(props.plugin && props.installed?.currentVersion && !props.installed.enabled);
}

const canEnable = computed(computeCanEnable);

/**
 * Whether the installed plugin can be disabled.
 *
 * @returns `true` when disable action should be shown.
 */
function computeCanDisable(): boolean {
  return Boolean(props.plugin && props.installed?.enabled);
}

const canDisable = computed(computeCanDisable);

/**
 * Whether rollback is possible (at least one previous version exists).
 *
 * @returns `true` when rollback action should be shown.
 */
function computeCanRollback(): boolean {
  const versions = props.installed?.installedVersions ?? [];
  const current = props.installed?.currentVersion ?? "";
  for (const v of versions) {
    if (v && v !== current) return true;
  }
  return false;
}

const canRollback = computed(computeCanRollback);

/**
 * Whether the drawer is locked (server_id missing or other gate).
 *
 * @returns `true` when actions should be disabled.
 */
function computeLocked(): boolean {
  return Boolean(props.disabled);
}

const locked = computed(computeLocked);

/**
 * Format provides-domains labels for the drawer.
 *
 * @returns Joined domain labels, or "—" when empty.
 */
function computeDomainLabelsText(): string {
  const plugin = props.plugin;
  if (!plugin) return "—";
  const labels: string[] = [];
  for (const d of plugin.providesDomains) labels.push(d.label);
  return labels.join(" · ") || "—";
}

const domainLabelsText = computed(computeDomainLabelsText);

const { t } = useI18n();

/**
 * Close the drawer.
 *
 * @returns void
 */
function handleClose(): void {
  emit("close");
}
</script>

<template>
  <!-- 组件：ModuleDetailDrawer｜职责：插件详情抽屉 -->
  <!-- 区块：<t-drawer> -->
  <t-drawer
    :visible="props.open"
    :header="props.plugin?.name || t('module')"
    :footer="false"
    placement="right"
    size="420px"
    @close="handleClose"
  >
    <div v-if="props.plugin" class="cp-drawer">
      <div v-if="locked" class="cp-drawer__lock">
        <div class="cp-drawer__lockTitle">LOCKED</div>
        <div class="cp-drawer__lockSub">{{ props.disabledReason || "Server_id required" }}</div>
      </div>
      <div class="cp-drawer__sub">
        <div class="cp-drawer__tagline">{{ props.plugin.tagline }}</div>
        <div class="cp-drawer__badges">
          <LabelBadge v-if="props.plugin.required" variant="required" label="REQUIRED" :title="t('module_required')" />
          <LabelBadge v-if="props.hasUpdate" variant="update" label="UPDATE" :title="t('module_update')" />
          <LabelBadge v-if="props.installed?.status === 'failed'" variant="failed" label="FAILED" :title="t('module_failed')" />
        </div>
      </div>

      <div class="cp-drawer__section">
        <div class="cp-drawer__label">plugin_id</div>
        <MonoTag :value="props.plugin.pluginId" :copyable="true" />
      </div>

      <div class="cp-drawer__section">
        <div class="cp-drawer__label">{{ t("source") }}</div>
        <div class="cp-drawer__row">
          <span class="cp-drawer__pill">{{ props.plugin.source }}</span>
          <MonoTag :value="props.plugin.sha256" :title="t('checksum_sha256')" :copyable="true" />
        </div>
      </div>

      <div class="cp-drawer__section">
        <div class="cp-drawer__label">domains</div>
        <div class="cp-drawer__ports">
          <span
            v-for="d in props.plugin.providesDomains"
            :key="d.id"
            class="cp-drawer__port"
            :style="{ background: `var(${d.colorVar})` }"
            :title="d.label"
          ></span>
          <span class="cp-drawer__portsText">
            {{ domainLabelsText }}
          </span>
        </div>
      </div>

      <div class="cp-drawer__section">
        <div class="cp-drawer__label">{{ t("permissions") }}</div>
        <div class="cp-perms">
          <div v-for="p in props.plugin.permissions" :key="p.key" class="cp-perm" :data-risk="p.risk">
            <span class="cp-perm__key">{{ p.key }}</span>
            <span class="cp-perm__label">{{ p.label }}</span>
            <span class="cp-perm__risk">{{ p.risk }}</span>
          </div>
        </div>
      </div>

      <div v-if="props.installed?.lastError" class="cp-drawer__section">
        <div class="cp-drawer__label">{{ t("last_error") }}</div>
        <div class="cp-drawer__error">{{ props.installed.lastError }}</div>
      </div>

      <div class="cp-drawer__section">
        <div class="cp-drawer__label">installed</div>
        <div class="cp-drawer__kv">
          <div class="cp-kv">
            <div class="cp-kv__k">current</div>
            <div class="cp-kv__v">{{ props.installed?.currentVersion || '—' }}</div>
          </div>
          <div class="cp-kv">
            <div class="cp-kv__k">enabled</div>
            <div class="cp-kv__v">{{ props.installed?.enabled ? 'true' : 'false' }}</div>
          </div>
          <div class="cp-kv">
            <div class="cp-kv__k">status</div>
            <div class="cp-kv__v">{{ props.installed?.status || '—' }}</div>
          </div>
        </div>
      </div>

      <div v-if="props.installed?.installedVersions?.length" class="cp-drawer__section">
        <div class="cp-drawer__label">versions</div>
        <div class="cp-versions">
          <button
            v-for="v in props.installed.installedVersions"
            :key="v"
            class="cp-version"
            type="button"
            :data-active="v === props.installed?.currentVersion"
            :disabled="locked"
            @click="emit('switchVersion', v)"
          >
            {{ v }}
          </button>
        </div>
      </div>

      <div class="cp-drawer__actions">
        <button
          v-if="canInstall"
          class="cp-drawer__btn primary"
          type="button"
          :disabled="locked"
          @click="emit('install', props.plugin.versions[0] || '')"
        >
          {{ t("install") }}
        </button>
        <button
          v-else-if="props.hasUpdate"
          class="cp-drawer__btn primary"
          type="button"
          :disabled="locked"
          @click="emit('update')"
        >
          {{ t("update") }}
        </button>
        <button v-if="canEnable" class="cp-drawer__btn primary" type="button" :disabled="locked" @click="emit('enable')">{{ t("enable") }}</button>
        <button v-if="canDisable" class="cp-drawer__btn" type="button" :disabled="locked" @click="emit('disable')">{{ t("disable") }}</button>
        <button v-if="canRollback" class="cp-drawer__btn" type="button" :disabled="locked" @click="emit('rollback')">{{ t("rollback") }}</button>
      </div>
    </div>
    <div v-else class="cp-drawer cp-drawer--empty">{{ t("module_not_selected") }}</div>
  </t-drawer>
</template>

<style scoped lang="scss">
/* ModuleDetailDrawer styles */
/* Drawer content wrapper */
.cp-drawer {
  padding: 14px 14px 18px 14px;
  color: var(--cp-text);
  position: relative;
}

/* Drawer empty state */
.cp-drawer--empty {
  color: var(--cp-text-muted);
}

/* Lock banner (server_id missing) */
.cp-drawer__lock {
  border: 1px dashed color-mix(in oklab, var(--cp-warn) 32%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-warn) 10%, var(--cp-panel-muted));
  border-radius: 16px;
  padding: 12px;
  margin-bottom: 12px;
}

/* Lock banner title */
.cp-drawer__lockTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text);
}

/* Lock banner subtitle */
.cp-drawer__lockSub {
  margin-top: 8px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.4;
}

/* Subheader: tagline + badges */
.cp-drawer__sub {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

/* Tagline text */
.cp-drawer__tagline {
  color: var(--cp-text-muted);
  font-size: 12px;
  line-height: 1.35;
}

/* Badges row */
.cp-drawer__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

/* Section wrapper */
.cp-drawer__section {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

/* Section label */
.cp-drawer__label {
  font-family: var(--cp-font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-bottom: 8px;
}

/* Section row layout */
.cp-drawer__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Mono pill */
.cp-drawer__pill {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  font-family: var(--cp-font-mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Domains row */
.cp-drawer__ports {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Single domain dot */
.cp-drawer__port {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-border) 70%, transparent);
}

/* Domains list text */
.cp-drawer__portsText {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Permissions wrapper */
.cp-perms {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Permission row */
.cp-perm {
  display: grid;
  grid-template-columns: 96px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
}

/* Permission key */
.cp-perm__key {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Permission label */
.cp-perm__label {
  font-size: 12px;
  color: var(--cp-text);
}

/* Permission risk */
.cp-perm__risk {
  font-family: var(--cp-font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* Permission variant: high risk */
.cp-perm[data-risk="high"] {
  border-color: color-mix(in oklab, var(--cp-danger) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}

/* Permission variant: medium risk */
.cp-perm[data-risk="medium"] {
  border-color: color-mix(in oklab, var(--cp-warn) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-warn) 10%, var(--cp-panel-muted));
}

/* Last error box */
.cp-drawer__error {
  border: 1px dashed rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.10);
  border-radius: 14px;
  padding: 10px 10px;
  font-size: 12px;
  color: var(--cp-text);
}

/* Installed kv grid */
.cp-drawer__kv {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

/* KV item */
.cp-kv {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 14px;
  padding: 10px;
}

/* KV key */
.cp-kv__k {
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* KV value */
.cp-kv__v {
  margin-top: 6px;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
}

/* Actions row */
.cp-drawer__actions {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Versions row */
.cp-versions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Single version button */
.cp-version {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 10px;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

/* Disabled version */
.cp-version:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Version hover */
.cp-version:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: color-mix(in oklab, var(--cp-info) 26%, var(--cp-border));
}

/* Active version */
.cp-version[data-active="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel-muted));
}

/* Drawer action button */
.cp-drawer__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);

  /* Button hover */
  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: var(--cp-highlight-border);
  }
}

/* Drawer action disabled */
.cp-drawer__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Drawer primary action */
.cp-drawer__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));

  /* Primary hover */
  &:hover {
    border-color: rgba(34, 197, 94, 0.42);
    background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
  }
}
</style>
