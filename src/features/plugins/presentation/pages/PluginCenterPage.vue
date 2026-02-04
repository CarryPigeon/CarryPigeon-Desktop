<script setup lang="ts">
/**
 * @fileoverview PluginCenterPage.vue
 * @description Patchbay Plugin Center (/plugins).
 */

import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { useServerInfoStore } from "@/features/servers/presentation/store/serverInfoStore";
import { usePluginCatalogStore } from "@/features/plugins/presentation/store/pluginCatalogStore";
import { usePluginInstallStore } from "@/features/plugins/presentation/store/pluginInstallStore";
import { addRepoSource, enabledRepoSources, removeRepoSource, repoSources, setRepoSourceEnabled } from "@/features/plugins/presentation/store/repoSourcesStore";
import ModuleCard from "../components/ModuleCard.vue";
import ModuleDetailDrawer from "../components/ModuleDetailDrawer.vue";
import type { PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";

type FilterKind = "all" | "installed" | "enabled" | "failed" | "updates" | "required";
type SourceKind = "all" | "server" | "repo";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const filter = ref<FilterKind>((String(route.query.filter ?? "all") as FilterKind) || "all");
const source = ref<SourceKind>((String(route.query.source ?? "all") as SourceKind) || "all");
const q = ref(String(route.query.q ?? ""));

const selectedId = ref<string>("");
const drawerOpen = ref(false);
const repoDraft = ref<string>("");
const repoNoteDraft = ref<string>("");
const repoError = ref<string>("");
const showRepoManager = ref<boolean>(false);

/**
 * Compute the current server socket key.
 *
 * @returns Trimmed socket string.
 */
function computeServerSocket(): string {
  return currentServerSocket.value.trim();
}

const serverSocket = computed(computeServerSocket);

/**
 * Resolve the server-info store scoped to the current socket.
 *
 * @returns Server-info store instance.
 */
function computeServerInfoStore() {
  return useServerInfoStore(serverSocket.value);
}

const serverInfoStore = computed(computeServerInfoStore);

/**
 * Expose `server_id` for UI gate behavior.
 *
 * @returns Current server_id (empty string when missing).
 */
function computeServerId(): string {
  return serverInfoStore.value.info.value?.serverId ?? "";
}

const serverId = computed(computeServerId);

/**
 * Resolve the plugin catalog store scoped to the current socket.
 *
 * @returns Plugin catalog store.
 */
function computeCatalogStore() {
  return usePluginCatalogStore(serverSocket.value);
}

const catalogStore = computed(computeCatalogStore);

/**
 * Add a repo source and refresh catalog (best-effort).
 *
 * @returns void
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
  if (serverSocket.value) void catalogStore.value.refresh();
}

/**
 * Toggle a repo source and refresh catalog.
 *
 * @param id - Repo source id.
 * @param enabled - Next enabled state.
 * @returns void
 */
function handleToggleRepo(id: string, enabled: boolean): void {
  setRepoSourceEnabled(id, enabled);
  if (serverSocket.value) void catalogStore.value.refresh();
}

/**
 * Remove a repo source and refresh catalog.
 *
 * @param id - Repo source id.
 * @returns void
 */
function handleRemoveRepo(id: string): void {
  removeRepoSource(id);
  if (serverSocket.value) void catalogStore.value.refresh();
}

/**
 * Resolve the plugin install store scoped to the current socket.
 *
 * @returns Plugin install store.
 */
function computeInstallStore() {
  return usePluginInstallStore(serverSocket.value);
}

const installStore = computed(computeInstallStore);

/**
 * Compute required plugin ids for the required gate UI.
 *
 * @returns List of required plugin ids.
 */
function computeRequiredIds(): string[] {
  const declared = serverInfoStore.value.info.value?.requiredPlugins ?? null;
  if (Array.isArray(declared) && declared.length > 0) {
    return declared.map((x) => String(x).trim()).filter(Boolean);
  }
  const out: string[] = [];
  for (const p of catalogStore.value.catalog.value) {
    if (p.source === "server" && p.required) out.push(p.pluginId);
  }
  return out;
}

const requiredIds = computed(computeRequiredIds);

/**
 * Expose catalog items by id for O(1) lookup in UI helpers.
 *
 * @returns Mapping of pluginId → catalog entry.
 */
function computeById() {
  return catalogStore.value.byId.value;
}

const byId = computed(computeById);

/**
 * Read the `focus_plugin_id` query param (used by unknown-domain downgrade cards).
 *
 * @returns Focus plugin id (empty when unset).
 */
function computeFocusPluginId(): string {
  return String(route.query.focus_plugin_id ?? "").trim();
}

const focusPluginId = computed(computeFocusPluginId);

let queryTimer: number | null = null;

/**
 * Check whether an installed plugin has an update available.
 *
 * @param pluginId - Plugin id.
 * @returns `true` when installed version differs from catalog latest version.
 */
function hasUpdate(pluginId: string): boolean {
  const plugin = byId.value[pluginId];
  const installed = installStore.value.installedById[pluginId];
  const latest = plugin?.versions?.[0] ?? "";
  const current = installed?.currentVersion ?? "";
  return Boolean(latest && current && latest !== current);
}

/**
 * Check whether a plugin passes the current source filter.
 *
 * @param p - Catalog entry.
 * @returns `true` when the entry should be included.
 */
function matchesSource(p: PluginCatalogEntry): boolean {
  return source.value === "all" ? true : p.source === source.value;
}

/**
 * Check whether a plugin passes the current search query.
 *
 * @param p - Catalog entry.
 * @param needle - Lowercased search needle.
 * @returns `true` when the entry matches.
 */
function matchesQuery(p: PluginCatalogEntry, needle: string): boolean {
  if (!needle) return true;

  if (p.name.toLowerCase().includes(needle)) return true;
  if (p.pluginId.toLowerCase().includes(needle)) return true;

  for (const d of p.providesDomains) {
    if (d.id.toLowerCase().includes(needle)) return true;
    if (d.label.toLowerCase().includes(needle)) return true;
  }

  return false;
}

/**
 * Check whether a plugin passes the current status filter.
 *
 * @param p - Catalog entry.
 * @returns `true` when the entry should be included.
 */
function matchesFilter(p: PluginCatalogEntry): boolean {
  const installed = installStore.value.installedById[p.pluginId] ?? null;

  if (filter.value === "all") return true;
  if (filter.value === "installed") return Boolean(installed?.currentVersion);
  if (filter.value === "enabled") return Boolean(installed?.enabled && installed.status === "ok");
  if (filter.value === "failed") return Boolean(installed?.status === "failed");
  if (filter.value === "updates") return hasUpdate(p.pluginId);
  if (filter.value === "required") return Boolean(p.required);
  return true;
}

/**
 * Compute the plugin list shown in the grid.
 *
 * @returns Filtered catalog list.
 */
function computeFiltered(): PluginCatalogEntry[] {
  const needle = q.value.trim().toLowerCase();
  const items = catalogStore.value.catalog.value;
  const out: PluginCatalogEntry[] = [];
  for (const p of items) {
    if (!matchesSource(p)) continue;
    if (!matchesQuery(p, needle)) continue;
    if (!matchesFilter(p)) continue;
    out.push(p);
  }
  return out;
}

const filtered = computed(computeFiltered);

/**
 * Resolve the currently selected catalog entry (drawer content).
 *
 * @returns Selected plugin entry, or `null` when none.
 */
function computeSelectedPlugin(): PluginCatalogEntry | null {
  return byId.value[selectedId.value] ?? null;
}

const selectedPlugin = computed(computeSelectedPlugin);

/**
 * Resolve the currently selected installed state (drawer content).
 *
 * @returns Selected install state, or `null` when none.
 */
function computeSelectedInstalled() {
  return installStore.value.installedById[selectedId.value] ?? null;
}

const selectedInstalled = computed(computeSelectedInstalled);

/**
 * Open the plugin detail drawer for a given plugin.
 *
 * @param pluginId - Target plugin id.
 */
function openDetail(pluginId: string): void {
  selectedId.value = pluginId;
  drawerOpen.value = true;
}

/**
 * Close the plugin detail drawer.
 */
function closeDetail(): void {
  drawerOpen.value = false;
}

/**
 * Drawer event: install a specific version for the selected plugin.
 *
 * @param version - Target version.
 * @returns void
 */
function handleDrawerInstall(version: string): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.install(plugin, version);
}

