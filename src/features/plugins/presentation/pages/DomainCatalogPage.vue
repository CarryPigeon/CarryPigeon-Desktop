<script setup lang="ts">
/**
 * @fileoverview DomainCatalogPage.vue
 * @description Domain Catalog viewer (/domains) — contract discovery for plugin developers and better diagnostics.
 *
 * PRD mapping:
 * - PRD 6.4 Domain Catalog：展示 domains/versions/providers/contract 指针。
 *
 * API mapping:
 * - `GET /api/domains/catalog` (`docs/api/11-HTTP端点清单（v1，标准版）.md`)
 */

import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { useServerInfoStore } from "@/features/servers/presentation/store/serverInfoStore";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { useDomainCatalogStore } from "@/features/plugins/presentation/store/domainCatalogStore";

const router = useRouter();
const q = ref("");

/**
 * Compute the current server socket key.
 *
 * @returns Trimmed socket string.
 */
function computeSocket(): string {
  return currentServerSocket.value.trim();
}

const socket = computed(computeSocket);

/**
 * Resolve the server-info store scoped to the current socket.
 *
 * @returns Server-info store.
 */
function computeServerInfoStore() {
  return useServerInfoStore(socket.value);
}

const serverInfoStore = computed(computeServerInfoStore);

/**
 * Expose server_id for diagnostics (plugins are disabled when missing).
 *
 * @returns server_id (empty when missing).
 */
function computeServerId(): string {
  return serverInfoStore.value.info.value?.serverId ?? "";
}

const serverId = computed(computeServerId);

/**
 * Resolve the domain catalog store scoped to the current socket.
 *
 * @returns Domain catalog store.
 */
function computeDomainCatalogStore() {
  return useDomainCatalogStore(socket.value);
}

const domainCatalogStore = computed(computeDomainCatalogStore);

/**
 * Refresh both server info and domain catalog (best-effort).
 *
 * @returns Promise<void>
 */
async function refresh(): Promise<void> {
  await Promise.all([serverInfoStore.value.refresh(), domainCatalogStore.value.refresh()]);
}

/**
 * Compute filtered domain items by search query.
 *
 * @returns Filtered list.
 */
function computeFiltered() {
  const needle = q.value.trim().toLowerCase();
  const items = domainCatalogStore.value.items.value;
  if (!needle) return items;
  return items.filter((it) => String(it.domain ?? "").toLowerCase().includes(needle));
}

const filtered = computed(computeFiltered);

let queryTimer: number | null = null;

/**
 * Watch-source: search query.
 *
 * @returns Query string.
 */
function watchQuery(): string {
  return q.value;
}

/**
 * Debounce query changes to keep typing smooth.
 */
function handleQueryChange(): void {
  if (queryTimer) window.clearTimeout(queryTimer);
  queryTimer = window.setTimeout(() => {
    queryTimer = null;
  }, 120);
}

watch(watchQuery, handleQueryChange);

onMounted(() => {
  void refresh();
});
</script>

