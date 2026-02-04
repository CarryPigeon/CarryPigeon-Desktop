<script setup lang="ts">
/**
 * @fileoverview PluginDetailPage.vue
 * @description Plugin detail route (/plugins/detail/:pluginId).
 */

import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { useServerInfoStore } from "@/features/servers/presentation/store/serverInfoStore";
import { usePluginCatalogStore } from "@/features/plugins/presentation/store/pluginCatalogStore";
import { usePluginInstallStore } from "@/features/plugins/presentation/store/pluginInstallStore";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import type { PluginCatalogEntry } from "@/features/plugins/domain/types/pluginTypes";

const route = useRoute();
const router = useRouter();

/**
 * Compute the current server socket.
 *
 * @returns Trimmed socket string.
 */
function computeServerSocket(): string {
  return currentServerSocket.value.trim();
}

const serverSocket = computed(computeServerSocket);

/**
 * Read the plugin id from route params.
 *
 * @returns Plugin id.
 */
function computePluginId(): string {
  return String(route.params.pluginId ?? "").trim();
}

const pluginId = computed(computePluginId);

/**
 * Resolve server-info store for current socket.
 *
 * @returns Server-info store.
 */
function computeServerInfoStore() {
  return useServerInfoStore(serverSocket.value);
}

const serverInfoStore = computed(computeServerInfoStore);

/**
 * Expose `server_id` for gate behavior.
 *
 * @returns server_id (empty when missing).
 */
function computeServerId(): string {
  return serverInfoStore.value.info.value?.serverId ?? "";
}

const serverId = computed(computeServerId);

/**
 * Resolve catalog store for current socket.
 *
 * @returns Plugin catalog store.
 */
function computeCatalogStore() {
  return usePluginCatalogStore(serverSocket.value);
}

const catalogStore = computed(computeCatalogStore);

/**
 * Resolve install store for current socket.
 *
 * @returns Plugin install store.
 */
function computeInstallStore() {
  return usePluginInstallStore(serverSocket.value);
}

const installStore = computed(computeInstallStore);

/**
 * Resolve the catalog entry for this page.
 *
 * @returns Catalog entry, or `null` when not found.
 */
function computePlugin(): PluginCatalogEntry | null {
  return catalogStore.value.byId.value[pluginId.value] ?? null;
}

const plugin = computed(computePlugin);

/**
 * Resolve the installed state for this plugin.
 *
 * @returns Installed state, or `null` when not installed.
 */
function computeInstalled() {
  return installStore.value.installedById[pluginId.value] ?? null;
}

const installed = computed(computeInstalled);

/**
 * Whether an update is available (catalog latest differs from installed current).
 *
 * @returns `true` when update is available.
 */
function computeHasUpdate(): boolean {
  const latest = plugin.value?.versions?.[0] ?? "";
  const current = installed.value?.currentVersion ?? "";
  return Boolean(latest && current && latest !== current);
}

const hasUpdate = computed(computeHasUpdate);

/**
 * Format provides-domains labels for display.
 *
 * @returns Joined labels, or empty string when plugin is missing.
 */
function computeDomainLabelsText(): string {
  const p = plugin.value;
  if (!p) return "";
  const labels: string[] = [];
  for (const d of p.providesDomains) labels.push(d.label);
  return labels.join(" · ");
}

const domainLabelsText = computed(computeDomainLabelsText);

/**
 * Ensure catalog + installed state are available for this detail view.
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
}

/**
 * Component mount hook: prefetch data.
 *
 * @returns void
 */
function handleMounted(): void {
  void ensureData();
}

onMounted(handleMounted);
</script>