/**
 * Drawer event: update selected plugin to latest.
 *
 * @returns void
 */
function handleDrawerUpdate(): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.updateToLatest(plugin, plugin.versions[0] || "");
}

/**
 * Drawer event: enable selected plugin.
 *
 * @returns void
 */
function handleDrawerEnable(): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.enable(plugin.pluginId);
}

/**
 * Drawer event: disable selected plugin.
 *
 * @returns void
 */
function handleDrawerDisable(): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.disable(plugin.pluginId);
}

/**
 * Drawer event: switch selected plugin to a specific version.
 *
 * @param version - Target version.
 * @returns void
 */
function handleDrawerSwitchVersion(version: string): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.switchVersion(plugin.pluginId, version);
}

/**
 * Drawer event: rollback selected plugin to the previous version.
 *
 * @returns void
 */
function handleDrawerRollback(): void {
  const plugin = selectedPlugin.value;
  if (!plugin) return;
  void installStore.value.rollback(plugin.pluginId);
}

/**
 * Ensure catalog + installed state are loaded for the current server.
 *
 * This is called:
 * - On mount
 * - When server socket changes
 * - When user explicitly requests refresh
 *
 * @returns Promise<void>
 */
async function ensureData(): Promise<void> {
  if (!serverSocket.value) return;
  await Promise.all([
    serverInfoStore.value.refresh(),
    catalogStore.value.refresh(),
    installStore.value.refreshInstalled(),
  ]);
  installStore.value.recheckRequired(requiredIds.value);
}

