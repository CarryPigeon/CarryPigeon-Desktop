<script setup lang="ts">
/**
 * @fileoverview PluginCenterPage.vue
 * @description plugins｜页面：PluginCenterPage。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { addRepoSource, createPluginContext, enabledRepoSources, removeRepoSource, repoSources, setRepoSourceEnabled } from "@/features/plugins/api";
import ModuleDetailDrawer from "../components/ModuleDetailDrawer.vue";
import PluginCenterFilterRail from "../components/PluginCenterFilterRail.vue";
import PluginCenterGridHeader from "../components/PluginCenterGridHeader.vue";
import PluginCenterCatalogGrid from "../components/PluginCenterCatalogGrid.vue";
import type { PluginCatalogEntry } from "@/features/plugins/api";
import { useCurrentServerContext } from "@/features/servers/api";
import {
  type PluginCenterFilterKind,
  type PluginCenterSourceKind,
  usePluginCenterCatalogView,
} from "@/features/plugins/presentation/composables/usePluginCenterCatalogView";

const route = useRoute();
const router = useRouter();

const filter = ref<PluginCenterFilterKind>((String(route.query.filter ?? "all") as PluginCenterFilterKind) || "all");
const source = ref<PluginCenterSourceKind>((String(route.query.source ?? "all") as PluginCenterSourceKind) || "all");
const q = ref(String(route.query.q ?? ""));

const selectedId = ref<string>("");
const drawerOpen = ref(false);
const repoDraft = ref<string>("");
const repoNoteDraft = ref<string>("");
const repoError = ref<string>("");
const showRepoManager = ref<boolean>(false);

const { socket: serverSocket, serverInfoStore, serverId, refreshServerInfo } = useCurrentServerContext();
const requiredPluginsDeclared = computed(() => serverInfoStore.value.info.value?.requiredPlugins ?? null);
const { catalogStore, installStore, requiredIds, refreshCatalog, refreshInstalled } = createPluginContext({ socket: serverSocket, requiredPluginsDeclared });

/**
 * 新增 Repo Source，并尽力刷新目录。
 *
 * @returns 无返回值。
 */
function handleAddRepo(): void {
  repoError.value = "";
  const base = repoDraft.value.trim();
  const note = repoNoteDraft.value.trim();
  const created = addRepoSource(base, note || undefined);
  if (!created) {
    repoError.value = "Invalid repo URL (must be http/https).";
    return;
  }
  repoDraft.value = "";
  repoNoteDraft.value = "";
  if (serverSocket.value) void refreshCatalog();
}

/**
 * 切换 Repo Source 启用态，并刷新目录。
 *
 * @param id - Repo source id。
 * @param enabled - 目标启用态。
 * @returns 无返回值。
 */
function handleToggleRepo(id: string, enabled: boolean): void {
  setRepoSourceEnabled(id, enabled);
  if (serverSocket.value) void refreshCatalog();
}

/**
 * 删除 Repo Source，并刷新目录。
 *
 * @param id - Repo source id。
 * @returns 无返回值。
 */
function handleRemoveRepo(id: string): void {
  removeRepoSource(id);
  if (serverSocket.value) void refreshCatalog();
}

const { byId, filtered, hasUpdate } = usePluginCenterCatalogView({ filter, source, q, catalogStore, installStore });

/**
 * 网格事件：安装插件（默认安装最新版本）。
 *
 * @param plugin - 目标插件。
 */
function handleCardInstall(plugin: PluginCatalogEntry): void {
  void installStore.value.install(plugin, plugin.versions[0] || "");
}

/**
 * 网格事件：更新插件到最新版本。
 *
 * @param plugin - 目标插件。
 */
function handleCardUpdate(plugin: PluginCatalogEntry): void {
  void installStore.value.updateToLatest(plugin, plugin.versions[0] || "");
}

/**
 * 网格事件：启用插件。
 *
 * @param pluginId - 插件 id。
 */
function handleCardEnable(pluginId: string): void {
  void installStore.value.enable(pluginId);
}

/**
 * 网格事件：禁用插件。
 *
 * @param pluginId - 插件 id。
 */
function handleCardDisable(pluginId: string): void {
  void installStore.value.disable(pluginId);
}

/**
 * 网格事件：卸载插件。
 *
 * @param pluginId - 插件 id。
 */