<template>
  <!-- 页面：PluginDetailPage｜职责：插件详情页 -->
  <!-- 区块：<main> .cp-plugin-detail -->
  <main class="cp-plugin-detail">
    <header class="cp-plugin-detail__head">
      <button class="cp-plugin-detail__back" type="button" @click="router.back()">Back</button>
      <div class="cp-plugin-detail__title">
        <div class="cp-plugin-detail__name">{{ plugin?.name || pluginId }}</div>
        <div class="cp-plugin-detail__meta">
          <span class="cp-plugin-detail__mono">{{ serverSocket || "no-server" }}</span>
          <span class="cp-plugin-detail__dot"></span>
          <span class="cp-plugin-detail__mono">{{ serverId || "missing-server_id" }}</span>
          <span class="cp-plugin-detail__dot"></span>
          <span class="cp-plugin-detail__mono">{{ pluginId || "—" }}</span>
        </div>
      </div>
      <div class="cp-plugin-detail__badges">
        <LabelBadge v-if="plugin?.required" variant="required" label="REQUIRED" />
        <LabelBadge v-if="hasUpdate" variant="update" label="UPDATE" />
        <LabelBadge v-if="installed?.status === 'failed'" variant="failed" label="FAILED" />
      </div>
    </header>

    <section v-if="plugin" class="cp-plugin-detail__body">
      <div v-if="serverSocket && !serverId" class="cp-plugin-detail__card danger">
        <div class="cp-plugin-detail__k">Locked</div>
        <div class="cp-plugin-detail__v">Missing `server_id` from server info endpoint. Plugin operations are disabled.</div>
      </div>
      <div class="cp-plugin-detail__card">
        <div class="cp-plugin-detail__k">Tagline</div>
        <div class="cp-plugin-detail__v">{{ plugin.tagline }}</div>
      </div>
      <div class="cp-plugin-detail__card">
        <div class="cp-plugin-detail__k">Description</div>
        <div class="cp-plugin-detail__v">{{ plugin.description }}</div>
      </div>

      <div class="cp-plugin-detail__card">
        <div class="cp-plugin-detail__k">Source / sha256</div>
        <div class="cp-plugin-detail__vRow">
          <span class="cp-plugin-detail__pill">{{ plugin.source }}</span>
          <MonoTag :value="plugin.sha256" title="sha256" :copyable="true" />
        </div>
      </div>

      <div class="cp-plugin-detail__card">
        <div class="cp-plugin-detail__k">Domains</div>
        <div class="cp-plugin-detail__ports">
          <span v-for="d in plugin.providesDomains" :key="d.id" class="cp-plugin-detail__port" :style="{ background: `var(${d.colorVar})` }"></span>
          <span class="cp-plugin-detail__portsText">{{ domainLabelsText }}</span>
        </div>
      </div>

      <div class="cp-plugin-detail__card">
        <div class="cp-plugin-detail__k">Permissions</div>
        <div class="cp-plugin-detail__perms">
          <div v-for="p in plugin.permissions" :key="p.key" class="cp-plugin-detail__perm" :data-risk="p.risk">
            <span class="cp-plugin-detail__permKey">{{ p.key }}</span>
            <span class="cp-plugin-detail__permLabel">{{ p.label }}</span>
            <span class="cp-plugin-detail__permRisk">{{ p.risk }}</span>
          </div>
        </div>
      </div>

      <div v-if="installed?.lastError" class="cp-plugin-detail__card danger">
        <div class="cp-plugin-detail__k">Last Error</div>
        <div class="cp-plugin-detail__v">{{ installed.lastError }}</div>
      </div>

      <div class="cp-plugin-detail__card">
        <div class="cp-plugin-detail__k">Installed</div>
        <div class="cp-plugin-detail__kv">
          <div class="cp-plugin-detail__kvItem">
            <div class="cp-plugin-detail__kvK">current</div>
            <div class="cp-plugin-detail__kvV">{{ installed?.currentVersion || "—" }}</div>
          </div>
          <div class="cp-plugin-detail__kvItem">
            <div class="cp-plugin-detail__kvK">enabled</div>
            <div class="cp-plugin-detail__kvV">{{ installed?.enabled ? "true" : "false" }}</div>
          </div>
          <div class="cp-plugin-detail__kvItem">
            <div class="cp-plugin-detail__kvK">status</div>
            <div class="cp-plugin-detail__kvV">{{ installed?.status || "—" }}</div>
          </div>
        </div>
      </div>

      <div class="cp-plugin-detail__actions">
        <button
          v-if="!installed?.currentVersion"
          class="cp-plugin-detail__btn primary"
          type="button"
          :disabled="Boolean(serverSocket) && !Boolean(serverId)"
          @click="installStore.install(plugin, plugin.versions[0] || '')"
        >
          Install latest
        </button>
        <button
          v-else-if="!installed.enabled"
          class="cp-plugin-detail__btn primary"
          type="button"
          :disabled="Boolean(serverSocket) && !Boolean(serverId)"
          @click="installStore.enable(plugin.pluginId)"
        >
          Enable
        </button>
        <button v-else class="cp-plugin-detail__btn" type="button" :disabled="Boolean(serverSocket) && !Boolean(serverId)" @click="installStore.disable(plugin.pluginId)">
          Disable
        </button>

        <button class="cp-plugin-detail__btn" type="button" @click="$router.push('/plugins')">Open Center</button>
      </div>
    </section>

    <section v-else class="cp-plugin-detail__empty">
      <div class="cp-plugin-detail__emptyText">Module not found.</div>
      <button class="cp-plugin-detail__btn" type="button" @click="$router.push('/plugins')">Back to Center</button>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* PluginDetailPage styles */