/**
 * Sync current UI filters to route query for shareable/refresh-safe URLs.
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
 * Debounce query syncing when the search input changes.
 *
 * @returns void
 */
function handleQueryChange(): void {
  if (queryTimer) window.clearTimeout(queryTimer);
  queryTimer = window.setTimeout(syncQuery, 220);
}

watch(q, handleQueryChange);

/**
 * Watch-source: server socket.
 *
 * @returns Current server socket.
 */
function watchServerSocket(): string {
  return serverSocket.value;
}

/**
 * Refresh page data when server socket changes.
 *
 * @returns void
 */
function handleServerSocketChange(): void {
  void ensureData();
}

watch(watchServerSocket, handleServerSocketChange, { immediate: true });

/**
 * Watch-source: focus plugin id.
 *
 * @returns Current focus plugin id.
 */
function watchFocusPluginId(): string {
  return focusPluginId.value;
}

/**
 * Open drawer when focus plugin id is provided in route query.
 *
 * @param id - Target plugin id.
 * @returns void
 */
function handleFocusPluginIdChange(id: string): void {
  if (!id) return;
  selectedId.value = id;
  drawerOpen.value = true;
}

watch(watchFocusPluginId, handleFocusPluginIdChange, { immediate: true });

/**
 * Component mount hook: prefetch data for current server.
 *
 * @returns void
 */
function handleMounted(): void {
  void ensureData();
}

onMounted(handleMounted);
</script>

