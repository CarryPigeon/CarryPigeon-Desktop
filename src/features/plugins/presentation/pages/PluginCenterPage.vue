<script setup lang="ts">
/**
 * @fileoverview PluginCenterPage.vue (Patchbay).
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import MonoTag from "@/shared/ui/MonoTag.vue";
import LabelBadge from "@/shared/ui/LabelBadge.vue";

type PluginManifest = {
  name: string;
  version: string;
  description?: string | null;
  author?: string | null;
  license?: string | null;
  url: string;
  frontend_sha256: string;
  backend_sha256: string;
  icon?: string | null;
};

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const error = ref<string | null>(null);
const plugins = ref<PluginManifest[]>([]);

type PluginFilter = "all" | "installed" | "enabled" | "failed" | "updates" | "required";
type PluginSource = "server" | "repo" | "local";

const query = ref(String(route.query.q ?? "").trim());
const normalizedQuery = computed(() => query.value.trim().toLowerCase());

const filter = ref<PluginFilter>((String(route.query.filter ?? "all") as PluginFilter) || "all");
const source = ref<PluginSource>((String(route.query.source ?? "local") as PluginSource) || "local");

const selected = ref<string>("");

const filtered = computed(() => {
  const q = normalizedQuery.value;
  const base = plugins.value;
  const afterFilter = applyFilter(base, filter.value);
  const afterSource = applySource(afterFilter, source.value);

  if (!q) return afterSource;
  return afterSource.filter((p) => {
    return (
      p.name.toLowerCase().includes(q) ||
      p.version.toLowerCase().includes(q) ||
      String(p.description ?? "").toLowerCase().includes(q)
    );
  });
});

const selectedPlugin = computed(() => {
  const id = selected.value.trim();
  if (!id) return null;
  return plugins.value.find((p) => p.name === id) ?? null;
});

/**
 * applyFilter 方法说明。
 * @param list - 参数说明。
 * @param f - 参数说明。
 * @returns 返回值说明。
 */
function applyFilter(list: PluginManifest[], f: PluginFilter): PluginManifest[] {
  // Current tauri API returns local manifests only; treat as installed.
  if (f === "all") return list;
  if (f === "installed") return list;
  return list;
}

/**
 * applySource 方法说明。
 * @param list - 参数说明。
 * @param s - 参数说明。
 * @returns 返回值说明。
 */
