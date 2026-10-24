<script setup lang="ts">
/**
 * @fileoverview PluginCenterFilterRail.vue
 * @description plugins｜组件：PluginCenterFilterRail（插件中心左侧筛选栏）。
 *
 * 职责：
 * - 提供搜索、状态筛选、来源筛选入口。
 * - 提供 Repo Sources 管理入口（本地持久化在 repoSourcesStore）。
 * - 提供 Required Gate 概览入口（缺失必装插件数量 + 快捷操作）。
 *
 * 说明：
 * - 该组件仅负责 UI 展示与事件派发；数据刷新/写入逻辑由父组件实现。
 * - 注释中文；日志英文（本组件不主动输出日志）。
 */

import { useI18n } from "vue-i18n";
import AppIcon from "@/shared/ui/AppIcon.vue";
import type { RepoSource } from "@/features/plugins/contracts/repoSource";

type FilterKind = "all" | "installed" | "enabled" | "failed" | "updates" | "required";
type SourceKind = "all" | "server" | "repo";

const props = defineProps<{
  q: string;
  filter: FilterKind;
  source: SourceKind;
  enabledRepoCount: number;
  repoSources: readonly Readonly<RepoSource>[];
  showRepoManager: boolean;
  repoDraft: string;
  repoNoteDraft: string;
  repoError: string;
  missingRequiredCount: number;
}>();

const emit = defineEmits<{
  (e: "update:q", v: string): void;
  (e: "update:filter", v: FilterKind): void;
  (e: "update:source", v: SourceKind): void;
  (e: "update:showRepoManager", v: boolean): void;
  (e: "update:repoDraft", v: string): void;
  (e: "update:repoNoteDraft", v: string): void;
  (e: "addRepo"): void;
  (e: "toggleRepo", id: string, enabled: boolean): void;
  (e: "removeRepo", id: string): void;
  (e: "openRequired"): void;
  (e: "recheckRequired"): void;
}>();

const { t } = useI18n();

/**
 * 同步搜索框输入到父组件（保持与 t-input 清空按钮相同的 `update:q` 契约）。
 *
 * @param event - 原生输入事件。
 */
function handleSearchInput(event: Event): void {
  emit("update:q", (event.target as HTMLInputElement).value);
}

/**
 * 清空搜索关键字。
 */
function clearSearch(): void {
  emit("update:q", "");
}
</script>

