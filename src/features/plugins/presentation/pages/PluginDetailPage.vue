<script setup lang="ts">
/**
 * @fileoverview PluginDetailPage.vue
 * @description plugins｜页面：PluginDetailPage。
 */

import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { createPluginContext, type PluginCatalogEntry } from "@/features/plugins/api";
import { useCurrentServerContext } from "@/features/servers/api";

const route = useRoute();
const router = useRouter();

/**
 * 从路由参数中读取插件 id。
 *
 * @returns 插件 id。
 */
function computePluginId(): string {
  return String(route.params.pluginId ?? "").trim();
}

const pluginId = computed(computePluginId);

const { socket: serverSocket, serverInfoStore, serverId, refreshServerInfo } = useCurrentServerContext();
const requiredPluginsDeclared = computed(() => serverInfoStore.value.info.value?.requiredPlugins ?? null);
const { catalogStore, installStore, refreshCatalog, refreshInstalled } = createPluginContext({ socket: serverSocket, requiredPluginsDeclared });

/**
 * 获取当前页面对应的插件目录条目。
 *
 * @returns 目录条目；未找到时返回 `null`。
 */
function computePlugin(): PluginCatalogEntry | null {
  return catalogStore.value.byId.value[pluginId.value] ?? null;
}

const plugin = computed(computePlugin);

/**
 * 获取当前插件的已安装状态。
 *
 * @returns 已安装状态；未安装时返回 `null`。
 */
function computeInstalled() {
  return installStore.value.installedById[pluginId.value] ?? null;
}

const installed = computed(computeInstalled);

/**
 * 判断是否存在可用更新（目录最新版与当前已启用版本不同）。
 *
 * @returns 存在更新则为 `true`。
 */
function computeHasUpdate(): boolean {
  const latest = plugin.value?.versions?.[0] ?? "";
  const current = installed.value?.currentVersion ?? "";
  return Boolean(latest && current && latest !== current);
}

const hasUpdate = computed(computeHasUpdate);

/**
 * 格式化插件提供的 domains 标签，供展示使用。
 *
 * @returns 拼接后的标签文本；插件缺失时返回空字符串。
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
 * 确保详情页所需数据已就绪（server info + catalog + installed）。
 *
 * @returns 无返回值。
 */
async function ensureData(): Promise<void> {
  if (!serverSocket.value) return;
  await Promise.all([refreshServerInfo(), refreshCatalog(), refreshInstalled()]);
}

/**
 * 组件挂载：预拉取数据。
 *
 * @returns 无返回值。
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
/* 布局与变量说明：使用全局 `--cp-*` 变量；主体为两列网格，底部为动作按钮行。 */
.cp-plugin-detail {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

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

.cp-plugin-detail__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-plugin-detail__name {
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-plugin-detail__meta {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cp-plugin-detail__mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugin-detail__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

.cp-plugin-detail__badges {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

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

.cp-plugin-detail__card {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
}

.cp-plugin-detail__card.danger {
  border-color: color-mix(in oklab, var(--cp-danger) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
}

.cp-plugin-detail__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugin-detail__v {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.45;
}

.cp-plugin-detail__vRow {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

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

.cp-plugin-detail__ports {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cp-plugin-detail__port {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-border) 70%, transparent);
}

.cp-plugin-detail__portsText {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugin-detail__perms {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

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

.cp-plugin-detail__permKey {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugin-detail__permLabel {
  font-size: 12px;
  color: var(--cp-text);
}

.cp-plugin-detail__permRisk {
  font-family: var(--cp-font-display);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-plugin-detail__perm[data-risk="high"] {
  border-color: color-mix(in oklab, var(--cp-danger) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}

.cp-plugin-detail__perm[data-risk="medium"] {
  border-color: color-mix(in oklab, var(--cp-warn) 28%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-warn) 10%, var(--cp-panel-muted));
}

.cp-plugin-detail__kv {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.cp-plugin-detail__kvItem {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 14px;
  padding: 10px;
}

.cp-plugin-detail__kvK {
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-plugin-detail__kvV {
  margin-top: 6px;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
}

.cp-plugin-detail__actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

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

.cp-plugin-detail__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-plugin-detail__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.cp-plugin-detail__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-plugin-detail__btn.primary:hover {
  border-color: rgba(34, 197, 94, 0.42);
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}

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

.cp-plugin-detail__emptyText {
  color: var(--cp-text-muted);
}
</style>