<template>
  <!-- 页面：PluginCenterPage｜职责：插件中心（模块机柜） -->
  <!-- 区块：<main> .cp-plugins -->
  <main class="cp-plugins">
    <aside class="cp-plugins__filters">
      <div class="cp-plugins__filtersTitle">MODULE RACK</div>
      <div class="cp-plugins__filtersSub">Search · Filter · Source</div>

      <div class="cp-plugins__search">
        <t-input v-model="q" :placeholder="t('plugin_search_placeholder')" clearable />
      </div>

      <div class="cp-plugins__group">
        <div class="cp-plugins__label">Filter</div>
        <div class="cp-seg">
          <button class="cp-seg__btn" :data-active="filter === 'all'" type="button" @click="filter = 'all'">{{ t("plugin_filter_all") }}</button>
          <button class="cp-seg__btn" :data-active="filter === 'installed'" type="button" @click="filter = 'installed'">{{ t("plugin_filter_installed") }}</button>
          <button class="cp-seg__btn" :data-active="filter === 'enabled'" type="button" @click="filter = 'enabled'">{{ t("plugin_filter_enabled") }}</button>
          <button class="cp-seg__btn" :data-active="filter === 'failed'" type="button" @click="filter = 'failed'">{{ t("plugin_filter_failed") }}</button>
          <button class="cp-seg__btn" :data-active="filter === 'updates'" type="button" @click="filter = 'updates'">{{ t("plugin_filter_updates") }}</button>
          <button class="cp-seg__btn" :data-active="filter === 'required'" type="button" @click="filter = 'required'">{{ t("plugin_filter_required") }}</button>
        </div>
      </div>

      <div class="cp-plugins__group">
        <div class="cp-plugins__label">Source</div>
        <div class="cp-seg">
          <button class="cp-seg__btn" :data-active="source === 'all'" type="button" @click="source = 'all'">All</button>
          <button class="cp-seg__btn" :data-active="source === 'server'" type="button" @click="source = 'server'">Server</button>
          <button class="cp-seg__btn" :data-active="source === 'repo'" type="button" @click="source = 'repo'">Repo</button>
        </div>
      </div>

      <div class="cp-plugins__group">
        <div class="cp-plugins__label">Repo Sources</div>
        <div class="cp-plugins__repoMeta">
          <div class="cp-plugins__muted">{{ enabledRepoSources.length }} enabled · {{ repoSources.length }} total</div>
          <button class="cp-plugins__repoBtn" type="button" @click="showRepoManager = !showRepoManager">
            {{ showRepoManager ? "Hide" : "Manage" }}
          </button>
        </div>
        <div v-if="showRepoManager" class="cp-plugins__repoPanel">
          <t-input v-model="repoDraft" placeholder="https://repo.example.com" clearable />
          <t-input v-model="repoNoteDraft" placeholder="Note (optional)" clearable />
          <button class="cp-plugins__repoAdd" type="button" @click="handleAddRepo">Add Repo</button>
          <div v-if="repoError" class="cp-plugins__repoErr">{{ repoError }}</div>

          <div v-if="repoSources.length === 0" class="cp-plugins__muted">No repos added.</div>
          <div v-else class="cp-plugins__repoList">
            <div v-for="r in repoSources" :key="r.id" class="cp-plugins__repoRow">
              <label class="cp-plugins__repoToggle">
                <input :checked="r.enabled" type="checkbox" @change="handleToggleRepo(r.id, !r.enabled)" />
                <span>Enabled</span>
              </label>
              <div class="cp-plugins__repoInfo">
                <div class="cp-plugins__repoUrl">{{ r.baseUrl }}</div>
                <div v-if="r.note" class="cp-plugins__repoNote">{{ r.note }}</div>
              </div>
              <button class="cp-plugins__repoRemove" type="button" @click="handleRemoveRepo(r.id)">Remove</button>
            </div>
          </div>
        </div>
      </div>

      <div class="cp-plugins__group">
        <div class="cp-plugins__label">Required Gate</div>
        <div class="cp-plugins__gate">
          <div class="cp-plugins__gateLine">
            <span class="cp-plugins__gateK">missing</span>
            <span class="cp-plugins__gateV">{{ installStore.missingRequiredIds.value.length }}</span>
          </div>
          <button class="cp-plugins__gateBtn" type="button" @click="filter = 'required'">{{ t("open_plugin_center_required") }}</button>
          <button class="cp-plugins__gateBtn" type="button" @click="ensureData">{{ t("recheck_required") }}</button>
        </div>
      </div>
    </aside>

    <section class="cp-plugins__gridWrap">
      <header class="cp-plugins__head">
        <div class="cp-plugins__headLeft">
          <div class="cp-plugins__headTitle">{{ t("plugin_center") }}</div>
          <div class="cp-plugins__headMeta">
            <span class="cp-plugins__mono">{{ serverSocket || "no-server" }}</span>
            <span class="cp-plugins__dot"></span>
            <span class="cp-plugins__mono">{{ serverId || "missing-server_id" }}</span>
            <span class="cp-plugins__dot"></span>
            <span class="cp-plugins__muted">{{ filtered.length }} modules</span>
          </div>
        </div>
        <div class="cp-plugins__headRight">
          <button class="cp-plugins__headBtn" type="button" @click="ensureData">{{ t("refresh") }}</button>
          <button class="cp-plugins__headBtn" type="button" @click="$router.push('/domains')">Domains</button>
          <button class="cp-plugins__headBtn" type="button" @click="$router.push('/chat')">{{ t("back_to_patchbay") }}</button>
        </div>
      </header>

      <div v-if="serverSocket && !serverId" class="cp-plugins__state err">
        Plugin Center is locked: missing `server_id` from `GET /api/server`. Install/enable/update are disabled until fixed.
      </div>
      <div v-if="catalogStore.loading.value" class="cp-plugins__state">Loading catalog…</div>
      <div v-else-if="catalogStore.error.value" class="cp-plugins__state err">{{ catalogStore.error.value }}</div>
      <div v-else class="cp-plugins__grid">
        <ModuleCard
          v-for="p in filtered"
          :key="p.pluginId"
          :plugin="p"
          :installed="installStore.installedById[p.pluginId] ?? null"
          :progress="installStore.progressById[p.pluginId] ?? null"
          :focused="p.pluginId === selectedId || p.pluginId === focusPluginId"
          :has-update="hasUpdate(p.pluginId)"
          :disabled="Boolean(serverSocket) && !Boolean(serverId)"
          disabled-reason="Missing server_id — plugin operations are disabled"
          @install="installStore.install(p, p.versions[0] || '')"
          @update="installStore.updateToLatest(p, p.versions[0] || '')"
          @enable="installStore.enable(p.pluginId)"
          @disable="installStore.disable(p.pluginId)"
          @uninstall="installStore.uninstall(p.pluginId)"
          @detail="openDetail(p.pluginId)"
        />
      </div>
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
/* PluginCenterPage styles */
/* Layout: filter rail + grid area */
.cp-plugins {
  height: 100%;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 14px;
  padding: 14px;
}