function applySource(list: PluginManifest[], s: PluginSource): PluginManifest[] {
  // Placeholder: current data source is local only.
  if (s === "local") return list;
  return list;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const list = await invokeTauri<PluginManifest[]>(TAURI_COMMANDS.listPlugins);
    plugins.value = Array.isArray(list) ? list : [];
  } catch (e) {
    error.value = String(e);
    plugins.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * selectPlugin 方法说明。
 * @param pluginId - 参数说明。
 * @returns 返回值说明。
 */
function selectPlugin(pluginId: string) {
  selected.value = pluginId;
  void router.replace({
    path: "/plugins",
    query: {
      ...route.query,
      focus_plugin_id: pluginId,
    },
  });
}

/**
 * closeDrawer 方法说明。
 * @returns 返回值说明。
 */
function closeDrawer() {
  selected.value = "";
  const nextQuery = { ...route.query };
  delete (nextQuery as Record<string, unknown>).focus_plugin_id;
  void router.replace({ path: "/plugins", query: nextQuery });
}

/**
 * setFilter 方法说明。
 * @param next - 参数说明。
 * @returns 返回值说明。
 */
function setFilter(next: PluginFilter) {
  filter.value = next;
  void router.replace({ path: "/plugins", query: { ...route.query, filter: next } });
}

/**
 * setSource 方法说明。
 * @param next - 参数说明。
 * @returns 返回值说明。
 */
function setSource(next: PluginSource) {
  source.value = next;
  void router.replace({ path: "/plugins", query: { ...route.query, source: next } });
}

/**
 * onWindowKeydown 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") closeDrawer();
}

onMounted(() => {
  void load();
  window.addEventListener("keydown", onWindowKeydown);

  const focus = String(route.query.focus_plugin_id ?? "").trim();
  if (focus) selected.value = focus;
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onWindowKeydown);
});

watch(
  () => route.query,
  (q) => {
    query.value = String(q.q ?? "").trim();
    filter.value = (String(q.filter ?? "all") as PluginFilter) || "all";
    source.value = (String(q.source ?? "local") as PluginSource) || "local";
    selected.value = String(q.focus_plugin_id ?? "").trim();
  },
);
</script>

<template>
  <!-- 页面：PluginCenterPage｜职责：插件中心（模块机柜） -->
  <!-- 区块：<div> .plugin-center -->
  <div class="plugin-center">
    <div class="layout">
      <!-- 区块：<aside> .sidebar -->
      <aside class="sidebar">
        <div class="sidebar-top">
          <div class="sidebar-title">{{ $t("plugin_center") }}</div>
          <div class="sidebar-sub">Module Rack · {{ source.toUpperCase() }}</div>
        </div>

        <div class="sidebar-block">
          <div class="block-title">Search</div>
          <input v-model="query" class="cp-field" type="text" :placeholder="$t('search_bar')" />
        </div>

        <div class="sidebar-block">
          <div class="block-title">Filter</div>
          <div class="chips">
            <button class="chip" :class="{ active: filter === 'all' }" type="button" @click="setFilter('all')">
              All
            </button>
            <button
              class="chip"
              :class="{ active: filter === 'installed' }"
              type="button"
              @click="setFilter('installed')"
            >
              Installed
            </button>
            <button
              class="chip"
              :class="{ active: filter === 'required' }"
              type="button"
              @click="setFilter('required')"
            >
              Required
            </button>
            <button class="chip" :class="{ active: filter === 'failed' }" type="button" @click="setFilter('failed')">
              Failed
            </button>
            <button class="chip" :class="{ active: filter === 'updates' }" type="button" @click="setFilter('updates')">
              Updates
            </button>
          </div>
        </div>

        <div class="sidebar-block">
          <div class="block-title">Source</div>
          <div class="chips">
            <button class="chip" :class="{ active: source === 'local' }" type="button" @click="setSource('local')">
              Local
            </button>
            <button class="chip" :class="{ active: source === 'server' }" type="button" @click="setSource('server')">
              Server
            </button>
            <button class="chip" :class="{ active: source === 'repo' }" type="button" @click="setSource('repo')">
              Repo
            </button>
          </div>
          <div class="hint">当前接口仅返回本地清单；Server/Repo 视图为占位，等待 catalog 接入。</div>
        </div>

        <div class="sidebar-actions">
          <button class="btn" type="button" :disabled="loading" @click="load">
            {{ loading ? $t("loading") : $t("recheck_required") }}
          </button>
        </div>
      </aside>

      <!-- 区块：<main> .main -->
      <main class="main">
        <header class="main-top">
          <div class="main-left">
            <LabelBadge variant="domain" label="MODULE RACK" />
            <div class="main-count">{{ filtered.length }} modules</div>
          </div>
          <div class="main-right">
            <div v-if="error" class="inline-state error">{{ error }}</div>
          </div>
        </header>

        <section class="grid">
          <div v-if="!filtered.length && !loading" class="state empty">No plugins</div>

          <button
            v-for="p in filtered"
            :key="`${p.name}@${p.version}`"
            type="button"
            class="module"
            :class="{ selected: selected === p.name }"
            @click="selectPlugin(p.name)"
          >
            <div class="module-head">
              <div class="module-name">{{ p.name }}</div>
              <div class="module-ver">{{ p.version }}</div>
            </div>
            <div class="module-desc">{{ p.description || "—" }}</div>
            <div class="module-ports" aria-hidden="true">
              <span class="port" style="--port: var(--cp-domain-core)"></span>
              <span class="port" style="--port: var(--cp-domain-math)"></span>
              <span class="port" style="--port: var(--cp-domain-poetry)"></span>
              <span class="port" style="--port: var(--cp-domain-mc)"></span>
              <span class="port" style="--port: var(--cp-domain-unknown)"></span>
            </div>
            <div class="module-meta">
              <span class="mono">sha256: {{ (p.frontend_sha256 || "").slice(0, 10) }}…</span>
            </div>
          </button>
        </section>

        <!-- 区块：<aside> .drawer -->
        <aside v-if="selectedPlugin" class="drawer" aria-label="module detail">
          <header class="drawer-head">
            <div class="drawer-title">
              <div class="drawer-name">{{ selectedPlugin.name }}</div>
              <div class="drawer-ver mono">{{ selectedPlugin.version }}</div>
            </div>
            <button class="drawer-close" type="button" @click="closeDrawer">×</button>
          </header>

          <div class="drawer-body">
            <div class="drawer-desc">{{ selectedPlugin.description || "—" }}</div>

            <div class="drawer-kv">
              <div class="k mono">plugin_id</div>
              <div class="v">
                <MonoTag :value="selectedPlugin.name" :copyable="true" />
              </div>
            </div>

            <div class="drawer-kv">
              <div class="k mono">url</div>
              <div class="v mono">{{ selectedPlugin.url || "—" }}</div>
            </div>

            <div class="drawer-kv">
              <div class="k mono">frontend_sha256</div>
              <div class="v mono">{{ selectedPlugin.frontend_sha256 || "—" }}</div>
            </div>
            <div class="drawer-kv">
              <div class="k mono">backend_sha256</div>
              <div class="v mono">{{ selectedPlugin.backend_sha256 || "—" }}</div>
            </div>

            <div class="drawer-actions">
              <button class="action primary" type="button" disabled>Install</button>
              <button class="action" type="button" disabled>Enable</button>
              <button class="action" type="button" disabled>Update</button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Patchbay: module rack */
.plugin-center {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.layout {
  height: 100%;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
  padding: 14px;
  box-sizing: border-box;
}

.sidebar {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar-top {
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--cp-border-light);
  background:
    radial-gradient(520px 280px at 10% 0%, var(--cp-glow-a), transparent 62%),
    radial-gradient(520px 280px at 92% 110%, var(--cp-glow-b), transparent 62%),
    var(--cp-panel);
}

.sidebar-title {
  font-family: var(--cp-font-display);
  font-size: 16px;
  color: var(--cp-text);
  letter-spacing: 0.01em;
}

.sidebar-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.sidebar-block {
  padding: 12px 14px;
  border-bottom: 1px solid var(--cp-border-light);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.block-title {
  font-family: var(--cp-font-display);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--cp-text-muted);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: rgba(56, 189, 248, 0.30);
  }

  &.active {
    border-color: rgba(56, 189, 248, 0.30);
    background: linear-gradient(180deg, var(--cp-accent-2-soft), transparent 75%), var(--cp-panel-muted);
  }
}

.hint {
  font-size: 12px;
  color: var(--cp-text-light);
  line-height: 1.45;
}

.sidebar-actions {
  margin-top: auto;
  padding: 12px 14px;
  border-top: 1px solid var(--cp-border-light);
  display: flex;
  justify-content: flex-end;
}

.btn {
  border: 1px solid rgba(56, 189, 248, 0.24);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: transform var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(56, 189, 248, 0.34);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.main {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.main-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--cp-border-light);
  background:
    linear-gradient(180deg, rgba(148, 163, 184, 0.10), transparent 52%),
    var(--cp-panel);
}

.main-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.main-count {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.inline-state {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.inline-state.error {
  color: rgba(254, 202, 202, 0.92);
}

.grid {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.module {
  text-align: left;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 14px;
  box-shadow: var(--cp-shadow-soft);
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(56, 189, 248, 0.30);
    background: var(--cp-field-bg-hover);
  }
}

.module.selected {
  border-color: rgba(56, 189, 248, 0.34);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.18), var(--cp-shadow-soft);
}

.module-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.module-name {
  font-family: var(--cp-font-display);
  color: var(--cp-text);
  font-size: 14px;
  letter-spacing: 0.01em;
}

.module-ver {
  font-family: var(--cp-font-mono);
  color: rgba(226, 232, 240, 0.62);
  font-size: 12px;
}

.module-desc {
  margin-top: 8px;
  color: var(--cp-text-muted);
  font-size: 12px;
  line-height: 1.4;
  min-height: 34px;
}

.module-ports {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  opacity: 0.9;
}

.port {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--port, var(--cp-domain-unknown));
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.10);
}

