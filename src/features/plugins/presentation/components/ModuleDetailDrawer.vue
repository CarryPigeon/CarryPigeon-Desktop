<script setup lang="ts">
/**
 * @fileoverview ModuleDetailDrawer.vue
 * @description plugins｜组件：ModuleDetailDrawer。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { resolveLatestPluginCatalogVersion } from "@/features/plugins/domain/types/pluginTypes";
import type {
  InstalledPluginStateLike,
  PluginCatalogEntryLike,
} from "@/features/plugins/domain/types/pluginTypes";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
type PluginCatalogViewEntry = PluginCatalogEntryLike;
type InstalledStateView = InstalledPluginStateLike;

const props = withDefaults(
  defineProps<{
    open: boolean;
    plugin: PluginCatalogViewEntry | null;
    installed: InstalledStateView | null;
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
 * 判断插件是否可安装（尚未安装任何版本）。
 *
 * @returns 需要显示安装按钮则为 `true`。
 */
function computeCanInstall(): boolean {
  return Boolean(props.plugin && !props.installed?.currentVersion);
}

const canInstall = computed(computeCanInstall);

/**
 * 判断插件是否可启用（已安装但未启用）。
 *
 * @returns 需要显示启用按钮则为 `true`。
 */
function computeCanEnable(): boolean {
  return Boolean(props.plugin && props.installed?.currentVersion && !props.installed.enabled);
}

const canEnable = computed(computeCanEnable);

/**
 * 判断插件是否可禁用（当前为启用态）。
 *
 * @returns 需要显示禁用按钮则为 `true`。
 */
function computeCanDisable(): boolean {
  return Boolean(props.plugin && props.installed?.enabled);
}

const canDisable = computed(computeCanDisable);

/**
 * 判断是否可回滚（存在至少一个不同于 currentVersion 的已安装版本）。
 *
 * @returns 需要显示回滚按钮则为 `true`。
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
 * 判断抽屉是否处于锁定态（缺少 server_id 或其他 gate）。
 *
 * @returns 需要禁用所有动作则为 `true`。
 */
function computeLocked(): boolean {
  return Boolean(props.disabled);
}

const locked = computed(computeLocked);

/**
 * 格式化插件提供的 domains 标签，供抽屉展示使用。
 *
 * @returns 拼接后的标签文本；为空时返回 `"—"`。
 */
function computeDomainLabelsText(): string {
  const plugin = props.plugin;
  if (!plugin) return "—";
  const labels: string[] = [];
  for (const d of plugin.providesDomains) labels.push(d.label);
  return labels.join(" · ") || "—";
}

const domainLabelsText = computed(computeDomainLabelsText);

/**
 * 计算“安装”按钮默认使用的最新版本号。
 *
 * @returns 最新版本号；缺失时返回空字符串。
 */
function computeInstallLatestVersion(): string {
  const plugin = props.plugin;
  if (!plugin) return "";
  return resolveLatestPluginCatalogVersion(plugin);
}

const installLatestVersion = computed(computeInstallLatestVersion);

const { t } = useI18n();

/**
 * 关闭抽屉。
 *
 * @returns 无返回值。
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
          <LabelBadge v-if="props.plugin.required" variant="required" :label="t('badge_required')" :title="t('module_required')" />
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
        <div class="cp-drawer__label">{{ t("module_detail_drawer_domains") }}</div>
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
          @click="emit('install', installLatestVersion)"
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
/* 样式：插件详情抽屉｜规格：微标签分区 + 内嵌分组卡 + 胶囊按钮（与设置页一致） */
.cp-drawer {
  position: relative;
  padding: 16px 16px 20px;
  color: var(--cp-text);
}

.cp-drawer--empty {
  color: var(--cp-text-muted);
  font-size: 13px;
}

/* 锁定提示：warn 状态条 */
.cp-drawer__lock {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--cp-warn-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-warn-bg);
}

.cp-drawer__lockTitle {
  @include cp-section-label;

  color: var(--cp-warn);
}

.cp-drawer__lockSub {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-drawer__sub {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.cp-drawer__tagline {
  min-width: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-drawer__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

/* 分区：细线分隔 + 微标签 */
.cp-drawer__section {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

.cp-drawer__label {
  @include cp-section-label;

  margin-bottom: 8px;
}

.cp-drawer__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.cp-drawer__pill {
  padding: 6px 10px;
  border: 1px solid var(--cp-border);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cp-drawer__ports {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.cp-drawer__port {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px var(--cp-border-light);
}

.cp-drawer__portsText {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 权限行：内嵌分组卡（high/medium 用状态 token） */
.cp-perms {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-perm {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
}

.cp-perm__key {
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  color: var(--cp-text-muted);
}

.cp-perm__label {
  font-size: 12px;
  color: var(--cp-text);
}

.cp-perm__risk {
  @include cp-section-label;

  font-size: 11px;
}

.cp-perm[data-risk="high"] {
  border-color: var(--cp-danger-border);
  background: var(--cp-danger-bg);
}

.cp-perm[data-risk="medium"] {
  border-color: var(--cp-warn-border);
  background: var(--cp-warn-bg);
}

/* 上次错误：danger 状态条 */
.cp-drawer__error {
  padding: 10px 12px;
  border: 1px solid var(--cp-danger-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-danger-bg);
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text);
  overflow-wrap: anywhere;
}

/* installed 三列键值：内嵌分组卡 */
.cp-drawer__kv {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.cp-kv {
  padding: 10px;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
}

.cp-kv__k {
  @include cp-section-label;

  font-size: 10.5px;
}

.cp-kv__v {
  margin-top: 6px;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  overflow-wrap: anywhere;
}

/* 版本切换：分段控件（与设置页分段同规格） */
.cp-versions {
  @include cp-segmented;

  display: flex;
  flex-wrap: wrap;
}

.cp-version {
  @include cp-segmented-item;

  font-family: var(--cp-font-mono);
  font-size: 12px;
}

.cp-version:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cp-drawer__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

/* 动作按钮：主操作 highlight、其余默认 */
.cp-drawer__btn {
  @include cp-pill-button;

  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
}

.cp-drawer__btn.primary {
  @include cp-pill-button(primary);

  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
</style>