/* Page wrapper */
.cp-plugin-detail {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Header card (back + title + badges) */
.cp-plugin-detail__head {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

/* Back button */
.cp-plugin-detail__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Back hover */
.cp-plugin-detail__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Plugin display name */
.cp-plugin-detail__name {
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* Meta row (socket / server_id / plugin_id) */
.cp-plugin-detail__meta {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Mono meta item */
.cp-plugin-detail__mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Dot separator */
.cp-plugin-detail__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

/* Status badges container */
.cp-plugin-detail__badges {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* Main body panel */
.cp-plugin-detail__body {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

/* Info card */
.cp-plugin-detail__card {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
}

/* Danger card variant */
.cp-plugin-detail__card.danger {
  border-color: color-mix(in oklab, var(--cp-danger) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
}

/* Card label */
.cp-plugin-detail__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Card value */
.cp-plugin-detail__v {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.45;
}

/* Card value row */
.cp-plugin-detail__vRow {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

/* Source pill */
.cp-plugin-detail__pill {
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
.cp-plugin-detail__ports {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Domain dot */
.cp-plugin-detail__port {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-border) 70%, transparent);
}

/* Domains text */
.cp-plugin-detail__portsText {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Permissions list */
.cp-plugin-detail__perms {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Permission row */
.cp-plugin-detail__perm {
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
.cp-plugin-detail__permKey {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Permission label */
.cp-plugin-detail__permLabel {
  font-size: 12px;
  color: var(--cp-text);
}

/* Permission risk */
.cp-plugin-detail__permRisk {
  font-family: var(--cp-font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* Permission risk: high */
.cp-plugin-detail__perm[data-risk="high"] {
  border-color: color-mix(in oklab, var(--cp-danger) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}

/* Permission risk: medium */
.cp-plugin-detail__perm[data-risk="medium"] {
  border-color: color-mix(in oklab, var(--cp-warn) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-warn) 10%, var(--cp-panel-muted));
}

/* Installed kv grid */
.cp-plugin-detail__kv {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

/* KV item */
.cp-plugin-detail__kvItem {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 14px;
  padding: 10px;
}

/* KV key */
.cp-plugin-detail__kvK {
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* KV value */
.cp-plugin-detail__kvV {
  margin-top: 6px;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
}

/* Actions row */
.cp-plugin-detail__actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Action button */
.cp-plugin-detail__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 9px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Action hover */
.cp-plugin-detail__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Action disabled */
.cp-plugin-detail__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Primary action */
.cp-plugin-detail__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

/* Primary hover */
.cp-plugin-detail__btn.primary:hover {
  border-color: rgba(34, 197, 94, 0.42);
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}

/* Empty state wrapper */
.cp-plugin-detail__empty {
  flex: 1 1 auto;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  display: grid;
  place-items: center;
  gap: 12px;
}

/* Empty state text */
.cp-plugin-detail__emptyText {
  color: var(--cp-text-muted);
}
</style>
