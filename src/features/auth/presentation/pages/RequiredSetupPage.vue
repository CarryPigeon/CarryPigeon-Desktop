<script setup lang="ts">
/**
 * @fileoverview RequiredSetupPage.vue
 * @description Required plugin setup wizard (/required-setup).
 */

import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { useServerInfoStore } from "@/features/servers/presentation/store/serverInfoStore";
import { missingRequiredPlugins, setMissingRequiredPlugins } from "../store/requiredGate";
import { usePluginCatalogStore } from "@/features/plugins/presentation/store/pluginCatalogStore";
import { usePluginInstallStore } from "@/features/plugins/presentation/store/pluginInstallStore";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { checkRequiredGate } from "@/features/auth/data/requiredGateService";

const router = useRouter();
const { t } = useI18n();

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
 * Resolve server-info store scoped to current socket.
 *
 * @returns Server-info store instance.
 */
function computeServerInfoStore() {
  return useServerInfoStore(serverSocket.value);
}

const serverInfoStore = computed(computeServerInfoStore);

/**
 * Expose current `server_id` for gate copy.
 *
 * @returns server_id (empty when missing).
 */
function computeServerId(): string {
  return serverInfoStore.value.info.value?.serverId ?? "";
}

const serverId = computed(computeServerId);

/**
 * Resolve plugin catalog store scoped to current socket.
 *
 * @returns Catalog store instance.
 */
function computeCatalogStore() {
  return usePluginCatalogStore(serverSocket.value);
}

const catalogStore = computed(computeCatalogStore);

/**
 * Resolve plugin install store scoped to current socket.
 *
 * @returns Install store instance.
 */
function computeInstallStore() {
  return usePluginInstallStore(serverSocket.value);
}

const installStore = computed(computeInstallStore);

/**
 * Compute the required plugin catalog entries.
 *
 * @returns Required catalog entries.
 */
function computeRequiredEntries() {
  const out = [];
  for (const p of catalogStore.value.catalog.value) {
    if (p.required) out.push(p);
  }
  return out;
}

const requiredEntries = computed(computeRequiredEntries);

/**
 * Compute required plugin ids (used by `recheckRequired()`).
 *
 * @returns Required plugin ids.
 */
function computeRequiredIds(): string[] {
  const out: string[] = [];
  for (const p of requiredEntries.value) out.push(p.pluginId);
  return out;
}

const requiredIds = computed(computeRequiredIds);

/**
 * Expose missing required plugin ids passed from login errors.
 *
 * @returns Missing ids hint list.
 */
function computeMissingIdsHint(): string[] {
  return missingRequiredPlugins.value;
}

const missingIdsHint = computed(computeMissingIdsHint);

/**
 * Compute whether the required gate is satisfied.
 *
 * Rules:
 * - All required ids must be installed, enabled, and status ok.
 * - The server must define at least one required plugin (avoids showing “closed” on empty lists).
 *
 * @returns `true` when latch is closed.
 */
function computeLatchClosed(): boolean {
  if (requiredIds.value.length <= 0) return false;
  for (const id of requiredIds.value) {
    const s = installStore.value.installedById[id];
    const ok = Boolean(s?.enabled) && s?.status === "ok";
    if (!ok) return false;
  }
  return true;
}

const latchClosed = computed(computeLatchClosed);

const autoReleased = ref(false);

/**
 * Ensure plugin catalog + installed state are loaded for the current server.
 *
 * The required gate depends on both:
 * - Catalog: which plugins are required
 * - Installed: which required plugins are enabled and healthy
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

  // Server-side gate precheck: keep the missing list up-to-date even when the
  // user lands here without a fresh login error (see required gate precheck endpoint).
  try {
    const missing = await checkRequiredGate(serverSocket.value);
    setMissingRequiredPlugins(missing);
  } catch {
    // Best-effort: local install state is still shown; server may be offline.
  }
}

/**
 * Open Plugin Center with `required` filter.
 *
 * @returns void
 */
function openPluginCenterRequired(): void {
  void router.push({ path: "/plugins", query: { filter: "required" } });
}

/**
 * Clear current required gate state and return to login to pick another server.
 *
 * @returns void
 */
function switchServer(): void {
  setMissingRequiredPlugins([]);
  void router.replace("/");
}

/**
 * Watch-source: latch state.
 *
 * @returns Whether latch is closed.
 */
function watchLatchClosed(): boolean {
  return latchClosed.value;
}

/**
 * Auto-release flow: when latch becomes closed the first time, clear gate state and return to login.
 *
 * @param ok - Latch closed state.
 * @returns void
 */
function handleLatchClosedChange(ok: boolean): void {
  if (!ok || autoReleased.value) return;
  autoReleased.value = true;
  setMissingRequiredPlugins([]);
  window.setTimeout(handleAutoReleaseTimeout, 650);
}

