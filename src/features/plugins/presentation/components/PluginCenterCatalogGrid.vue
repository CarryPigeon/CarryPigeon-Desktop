<script setup lang="ts">
/**
 * @fileoverview PluginCenterCatalogGrid.vue
 * @description plugins｜组件：PluginCenterCatalogGrid。
 *
 * 职责：
 * - 渲染插件目录的状态区（锁定提示/加载/错误）与网格列表。
 * - 将 ModuleCard 的无参事件转为“带上下文”的事件，减少页面模板内的闭包与重复表达。
 */

import ModuleCard from "./ModuleCard.vue";
import type { InstalledPluginState, PluginCatalogEntry, PluginProgress } from "@/features/plugins/domain/types/pluginTypes";

type Props = {
  /**
   * 当前 server socket（可为空）。
   */
  serverSocket?: string;
  /**
   * 当前 serverId（可为空）。
   */
  serverId?: string;
  /**
   * 目录加载态（仅用于 UI 展示）。
   */
  loading: boolean;
  /**
   * 目录错误提示（为空字符串表示无错误）。
   */
  error: string;
  /**
   * 当前要渲染的插件列表（通常为已过滤后的目录）。
   */
  plugins: PluginCatalogEntry[];
  /**
   * 已安装状态映射（pluginId → state）。
   */
  installedById: Record<string, InstalledPluginState | undefined>;
  /**
   * 安装/更新进度映射（pluginId → progress）。
   */
  progressById: Record<string, PluginProgress | null | undefined>;
  /**
   * 当前抽屉选中的 pluginId（用于高亮）。
   */
  selectedId?: string;
  /**
   * 来自路由 query 的聚焦 pluginId（用于高亮）。
   */
  focusPluginId?: string;
  /**
   * 判断某插件是否存在更新。
   */
  hasUpdate: (pluginId: string) => boolean;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  install: [plugin: PluginCatalogEntry];
  update: [plugin: PluginCatalogEntry];
  enable: [pluginId: string];
  disable: [pluginId: string];
  uninstall: [pluginId: string];
  detail: [pluginId: string];
}>();

/**
 * 判断当前目录是否处于锁定态。
 *
 * 锁定条件：
 * - serverSocket 存在；
 * - 但 serverId 缺失（通常意味着 `GET /api/server` 未返回 `server_id`）。
 *
 * @returns 锁定则为 `true`。
 */
function isLocked(): boolean {
  const socket = String(props.serverSocket ?? "").trim();
  const id = String(props.serverId ?? "").trim();
  return socket !== "" && id === "";
}
</script>

<template>
  <!-- 组件：PluginCenterCatalogGrid｜职责：目录状态提示与模块网格渲染 -->
  <div v-if="serverSocket && !serverId" class="cp-plugins__state err">
    Plugin Center is locked: missing `server_id` from `GET /api/server`. Install/enable/update are disabled until fixed.
  </div>
  <div v-if="loading" class="cp-plugins__state">Loading catalog…</div>
  <div v-else-if="error" class="cp-plugins__state err">{{ error }}</div>
  <div v-else class="cp-plugins__grid">
    <ModuleCard
      v-for="p in plugins"
      :key="p.pluginId"
      :plugin="p"
      :installed="installedById[p.pluginId] ?? null"
      :progress="progressById[p.pluginId] ?? null"
      :focused="p.pluginId === selectedId || p.pluginId === focusPluginId"
      :has-update="hasUpdate(p.pluginId)"
      :disabled="isLocked()"
      disabled-reason="Missing server_id — plugin operations are disabled"
      @install="emit('install', p)"
      @update="emit('update', p)"
      @enable="emit('enable', p.pluginId)"
      @disable="emit('disable', p.pluginId)"
      @uninstall="emit('uninstall', p.pluginId)"
      @detail="emit('detail', p.pluginId)"
    />
  </div>
</template>

<style scoped lang="scss">
/* 布局与变量说明：状态区与网格使用 `cp-plugins__*` 前缀，颜色与阴影取自全局 `--cp-*` 变量。 */
.cp-plugins__state {
  padding: 18px;
  color: var(--cp-text-muted);
  font-size: 13px;
}

.cp-plugins__state.err {
  color: rgba(248, 113, 113, 0.92);
}

.cp-plugins__grid {
  padding: 14px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  min-height: 0;
}
</style>