<template>
  <!-- 页面：DomainCatalogPage｜职责：Domain Catalog（providers/constraints/contract）展示与复制 -->
  <main class="cp-domains">
    <header class="cp-domains__head">
      <button class="cp-domains__back" type="button" @click="router.back()">Back</button>
      <div class="cp-domains__title">
        <div class="cp-domains__name">Domain Catalog</div>
        <div class="cp-domains__sub">Contracts · Providers · Constraints</div>
      </div>
      <div class="cp-domains__meta">
        <MonoTag :value="socket || 'no-server'" title="server socket" :copyable="true" />
        <MonoTag :value="serverId || 'missing-server_id'" title="server_id" :copyable="true" />
      </div>
    </header>

    <section class="cp-domains__controls">
      <div class="cp-domains__field">
        <div class="cp-domains__label">search</div>
        <t-input v-model="q" placeholder="Core:Text / Math:Formula …" clearable />
      </div>
      <div class="cp-domains__actions">
        <button class="cp-domains__btn" type="button" @click="refresh">Refresh</button>
        <button class="cp-domains__btn" type="button" @click="$router.push('/plugins')">Plugin Center</button>
      </div>
    </section>

    <div v-if="socket && !serverId" class="cp-domains__state warn">
      Missing <code>server_id</code> from <code>GET /api/server</code>. Plugin install/enable/update will be disabled, but Domain Catalog remains readable.
    </div>

    <div v-if="domainCatalogStore.loading.value" class="cp-domains__state">Loading…</div>
    <div v-else-if="domainCatalogStore.error.value" class="cp-domains__state err">{{ domainCatalogStore.error.value }}</div>

    <section v-else class="cp-domains__list">
      <div v-if="filtered.length === 0" class="cp-domains__state">No items.</div>

      <article v-for="it in filtered" :key="it.domain" class="cp-domainCard">
        <div class="cp-domainCard__top">
          <div class="cp-domainCard__domain">{{ it.domain }}</div>
          <div class="cp-domainCard__versions">
            <span class="cp-domainCard__pill">recommended: {{ it.recommendedVersion || "—" }}</span>
            <span class="cp-domainCard__pill">supported: {{ (it.supportedVersions || []).length }}</span>
          </div>
        </div>

        <div class="cp-domainCard__grid">
          <div class="cp-domainCard__kv">
            <div class="cp-domainCard__k">constraints</div>
            <div class="cp-domainCard__v">
              <span class="cp-domainCard__mono">max_payload_bytes={{ it.constraints?.maxPayloadBytes ?? "—" }}</span>
              <span class="cp-domainCard__mono">max_depth={{ it.constraints?.maxDepth ?? "—" }}</span>
            </div>
          </div>

          <div class="cp-domainCard__kv">
            <div class="cp-domainCard__k">providers</div>
            <div class="cp-domainCard__v">
              <template v-if="(it.providers || []).length === 0">—</template>
              <div v-for="(p, idx) in it.providers || []" :key="`${it.domain}-${idx}`" class="cp-domainCard__provider">
                <span class="cp-domainCard__pill">{{ p.type }}</span>
                <span v-if="p.type === 'plugin'" class="cp-domainCard__mono">
                  {{ p.pluginId }} (min {{ p.minPluginVersion || "—" }})
                </span>
              </div>
            </div>
          </div>

          <div class="cp-domainCard__kv wide">
            <div class="cp-domainCard__k">contract</div>
            <div class="cp-domainCard__v">
              <div v-if="it.contract?.schemaUrl" class="cp-domainCard__contract">
                <MonoTag :value="it.contract.schemaUrl" title="schema_url" :copyable="true" />
                <span class="cp-domainCard__mono">sha256={{ it.contract.sha256 || "—" }}</span>
              </div>
              <div v-else class="cp-domainCard__muted">—</div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* DomainCatalogPage styles | layout: head + controls + list | tokens: --cp-* */
.cp-domains {
  height: 100%;
  padding: 14px;
  display: grid;
  grid-template-rows: auto auto auto 1fr;
  gap: 12px;
}

.cp-domains__head {
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

.cp-domains__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-domains__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-domains__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.06em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-domains__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-domains__meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.cp-domains__controls {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
}

.cp-domains__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-domains__label {
  font-size: 11px;
  color: var(--cp-text-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cp-domains__actions {
  display: flex;
  gap: 10px;
}

.cp-domains__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-domains__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-domains__state {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--cp-text-muted);
}

.cp-domains__state.err {
  border-color: color-mix(in oklab, var(--cp-danger) 55%, var(--cp-border));
  color: var(--cp-danger);
}

.cp-domains__state.warn {
  border-color: color-mix(in oklab, var(--cp-accent) 35%, var(--cp-border));
  color: var(--cp-text);
}

.cp-domains__list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-domainCard {
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
}

.cp-domainCard__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.cp-domainCard__domain {
  font-family: var(--cp-font-display);
  letter-spacing: 0.08em;
  font-size: 14px;
  font-weight: 900;
  color: var(--cp-text);
}

.cp-domainCard__versions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cp-domainCard__pill {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
}

.cp-domainCard__grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.cp-domainCard__kv {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-domainCard__kv.wide {
  grid-column: 1 / -1;
}

.cp-domainCard__k {
  font-size: 11px;
  color: var(--cp-text-muted);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cp-domainCard__v {
  font-size: 12px;
  color: var(--cp-text);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-domainCard__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-domainCard__provider {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.cp-domainCard__contract {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cp-domainCard__muted {
  color: var(--cp-text-muted);
}
</style>