<template>
  <!-- 组件：PluginCenterFilterRail｜职责：插件中心左侧筛选栏（设置页 rail 风格） -->
  <!-- 区块：<aside> .cp-plugins__filters -->
  <aside class="cp-plugins__filters">
    <!-- 区头：标题 + 说明 -->
    <header class="cp-plugins__railHead">
      <div class="cp-plugins__filtersTitle">{{ t("module_rack") }}</div>
      <div class="cp-plugins__filtersSub">{{ t("module_rack_sub") }}</div>
    </header>

    <!-- 区块：搜索字段｜用途：按关键字过滤插件目录 -->
    <div class="cp-plugins__search" role="search">
      <AppIcon class="cp-plugins__searchIcon" name="search" :size="15" />
      <input
        class="cp-plugins__searchInput"
        type="text"
        role="searchbox"
        :value="props.q"
        :aria-label="t('plugin_search_placeholder')"
        :placeholder="t('plugin_search_placeholder')"
        @input="handleSearchInput"
      />
      <button
        v-if="props.q"
        class="cp-plugins__searchClear"
        type="button"
        :aria-label="t('settings_search_clear')"
        :title="t('settings_search_clear')"
        @click="clearSearch()"
      >
        <AppIcon name="close" :size="14" />
      </button>
    </div>

    <!-- 区块：状态筛选｜用途：分段控件（与工作台分段同规格） -->
    <div class="cp-plugins__group">
      <div class="cp-plugins__label">{{ t("plugin_filter") }}</div>
      <div class="cp-seg" role="group" :aria-label="t('plugin_filter')">
        <button class="cp-seg__btn" :data-active="props.filter === 'all'" type="button" @click="emit('update:filter', 'all')">{{ t("plugin_filter_all") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'installed'" type="button" @click="emit('update:filter', 'installed')">{{ t("plugin_filter_installed") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'enabled'" type="button" @click="emit('update:filter', 'enabled')">{{ t("plugin_filter_enabled") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'failed'" type="button" @click="emit('update:filter', 'failed')">{{ t("plugin_filter_failed") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'updates'" type="button" @click="emit('update:filter', 'updates')">{{ t("plugin_filter_updates") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'required'" type="button" @click="emit('update:filter', 'required')">{{ t("plugin_filter_required") }}</button>
      </div>
    </div>

    <!-- 区块：来源筛选｜用途：服务端 / 仓库来源 -->
    <div class="cp-plugins__group">
      <div class="cp-plugins__label">{{ t("plugin_source") }}</div>
      <div class="cp-seg" role="group" :aria-label="t('plugin_source')">
        <button class="cp-seg__btn" :data-active="props.source === 'all'" type="button" @click="emit('update:source', 'all')">{{ t("plugin_filter_source_all") }}</button>
        <button class="cp-seg__btn" :data-active="props.source === 'server'" type="button" @click="emit('update:source', 'server')">{{ t("plugin_filter_source_server") }}</button>
        <button class="cp-seg__btn" :data-active="props.source === 'repo'" type="button" @click="emit('update:source', 'repo')">{{ t("plugin_filter_source_repo") }}</button>
      </div>
    </div>

    <!-- 区块：Repo Sources｜用途：仓库来源启停 / 新增 / 删除 -->
    <div class="cp-plugins__group">
      <div class="cp-plugins__label">{{ t("repo_sources") }}</div>
      <div class="cp-plugins__repoMeta">
        <div class="cp-plugins__muted">{{ t("repo_enabled_count", { enabled: props.enabledRepoCount, total: props.repoSources.length }) }}</div>
        <button class="cp-plugins__repoBtn" type="button" @click="emit('update:showRepoManager', !props.showRepoManager)">
          {{ props.showRepoManager ? t("repo_hide") : t("repo_manage") }}
        </button>
      </div>
      <div v-if="props.showRepoManager" class="cp-plugins__repoPanel">
        <t-input :model-value="props.repoDraft" :placeholder="t('repo_url_placeholder')" clearable @update:model-value="emit('update:repoDraft', String($event ?? ''))" />
        <t-input :model-value="props.repoNoteDraft" :placeholder="t('repo_note_placeholder')" clearable @update:model-value="emit('update:repoNoteDraft', String($event ?? ''))" />
        <button class="cp-plugins__repoAdd" type="button" @click="emit('addRepo')">{{ t("add_repo") }}</button>
        <div v-if="props.repoError" class="cp-plugins__repoErr">{{ props.repoError }}</div>

        <div v-if="props.repoSources.length === 0" class="cp-plugins__muted">{{ t("no_repos") }}</div>
        <div v-else class="cp-plugins__repoList">
          <div v-for="r in props.repoSources" :key="r.id" class="cp-plugins__repoRow">
            <label class="cp-plugins__repoToggle">
              <input :checked="r.enabled" type="checkbox" @change="emit('toggleRepo', r.id, !r.enabled)" />
              <span>{{ t("repo_enabled_label") }}</span>
            </label>
            <div class="cp-plugins__repoInfo">
              <div class="cp-plugins__repoUrl">{{ r.baseUrl }}</div>
              <div v-if="r.note" class="cp-plugins__repoNote">{{ r.note }}</div>
            </div>
            <button class="cp-plugins__repoRemove" type="button" @click="emit('removeRepo', r.id)">{{ t("remove_repo") }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 区块：Required Gate｜用途：缺失必装插件数量与快捷操作 -->
    <div class="cp-plugins__group">
      <div class="cp-plugins__label">{{ t("plugin_required_gate") }}</div>
      <div class="cp-plugins__gate">
        <div class="cp-plugins__gateLine">
          <span class="cp-plugins__gateK">{{ t("plugin_gate_missing") }}</span>
          <span class="cp-plugins__gateV">{{ props.missingRequiredCount }}</span>
        </div>
        <button class="cp-plugins__gateBtn" type="button" @click="emit('openRequired')">{{ t("open_plugin_center_required") }}</button>
        <button class="cp-plugins__gateBtn" type="button" @click="emit('recheckRequired')">{{ t("recheck_required") }}</button>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
/* 样式：插件中心筛选栏｜规格：共享玻璃面上的透明栏位（搜索字段 / 微标签 / 分段控件 / 分组卡） */
.cp-plugins__filters {
  @include cp-region;

  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  overflow: auto;
  min-height: 0;
}

/* 区头：标题 + 说明 */
.cp-plugins__railHead {
  min-width: 0;
}

.cp-plugins__filtersTitle {
  @include cp-section-title;

  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.cp-plugins__filtersSub {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

/* 搜索字段：与工作台 rail 搜索同规格 */
.cp-plugins__search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--cp-field-height);
  padding: 0 10px;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease);
}

.cp-plugins__search:focus-within {
  border-color: var(--cp-focus-border);
  background: var(--cp-field-bg);
  box-shadow: var(--cp-focus-ring, var(--cp-ring));
}

.cp-plugins__searchIcon {
  flex: 0 0 auto;
  color: var(--cp-text-muted);
}

.cp-plugins__searchInput {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  font-family: var(--cp-font-body);
  font-size: 13px;
  line-height: 1.4;
  outline: none;
}

.cp-plugins__searchInput:focus-visible {
  box-shadow: none;
}

.cp-plugins__searchInput::placeholder {
  color: var(--cp-field-placeholder);
}

.cp-plugins__searchClear {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--cp-text-muted);
  cursor: pointer;
  transition:
    color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
}

.cp-plugins__searchClear:hover {
  color: var(--cp-text);
  background: var(--cp-hover-bg);
}

/* 分组：微标签 + 内容；工作台内不画分隔线，用上间距分组 */
.cp-plugins__group {
  padding-top: 8px;
}

.cp-plugins__label {
  @include cp-section-label;

  margin-bottom: 6px;
}

/* 分段控件：容器/选项成对使用；rail 内允许换行 */
.cp-seg {
  @include cp-segmented;

  display: flex;
  flex-wrap: wrap;
}

.cp-seg__btn {
  @include cp-segmented-item;

  flex: 1 1 auto;
  white-space: nowrap;
}

.cp-plugins__muted {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

/* Repo Sources 元信息行 */
.cp-plugins__repoMeta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cp-plugins__repoBtn {
  @include cp-pill-button;

  flex: 0 0 auto;
  min-height: 28px;
  padding: 0 10px;
  font-size: 11.5px;
}

.cp-plugins__repoPanel {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.cp-plugins__repoAdd {
  @include cp-pill-button(primary);

  min-height: 30px;
  font-size: 12px;
}

.cp-plugins__repoErr {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-danger);
}

.cp-plugins__repoList {
  display: grid;
  gap: 8px;
}

/* repo 行：内嵌分组卡（无阴影） */
.cp-plugins__repoRow {
  @include cp-card(var(--cp-radius-control));

  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px 10px;
  padding: 10px;
}

.cp-plugins__repoToggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--cp-text-muted);
  cursor: pointer;
}

.cp-plugins__repoToggle input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--cp-accent);
  cursor: pointer;
}

.cp-plugins__repoInfo {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.cp-plugins__repoUrl {
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--cp-text);
  overflow-wrap: anywhere;
}

.cp-plugins__repoNote {
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--cp-text-muted);
}

.cp-plugins__repoRemove {
  @include cp-pill-button(danger);

  min-height: 26px;
  padding: 0 9px;
  font-size: 11px;
}

/* Required Gate：内嵌分组卡 */
.cp-plugins__gate {
  @include cp-card(var(--cp-radius-control));

  padding: 12px;
}

.cp-plugins__gateLine {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.cp-plugins__gateK {
  @include cp-section-label;
}

.cp-plugins__gateV {
  font-family: var(--cp-font-mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--cp-text);
}

.cp-plugins__gateBtn {
  @include cp-pill-button;

  width: 100%;
  margin-top: 8px;
  min-height: 30px;
  font-size: 12px;
}

.cp-plugins__gateBtn + .cp-plugins__gateBtn {
  margin-top: 8px;
}

/* 响应式：纵向布局下限制 rail 高度，避免挤占内容区 */
@media (max-width: 900px) {
  .cp-plugins__filters {
    max-height: 44vh;
  }
}
</style>