.module-meta {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: rgba(226, 232, 240, 0.62);
}

.state {
  grid-column: 1 / -1;
  padding: 14px;
  border: 1px dashed rgba(148, 163, 184, 0.30);
  border-radius: 18px;
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
}

.state.error {
  border-color: rgba(239, 68, 68, 0.34);
  color: rgba(254, 202, 202, 0.92);
}

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 42vw);
  border-left: 1px solid var(--cp-border);
  background: var(--cp-panel);
  box-shadow: -18px 0 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
}

.drawer-head {
  padding: 14px;
  border-bottom: 1px solid var(--cp-border-light);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  background:
    radial-gradient(520px 280px at 20% 0%, var(--cp-glow-a), transparent 65%),
    var(--cp-panel);
}

.drawer-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-name {
  font-family: var(--cp-font-display);
  font-size: 18px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drawer-ver {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.drawer-close {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 12px;
  width: 34px;
  height: 34px;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: rgba(56, 189, 248, 0.30);
  }
}

.drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

.drawer-desc {
  color: var(--cp-text-muted);
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.drawer-kv {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(148, 163, 184, 0.18);
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.drawer-kv .k {
  color: var(--cp-text-muted);
}

.drawer-kv .v {
  color: var(--cp-text);
  min-width: 0;
}

.drawer-actions {
  margin-top: 18px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.action {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 10px 12px;
  font-size: 13px;
  cursor: not-allowed;
  opacity: 0.75;
}

.action.primary {
  border-color: rgba(56, 189, 248, 0.30);
  background: linear-gradient(180deg, var(--cp-accent-2-soft), transparent 78%), var(--cp-panel-muted);
}
</style>