/**
 * Timeout callback: navigate back to login after auto-release.
 *
 * @returns void
 */
function handleAutoReleaseTimeout(): void {
  void router.replace("/");
}

watch(watchLatchClosed, handleLatchClosedChange);

/**
 * Component mount hook: prefetch catalog/installed state.
 *
 * @returns void
 */
function handleMounted(): void {
  void ensureData();
}

onMounted(handleMounted);
</script>

<template>
  <!-- 页面：RequiredSetupPage｜职责：必需插件门禁向导（Power Latch） -->
  <!-- 区块：<main> .cp-required -->
  <main class="cp-required">
    <header class="cp-required__banner" :data-ok="latchClosed">
      <div class="cp-required__title">
        <span class="cp-required__mono">{{ latchClosed ? "POWER LATCH CLOSED" : "POWER LATCH OPEN" }}</span>
        <div class="cp-required__titleZh">{{ latchClosed ? t("power_latch_closed") : t("power_latch_open") }}</div>
      </div>
      <div class="cp-required__desc">
        <div v-if="!latchClosed">
          {{ t("required_setup_desc") }}
        </div>
        <div v-else>
          {{ t("required_setup_ready") }}
        </div>
        <div class="cp-required__socket">
          <MonoTag :value="serverSocket || 'no-server'" title="server socket" :copyable="true" />
          <MonoTag :value="serverId || 'missing-server_id'" title="server_id" :copyable="true" />
          <LabelBadge v-if="!latchClosed" variant="required" label="BLOCKED" />
          <LabelBadge v-else variant="info" label="READY" />
        </div>
      </div>
      <div v-if="serverSocket && !serverId" class="cp-required__hint">
        <div class="cp-required__hintTitle">Locked</div>
        <div class="cp-required__hintTags">
          <MonoTag value="missing server_id" />
          <MonoTag value="plugins disabled" />
        </div>
      </div>
      <div v-if="missingIdsHint.length > 0" class="cp-required__hint">
        <div class="cp-required__hintTitle">{{ t("why_blocked") }}</div>
        <div class="cp-required__hintTags">
          <MonoTag v-for="id in missingIdsHint" :key="id" :value="id" :copyable="true" />
        </div>
      </div>
    </header>

    <section class="cp-required__body">
      <div class="cp-required__bodyHead">
        <div class="cp-required__bodyTitle">{{ t("required_setup_title") }}</div>
        <div class="cp-required__bodyMeta">
          <span class="cp-required__muted">missing</span>
          <span class="cp-required__mono">{{ installStore.missingRequiredIds.value.length }}</span>
          <span class="cp-required__dot"></span>
          <span class="cp-required__muted">required</span>
          <span class="cp-required__mono">{{ requiredEntries.length }}</span>
        </div>
      </div>

      <div v-if="catalogStore.loading.value" class="cp-required__state">Loading…</div>
      <div v-else-if="catalogStore.error.value" class="cp-required__state err">{{ catalogStore.error.value }}</div>
      <div v-else class="cp-required__list">
        <article v-for="p in requiredEntries" :key="p.pluginId" class="cp-required__item" :data-ok="Boolean(installStore.installedById[p.pluginId]?.enabled && installStore.installedById[p.pluginId]?.status === 'ok')">
          <header class="cp-required__itemHead">
            <div class="cp-required__itemLeft">
              <div class="cp-required__itemName">{{ p.name }}</div>
              <div class="cp-required__itemMeta">
                <MonoTag :value="p.pluginId" title="plugin_id" :copyable="true" />
                <span class="cp-required__mini">{{ p.versions[0] || "—" }}</span>
              </div>
            </div>
            <div class="cp-required__itemBadges">
              <LabelBadge variant="required" label="REQUIRED" />
              <LabelBadge
                v-if="installStore.installedById[p.pluginId]?.status === 'failed'"
                variant="failed"
                label="FAILED"
              />
              <LabelBadge
                v-else-if="installStore.installedById[p.pluginId]?.enabled"
                variant="info"
                label="ENABLED"
              />
              <LabelBadge v-else-if="installStore.installedById[p.pluginId]?.currentVersion" variant="info" label="INSTALLED" />
              <LabelBadge v-else variant="info" label="MISSING" />
            </div>
          </header>

          <div class="cp-required__itemDesc">{{ p.tagline }}</div>
          <div v-if="installStore.installedById[p.pluginId]?.lastError" class="cp-required__itemErr">
            {{ installStore.installedById[p.pluginId]?.lastError }}
          </div>

          <footer class="cp-required__itemActions">
            <button
              v-if="!installStore.installedById[p.pluginId]?.currentVersion"
              class="cp-required__btn primary"
              type="button"
              :disabled="Boolean(serverSocket) && !Boolean(serverId)"
              @click="installStore.install(p, p.versions[0] || '')"
            >
              {{ t("install") }}
            </button>
            <button
              v-else-if="!installStore.installedById[p.pluginId]?.enabled"
              class="cp-required__btn primary"
              type="button"
              :disabled="Boolean(serverSocket) && !Boolean(serverId)"
              @click="installStore.enable(p.pluginId)"
            >
              {{ t("enable") }}
            </button>
            <button
              v-else
              class="cp-required__btn"
              type="button"
              :disabled="Boolean(serverSocket) && !Boolean(serverId)"
              @click="installStore.disable(p.pluginId)"
            >
              {{ t("disable") }}
            </button>

            <button class="cp-required__btn" type="button" @click="$router.push({ path: '/plugins', query: { focus_plugin_id: p.pluginId, filter: 'required' } })">
              {{ t("plugin_center") }}
            </button>
          </footer>
        </article>
      </div>
    </section>

    <footer class="cp-required__footer">
      <button class="cp-required__footerBtn primary" type="button" @click="openPluginCenterRequired">
        {{ t("open_plugin_center_required") }}
      </button>
      <button class="cp-required__footerBtn" type="button" @click="ensureData">{{ t("recheck_required") }}</button>
      <button class="cp-required__footerBtn" type="button" @click="switchServer">{{ t("switch_server") }}</button>
    </footer>
  </main>
