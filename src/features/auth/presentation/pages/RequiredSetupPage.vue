<script setup lang="ts">
/**
 * @fileoverview RequiredSetupPage.vue
 * @description auth｜页面：RequiredSetupPage。
 */

import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { missingRequiredPlugins, setMissingRequiredPlugins } from "../store/requiredGate";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { getCheckRequiredGateUsecase } from "@/features/auth/di/auth.di";
import { useCurrentServerContext } from "@/features/servers/api";
import { createPluginContext } from "@/features/plugins/api";

const router = useRouter();
const { t } = useI18n();

const { socket: serverSocket, serverInfoStore, serverId, refreshServerInfo } = useCurrentServerContext();
const requiredPluginsDeclared = computed(() => serverInfoStore.value.info.value?.requiredPlugins ?? null);
const { catalogStore, installStore, refreshCatalog, refreshInstalled } = createPluginContext({ socket: serverSocket, requiredPluginsDeclared });

/**
 * 计算 required 插件的目录条目列表。
 *
 * @returns required 插件目录条目列表。
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
 * 计算 required 插件 id 列表（用于 `recheckRequired()`）。
 *
 * @returns required 插件 id 列表。
 */
function computeRequiredIds(): string[] {
  const out: string[] = [];
  for (const p of requiredEntries.value) out.push(p.pluginId);
  return out;
}

const requiredIds = computed(computeRequiredIds);

/**
 * 读取登录失败时携带的“缺失 required 插件”提示列表。
 *
 * @returns 缺失插件 id 列表。
 */
function computeMissingIdsHint(): string[] {
  return missingRequiredPlugins.value;
}

const missingIdsHint = computed(computeMissingIdsHint);

/**
 * 计算“必装插件闸门”是否已满足。
 *
 * 规则：
 * - 所有 required id 必须已安装、已启用且状态为 ok。
 * - 服务端必须声明至少一个 required 插件（避免在 required 列表为空时误判为“已满足”）。
 *
 * @returns 当闸门“已关闭”（即要求已满足）时返回 `true`。
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
const justClosedLatch = ref(false);

const autoReleased = ref(false);

/**
 * 确保当前服务器的“插件目录 + 已安装状态”已加载完成。
 *
 * required gate 同时依赖：
 * - catalog：有哪些插件被标记为 required
 * - installed：这些 required 插件是否已启用且健康
 *
 * @returns 无返回值。
 */
async function ensureData(): Promise<void> {
  if (!serverSocket.value) return;
  await Promise.all([
    refreshServerInfo(),
    refreshCatalog(),
    refreshInstalled(),
  ]);
  installStore.value.recheckRequired(requiredIds.value);

  // 服务端 gate 预检：即便用户不是从“最新登录失败”跳转到此页，也尽力保持缺失列表最新（参考 required gate precheck 端点）。
  try {
    const missing = await getCheckRequiredGateUsecase().execute(serverSocket.value);
    setMissingRequiredPlugins(missing);
  } catch {
    // best-effort：仍展示本地安装状态；服务端可能离线。
  }
}

/**
 * 打开插件中心，并启用 `required` 过滤器。
 *
 * @returns 无返回值。
 */
function openPluginCenterRequired(): void {
  void router.push({ path: "/plugins", query: { filter: "required" } });
}

/**
 * 清理 required gate 状态并返回登录页，以便切换服务器。
 *
 * @returns 无返回值。
 */
function switchServer(): void {
  setMissingRequiredPlugins([]);
  void router.replace("/");
}

/**
 * watch 源：闸门闭合状态。
 *
 * @returns 闸门已闭合时返回 `true`。
 */
function watchLatchClosed(): boolean {
  return latchClosed.value;
}

/**
 * 自动释放流程：当闸门首次闭合时，清理 gate 状态并返回登录页。
 *
 * @param ok - 闸门闭合状态。
 * @returns 无返回值。
 */
function handleLatchClosedChange(ok: boolean): void {
  if (!ok || autoReleased.value) return;
  justClosedLatch.value = true;
  window.setTimeout(() => {
    justClosedLatch.value = false;
  }, 640);
  autoReleased.value = true;
  setMissingRequiredPlugins([]);
  window.setTimeout(handleAutoReleaseTimeout, 650);
}

/**
 * 定时回调：在自动释放后返回登录页。
 *
 * @returns 无返回值。
 */
function handleAutoReleaseTimeout(): void {
  void router.replace("/");
}

watch(watchLatchClosed, handleLatchClosedChange);

/**
 * 组件挂载：预拉取 catalog/installed 状态（best-effort）。
 *
 * @returns 无返回值。
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
    <header class="cp-required__banner" :data-ok="latchClosed" :data-just-closed="justClosedLatch">
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
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    transform 220ms var(--cp-ease);
  animation: cp-latch-alert 380ms ease-out 1;
}

/* Banner variant when latch is closed */
.cp-required__banner[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 10%, var(--cp-panel));
  animation: none;
}

.cp-required__banner[data-just-closed="true"] {
  animation: cp-latch-close 520ms cubic-bezier(0.22, 1, 0.36, 1) 1;
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

@keyframes cp-latch-alert {
  0% {
    transform: translateX(-3px);
  }
  35% {
    transform: translateX(2px);
  }
  70% {
    transform: translateX(-1px);
  }
  100% {
    transform: translateX(0);
  }
}

@keyframes cp-latch-close {
  0% {
    transform: scale(0.992);
    box-shadow: var(--cp-shadow-soft);
  }
  45% {
    transform: scale(1.008);
    box-shadow: 0 16px 40px color-mix(in oklab, var(--cp-accent) 20%, transparent);
  }
  100% {
    transform: scale(1);
    box-shadow: var(--cp-shadow-soft);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-required__banner,
  .cp-required__btn,
  .cp-required__footerBtn {
    transition: none !important;
    animation: none !important;
  }
}
</style>