/* Left rail: filters panel */
.cp-plugins__filters {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 14px;
  box-shadow: var(--cp-shadow-soft);
  overflow: auto;
}

/* Rail title */
.cp-plugins__filtersTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text);
}

/* Rail subtitle */
.cp-plugins__filtersSub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Search field wrapper */
.cp-plugins__search {
  margin-top: 12px;
}

/* Filter group (segmented controls) */
.cp-plugins__group {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

/* Group label */
.cp-plugins__label {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-bottom: 10px;
}

/* Segmented control container */
.cp-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Segmented control button */
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

/* Segmented control hover */
.cp-seg__btn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
  background: var(--cp-hover-bg);
}

/* Segmented control active */
.cp-seg__btn[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* Required-gate summary box */
.cp-plugins__gate {
  border: 1px dashed rgba(148, 163, 184, 0.26);
  border-radius: 16px;
  padding: 12px;
  background: var(--cp-panel-muted);
}

/* Gate key/value row */
.cp-plugins__gateLine {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

/* Gate key */
.cp-plugins__gateK {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Gate value */
.cp-plugins__gateV {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
}

/* Gate action button */
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

/* Gate button hover */
.cp-plugins__gateBtn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Repo sources meta row */
.cp-plugins__repoMeta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* Repo sources manager panel */
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

/* Right area: header + grid container */
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

/* Grid header */
.cp-plugins__head {
  padding: 14px 14px 12px 14px;
  border-bottom: 1px solid var(--cp-border-light);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

/* Header title */
.cp-plugins__headTitle {
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* Header meta row */
.cp-plugins__headMeta {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Mono meta chip */
.cp-plugins__mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Dot separator */
.cp-plugins__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

/* Muted meta */
.cp-plugins__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Header right actions */
.cp-plugins__headRight {
  display: flex;
  gap: 10px;
}

/* Header action button */
.cp-plugins__headBtn {
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
}

/* Header button hover */
.cp-plugins__headBtn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Loading/error state */
.cp-plugins__state {
  padding: 18px;
  color: var(--cp-text-muted);
  font-size: 13px;
}

/* Error state */
.cp-plugins__state.err {
  color: rgba(248, 113, 113, 0.92);
}

/* Module grid */
.cp-plugins__grid {
  padding: 14px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  min-height: 0;
}
</style>