function handleCardUninstall(pluginId: string): void {
  void installStore.value.uninstall(pluginId);
}

/**
 * 读取 `focus_plugin_id` query 参数（用于 UnknownDomainCard 等引导聚焦插件）。
 *
 * @returns 聚焦插件 id（未设置则为空字符串）。
 */
function computeFocusPluginId(): string {
  return String(route.query.focus_plugin_id ?? "").trim();
}

const focusPluginId = computed(computeFocusPluginId);

let queryTimer: number | null = null;

/**
 * 获取当前选中的目录条目（抽屉内容）。
 *
 * @returns 选中的插件条目；为空则返回 `null`。
 */
function computeSelectedPlugin(): PluginCatalogEntry | null {
  return byId.value[selectedId.value] ?? null;
}

const selectedPlugin = computed(computeSelectedPlugin);

/**
 * 获取当前选中的已安装状态（抽屉内容）。
 *
 * @returns 选中的安装状态；为空则返回 `null`。
 */
function computeSelectedInstalled() {
  return installStore.value.installedById[selectedId.value] ?? null;
}

const selectedInstalled = computed(computeSelectedInstalled);

/**
 * 打开某插件的详情抽屉。
 *
 * @param pluginId - 目标插件 id。
 */
function openDetail(pluginId: string): void {
  selectedId.value = pluginId;
  drawerOpen.value = true;
}

/**
 * 关闭详情抽屉。
 */
function closeDetail(): void {
  drawerOpen.value = false;
}

/**
 * 抽屉事件：安装指定版本。
 *
 * @param version - 目标版本。
 * @returns 无返回值。
 */
function handleDrawerInstall(version: string): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.install(plugin, version);
}

/**
 * 抽屉事件：更新到最新版本。
 *
 * @returns 无返回值。
 */
function handleDrawerUpdate(): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.updateToLatest(plugin, plugin.versions[0] || "");
}

/**
 * 抽屉事件：启用插件。
 *
 * @returns 无返回值。
 */
function handleDrawerEnable(): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.enable(plugin.pluginId);
}

/**
 * 抽屉事件：禁用插件。
 *
 * @returns 无返回值。
 */
function handleDrawerDisable(): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.disable(plugin.pluginId);
}

/**
 * 抽屉事件：切换到指定版本。
 *
 * @param version - 目标版本。
 * @returns 无返回值。
 */
function handleDrawerSwitchVersion(version: string): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.switchVersion(plugin.pluginId, version);
}

/**
 * 抽屉事件：回滚到先前版本。
 *
 * @returns 无返回值。
 */
function handleDrawerRollback(): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.rollback(plugin.pluginId);
}

/**
 * 确保当前服务端的目录与已安装状态已加载。
 *
 * 调用时机：
 * - 组件挂载；
 * - server socket 变化；
 * - 用户显式点击刷新/复核。
 *
 * @returns 无返回值。
 */
async function ensureData(): Promise<void> {
  if (!serverSocket.value) return;
  await Promise.all([refreshServerInfo(), refreshCatalog(), refreshInstalled()]);
  installStore.value.recheckRequired(requiredIds.value);
}

/**
 * 将当前筛选条件同步到路由 query，便于分享与刷新后保持状态。
 */
function syncQuery(): void {
  void router.replace({
    query: {
      ...route.query,
      filter: filter.value === "all" ? undefined : filter.value,
      source: source.value === "all" ? undefined : source.value,
      q: q.value.trim() ? q.value.trim() : undefined,
    },
  });
}

watch([filter, source], syncQuery);

/**
 * 搜索框变化时对 query 同步进行 debounce。
 *
 * @returns 无返回值。
 */
function handleQueryChange(): void {
  if (queryTimer) window.clearTimeout(queryTimer);
  queryTimer = window.setTimeout(syncQuery, 220);
}

watch(q, handleQueryChange);

/**
 * watch 源：server socket。
 *
 * @returns 当前 server socket。
 */
function watchServerSocket(): string {
  return serverSocket.value;
}

/**
 * server socket 变化时刷新页面数据。
 *
 * @returns 无返回值。
 */
function handleServerSocketChange(): void {
  void ensureData();
}

watch(watchServerSocket, handleServerSocketChange, { immediate: true });

/**
 * watch 源：聚焦插件 id。
 *
 * @returns 当前聚焦插件 id。
 */
