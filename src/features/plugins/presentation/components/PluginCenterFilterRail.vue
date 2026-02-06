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
import type { RepoSource } from "@/features/plugins/presentation/store";

type FilterKind = "all" | "installed" | "enabled" | "failed" | "updates" | "required";
type SourceKind = "all" | "server" | "repo";

const props = defineProps<{
  q: string;
  filter: FilterKind;
  source: SourceKind;
  enabledRepoCount: number;
  repoSources: RepoSource[];
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
</script>

<template>
  <!-- 组件：PluginCenterFilterRail｜职责：插件中心左侧筛选栏 -->
  <!-- 区块：<aside> .cp-plugins__filters -->
  <aside class="cp-plugins__filters">
    <div class="cp-plugins__filtersTitle">MODULE RACK</div>
    <div class="cp-plugins__filtersSub">Search · Filter · Source</div>

    <div class="cp-plugins__search">
      <t-input :model-value="props.q" :placeholder="t('plugin_search_placeholder')" clearable @update:model-value="emit('update:q', String($event ?? ''))" />
    </div>

    <div class="cp-plugins__group">
      <div class="cp-plugins__label">Filter</div>
      <div class="cp-seg">
        <button class="cp-seg__btn" :data-active="props.filter === 'all'" type="button" @click="emit('update:filter', 'all')">{{ t("plugin_filter_all") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'installed'" type="button" @click="emit('update:filter', 'installed')">{{ t("plugin_filter_installed") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'enabled'" type="button" @click="emit('update:filter', 'enabled')">{{ t("plugin_filter_enabled") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'failed'" type="button" @click="emit('update:filter', 'failed')">{{ t("plugin_filter_failed") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'updates'" type="button" @click="emit('update:filter', 'updates')">{{ t("plugin_filter_updates") }}</button>
        <button class="cp-seg__btn" :data-active="props.filter === 'required'" type="button" @click="emit('update:filter', 'required')">{{ t("plugin_filter_required") }}</button>
      </div>
    </div>

    <div class="cp-plugins__group">
      <div class="cp-plugins__label">Source</div>
      <div class="cp-seg">
        <button class="cp-seg__btn" :data-active="props.source === 'all'" type="button" @click="emit('update:source', 'all')">All</button>
        <button class="cp-seg__btn" :data-active="props.source === 'server'" type="button" @click="emit('update:source', 'server')">Server</button>
        <button class="cp-seg__btn" :data-active="props.source === 'repo'" type="button" @click="emit('update:source', 'repo')">Repo</button>
      </div>
    </div>

    <div class="cp-plugins__group">
      <div class="cp-plugins__label">Repo Sources</div>
      <div class="cp-plugins__repoMeta">
        <div class="cp-plugins__muted">{{ props.enabledRepoCount }} enabled · {{ props.repoSources.length }} total</div>
        <button class="cp-plugins__repoBtn" type="button" @click="emit('update:showRepoManager', !props.showRepoManager)">
          {{ props.showRepoManager ? "Hide" : "Manage" }}
        </button>
      </div>
      <div v-if="props.showRepoManager" class="cp-plugins__repoPanel">
        <t-input :model-value="props.repoDraft" placeholder="https://repo.example.com" clearable @update:model-value="emit('update:repoDraft', String($event ?? ''))" />
        <t-input :model-value="props.repoNoteDraft" placeholder="Note (optional)" clearable @update:model-value="emit('update:repoNoteDraft', String($event ?? ''))" />
        <button class="cp-plugins__repoAdd" type="button" @click="emit('addRepo')">Add Repo</button>
        <div v-if="props.repoError" class="cp-plugins__repoErr">{{ props.repoError }}</div>

        <div v-if="props.repoSources.length === 0" class="cp-plugins__muted">No repos added.</div>
        <div v-else class="cp-plugins__repoList">
          <div v-for="r in props.repoSources" :key="r.id" class="cp-plugins__repoRow">
            <label class="cp-plugins__repoToggle">
              <input :checked="r.enabled" type="checkbox" @change="emit('toggleRepo', r.id, !r.enabled)" />
              <span>Enabled</span>
            </label>
            <div class="cp-plugins__repoInfo">
              <div class="cp-plugins__repoUrl">{{ r.baseUrl }}</div>
              <div v-if="r.note" class="cp-plugins__repoNote">{{ r.note }}</div>
            </div>
            <button class="cp-plugins__repoRemove" type="button" @click="emit('removeRepo', r.id)">Remove</button>
          </div>
        </div>
      </div>
    </div>

    <div class="cp-plugins__group">
      <div class="cp-plugins__label">Required Gate</div>
      <div class="cp-plugins__gate">
        <div class="cp-plugins__gateLine">
          <span class="cp-plugins__gateK">missing</span>
          <span class="cp-plugins__gateV">{{ props.missingRequiredCount }}</span>
        </div>
        <button class="cp-plugins__gateBtn" type="button" @click="emit('openRequired')">{{ t("open_plugin_center_required") }}</button>
        <button class="cp-plugins__gateBtn" type="button" @click="emit('recheckRequired')">{{ t("recheck_required") }}</button>
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；左侧为可滚动筛选栏，包含分组区块与按钮组。 */
.cp-plugins__filters {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 14px;
  box-shadow: var(--cp-shadow-soft);
  overflow: auto;
}

.cp-plugins__filtersTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text);
}

.cp-plugins__filtersSub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugins__search {
  margin-top: 12px;
}

.cp-plugins__group {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

.cp-plugins__label {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-bottom: 10px;
}

.cp-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cp-seg__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-seg__btn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
  background: var(--cp-hover-bg);
}

.cp-seg__btn[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

.cp-plugins__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugins__gate {
  border: 1px dashed rgba(148, 163, 184, 0.26);
  border-radius: 16px;
  padding: 12px;
  background: var(--cp-panel-muted);
}

.cp-plugins__gateLine {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.cp-plugins__gateK {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugins__gateV {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
}

.cp-plugins__gateBtn {
  margin-top: 10px;
  width: 100%;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-plugins__gateBtn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-plugins__repoMeta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cp-plugins__repoPanel {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.cp-plugins__repoBtn,
.cp-plugins__repoAdd,
.cp-plugins__repoRemove {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-plugins__repoBtn:hover,
.cp-plugins__repoAdd:hover,
.cp-plugins__repoRemove:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-plugins__repoErr {
  font-size: 12px;
  color: var(--cp-danger);
}

.cp-plugins__repoList {
  display: grid;
  gap: 10px;
}

.cp-plugins__repoRow {
  border: 1px solid var(--cp-border-light);
  background: rgba(255, 255, 255, 0.02);
  border-radius: 14px;
  padding: 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.cp-plugins__repoToggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--cp-text);
}

.cp-plugins__repoInfo {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.cp-plugins__repoUrl {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  overflow-wrap: anywhere;
}

.cp-plugins__repoNote {
  font-size: 12px;
  color: var(--cp-text-muted);
}
</style>