</template>

<style scoped lang="scss">
/* RequiredSetupPage styles */
/* Page wrapper (banner + body + footer) */
.cp-required {
  height: 100%;
  padding: 14px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 12px;
}

/* Banner (power latch status) */
.cp-required__banner {
  border: 1px solid color-mix(in oklab, var(--cp-danger) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
}

/* Banner variant when latch is closed */
.cp-required__banner[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 10%, var(--cp-panel));
}

/* Banner mono title */
.cp-required__mono {
  font-family: var(--cp-font-display);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text);
}

/* Banner Chinese title */
.cp-required__titleZh {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Banner description row */
.cp-required__desc {
  margin-top: 10px;
  color: var(--cp-text);
  font-size: 13px;
  line-height: 1.45;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

/* Hint panel (why blocked / missing server_id) */
.cp-required__hint {
  margin-top: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.26);
  background: var(--cp-panel-muted);
  border-radius: 18px;
  padding: 12px;
}

/* Hint title */
.cp-required__hintTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text);
}

/* Hint tags list */
.cp-required__hintTags {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Banner socket row */
.cp-required__socket {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Body panel (required list container) */
.cp-required__body {
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Body header */
.cp-required__bodyHead {
  padding: 14px;
  border-bottom: 1px solid var(--cp-border-light);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

/* Body title */
.cp-required__bodyTitle {
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* Body meta row */
.cp-required__bodyMeta {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

/* Muted label */
.cp-required__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Dot separator */
.cp-required__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

/* Loading/error state */
.cp-required__state {
  padding: 18px;
  color: var(--cp-text-muted);
  font-size: 13px;
}

/* Error state variant */
.cp-required__state.err {
  color: rgba(248, 113, 113, 0.92);
}

/* Required items grid */
.cp-required__list {
  padding: 14px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  min-height: 0;
}

/* Required item card */
.cp-required__item {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 14px;
  box-shadow: var(--cp-shadow-soft);
}

/* Required item ok variant */
.cp-required__item[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 24%, var(--cp-border));
}

/* Item header row */
.cp-required__itemHead {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

/* Item name */
.cp-required__itemName {
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.02em;
  font-size: 16px;
  color: var(--cp-text);
}

/* Item meta row */
.cp-required__itemMeta {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Item version label */
.cp-required__mini {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Item badges */
.cp-required__itemBadges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

/* Item tagline/description */
.cp-required__itemDesc {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.4;
}

/* Item error box */
.cp-required__itemErr {
  margin-top: 10px;
  border: 1px dashed rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.10);
  border-radius: 14px;
  padding: 10px;
  font-size: 12px;
  color: var(--cp-text);
}

/* Item actions row */
.cp-required__itemActions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* Item button */
.cp-required__btn {
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

/* Item button hover */
.cp-required__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Item button primary */
.cp-required__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

/* Item button primary hover */
.cp-required__btn.primary:hover {
  border-color: color-mix(in oklab, var(--cp-accent) 42%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}

/* Footer actions row */
.cp-required__footer {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* Footer button */
.cp-required__footerBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Footer button hover */
.cp-required__footerBtn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Footer primary */
.cp-required__footerBtn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

/* Footer primary hover */
.cp-required__footerBtn.primary:hover {
  border-color: color-mix(in oklab, var(--cp-accent) 42%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}
</style>