function watchFocusPluginId(): string {
  return focusPluginId.value;
}

/**
 * 当路由提供 focus plugin id 时，自动打开抽屉并聚焦该插件。
 *
 * @param id - 目标插件 id。
 * @returns 无返回值。
 */
function handleFocusPluginIdChange(id: string): void {
  if (!id) return;
  selectedId.value = id;
  drawerOpen.value = true;
}

watch(watchFocusPluginId, handleFocusPluginIdChange, { immediate: true });

/**
 * 组件挂载：预拉取当前服务端的数据。
 *
 * @returns 无返回值。
 */
function handleMounted(): void {
  void ensureData();

  window.addEventListener("keydown", onGlobalKeydown);
}

onMounted(handleMounted);

/**
 * 组件卸载：移除全局快捷键监听。
 */
function handleBeforeUnmount(): void {
  window.removeEventListener("keydown", onGlobalKeydown);
}

onBeforeUnmount(handleBeforeUnmount);

/**
 * 插件中心全局快捷键。
 *
 * - `Esc`：关闭详情抽屉
 * - `Ctrl/Cmd+,`：打开设置页
 *
 * @param e - 键盘事件。
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape" && drawerOpen.value) {
    e.preventDefault();
    closeDetail();
    return;
  }

  const meta = e.metaKey || e.ctrlKey;
  if (!meta || e.key !== ",") return;
  e.preventDefault();
  void router.push("/settings");
}
</script>

<template>
  <!-- 页面：PluginCenterPage｜职责：插件中心（模块机柜） -->
  <!-- 区块：<main> .cp-plugins -->
  <main class="cp-plugins">
    <PluginCenterFilterRail
      v-model:q="q"
      v-model:filter="filter"
      v-model:source="source"
      v-model:show-repo-manager="showRepoManager"
      v-model:repo-draft="repoDraft"
      v-model:repo-note-draft="repoNoteDraft"
      :enabled-repo-count="enabledRepoSources.length"
      :repo-sources="repoSources"
      :repo-error="repoError"
      :missing-required-count="installStore.missingRequiredIds.value.length"
      @add-repo="handleAddRepo"
      @toggle-repo="handleToggleRepo"
      @remove-repo="handleRemoveRepo"
      @open-required="filter = 'required'"
      @recheck-required="ensureData"
    />

    <section class="cp-plugins__gridWrap">
      <PluginCenterGridHeader
        :server-socket="serverSocket"
        :server-id="serverId"
        :modules-count="filtered.length"
        @refresh="ensureData"
        @open-domains="router.push('/domains')"
        @back-to-chat="router.push('/chat')"
      />

      <PluginCenterCatalogGrid
        :server-socket="serverSocket"
        :server-id="serverId"
        :loading="catalogStore.loading.value"
        :error="catalogStore.error.value || ''"
        :plugins="filtered"
        :installed-by-id="installStore.installedById"
        :progress-by-id="installStore.progressById"
        :selected-id="selectedId"
        :focus-plugin-id="focusPluginId"
        :has-update="hasUpdate"
        @install="handleCardInstall"
        @update="handleCardUpdate"
        @enable="handleCardEnable"
        @disable="handleCardDisable"
        @uninstall="handleCardUninstall"
        @detail="openDetail"
      />
    </section>

    <ModuleDetailDrawer
      :open="drawerOpen"
      :plugin="selectedPlugin"
      :installed="selectedInstalled"
      :has-update="selectedPlugin ? hasUpdate(selectedPlugin.pluginId) : false"
      :disabled="Boolean(serverSocket) && !Boolean(serverId)"
      disabled-reason="Missing server_id — plugin operations are disabled"
      @close="closeDetail"
      @install="handleDrawerInstall"
      @update="handleDrawerUpdate"
      @enable="handleDrawerEnable"
      @disable="handleDrawerDisable"
      @switchVersion="handleDrawerSwitchVersion"
      @rollback="handleDrawerRollback"
    />
  </main>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；整体为两列布局（左筛选栏 + 右内容区）。 */
.cp-plugins {
  height: 100%;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 14px;
  padding: 14px;
}

.cp-plugins__gridWrap {
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .cp-plugins,
  .cp-plugins * {
    scroll-behavior: auto !important;
  }
}

</style>
