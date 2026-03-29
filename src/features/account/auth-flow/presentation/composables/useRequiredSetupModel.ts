/**
 * @fileoverview useRequiredSetupModel.ts
 * @description account/auth-flow｜页面编排：required setup（必装插件闸门）。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from "vue";
import type { Router } from "vue-router";
import { getAuthFlowCapabilities } from "@/features/account/auth-flow/api";
import { createRequiredSetupPluginsWorkspace } from "@/features/account/auth-flow/integration/pluginWorkspace";
import { useAuthServerWorkspace } from "@/features/account/auth-flow/integration/serverWorkspace";
import { getPluginsCapabilities } from "@/features/plugins/api";

const authFlowCapabilities = getAuthFlowCapabilities();
const pluginsCapabilities = getPluginsCapabilities();
type RequiredSetupPluginCatalogEntry = ReturnType<typeof createRequiredSetupPluginsWorkspace>["catalog"]["value"][number];

export type RequiredSetupModel = {
  serverSocket: Ref<string>;
  serverId: Ref<string>;
  plugins: ReturnType<typeof createRequiredSetupPluginsWorkspace>;
  requiredEntries: ComputedRef<RequiredSetupPluginCatalogEntry[]>;
  missingIdsHint: ComputedRef<string[]>;
  latchClosed: ComputedRef<boolean>;
  justClosedLatch: Ref<boolean>;
  ensureData(): Promise<void>;
  openPluginCenterRequired(): void;
  switchServer(): void;
  latestVersion(plugin: RequiredSetupPluginCatalogEntry): string;
};

/**
 * RequiredSetup 页面模型。
 *
 * @param router - 路由实例。
 * @returns 页面所需状态与动作。
 */
export function useRequiredSetupModel(router: Router): RequiredSetupModel {
  const { socket: serverSocket, serverInfoStore, serverId, refreshServerInfo } = useAuthServerWorkspace();
  const requiredPluginsDeclared = computed(() => serverInfoStore.value.info.value?.requiredPlugins ?? null);
  const plugins = createRequiredSetupPluginsWorkspace({
    socket: serverSocket,
    requiredPluginsDeclared,
  });

  const requiredEntries = computed<RequiredSetupPluginCatalogEntry[]>(() => {
    const out: RequiredSetupPluginCatalogEntry[] = [];
    for (const p of plugins.catalog.value) {
      if (p.required) out.push(p);
    }
    return out;
  });

  const requiredIds = computed<string[]>(() => requiredEntries.value.map((p) => p.pluginId));
  const missingIdsHint = computed<string[]>(() => Array.from(authFlowCapabilities.getMissingRequiredPlugins()));

  const latchClosed = computed<boolean>(() => {
    if (requiredIds.value.length <= 0) return false;
    for (const id of requiredIds.value) {
      const s = plugins.installedById.value[id];
      const ok = Boolean(s?.enabled) && s?.status === "ok";
      if (!ok) return false;
    }
    return true;
  });

  const justClosedLatch = ref(false);
  const autoReleased = ref(false);
  let closeBadgeTimer: number | null = null;
  let autoReleaseTimer: number | null = null;

  async function ensureData(): Promise<void> {
    if (!serverSocket.value) return;
    const authServer = authFlowCapabilities.forServer(serverSocket.value);
    await Promise.all([refreshServerInfo(), plugins.refreshCatalog()]);
    await plugins.refreshInstalledAndRecheck(requiredIds.value);

    const outcome = await authServer.checkRequiredSetup();
    if (!outcome.ok) {
      return;
    }
    if (outcome.kind === "required_setup_required") {
      authFlowCapabilities.updateMissingRequiredPlugins([...outcome.missingPluginIds]);
      return;
    }
    authFlowCapabilities.clearMissingRequiredPlugins();
  }

  function openPluginCenterRequired(): void {
    void router.push({ path: "/plugins", query: { filter: "required" } });
  }

  function switchServer(): void {
    authFlowCapabilities.clearMissingRequiredPlugins();
    void router.replace("/");
  }

  function latestVersion(plugin: RequiredSetupPluginCatalogEntry): string {
    return pluginsCapabilities.catalog.resolveLatestVersion(plugin);
  }

  watch(latchClosed, (ok) => {
    if (!ok || autoReleased.value) return;
    justClosedLatch.value = true;
    if (closeBadgeTimer) window.clearTimeout(closeBadgeTimer);
    closeBadgeTimer = window.setTimeout(() => {
      justClosedLatch.value = false;
      closeBadgeTimer = null;
    }, 640);
    autoReleased.value = true;
    authFlowCapabilities.clearMissingRequiredPlugins();
    if (autoReleaseTimer) window.clearTimeout(autoReleaseTimer);
    autoReleaseTimer = window.setTimeout(() => {
      autoReleaseTimer = null;
      void router.replace("/");
    }, 650);
  });

  onMounted(() => {
    void ensureData();
  });

  onBeforeUnmount(() => {
    if (closeBadgeTimer) {
      window.clearTimeout(closeBadgeTimer);
      closeBadgeTimer = null;
    }
    if (autoReleaseTimer) {
      window.clearTimeout(autoReleaseTimer);
      autoReleaseTimer = null;
    }
  });

  return {
    serverSocket,
    serverId,
    plugins,
    requiredEntries,
    missingIdsHint,
    latchClosed,
    justClosedLatch,
    ensureData,
    openPluginCenterRequired,
    switchServer,
    latestVersion,
  };
}
