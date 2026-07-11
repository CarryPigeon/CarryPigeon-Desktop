/**
 * @fileoverview useLoginWizard.ts
 * @description account/auth-flow｜页面编排：4 步登录向导（连接 → 准备 → 账户）。
 */

import { computed, onMounted, ref, type ComputedRef, type Ref } from "vue";
import { useLoginConnection, type TransportKind } from "./useLoginConnection";
import { useAuthServerWorkspace } from "@/features/account/auth-flow/integration/serverWorkspace";
import { createRequiredSetupPluginsWorkspace } from "@/features/account/auth-flow/integration/pluginWorkspace";
import { getPluginsCapabilities } from "@/features/plugins/api";
import type { ServerInfo } from "@/features/server-connection/api-types";

export type LoginStep = "server" | "prepare" | "account";

type WizardPluginsWorkspace = ReturnType<typeof createRequiredSetupPluginsWorkspace>;
type WizardPluginEntry = WizardPluginsWorkspace["catalog"]["value"][number];
type WizardServerWorkspace = ReturnType<typeof useAuthServerWorkspace>;

export type UseLoginWizardDeps = {
  onSocketDraftChanged?: () => void;
};

export type LoginWizardModel = {
  step: Ref<LoginStep>;
  transport: Ref<TransportKind>;
  socketDraft: Ref<string>;
  connectionPhase: WizardServerWorkspace["connectionPhase"];
  connectionDetail: WizardServerWorkspace["connectionDetail"];
  connectionPillState: WizardServerWorkspace["connectionPillState"];
  currentServerSocket: WizardServerWorkspace["socket"];
  serverConnectFailed: ComputedRef<boolean>;
  serverInfo: ComputedRef<ServerInfo | null>;
  serverConfirmed: ComputedRef<boolean>;
  plugins: WizardPluginsWorkspace;
  requiredEntries: ComputedRef<WizardPluginEntry[]>;
  allRequiredReady: ComputedRef<boolean>;
  missingRequiredIds: WizardPluginsWorkspace["missingRequiredIds"];
  latestVersion(plugin: WizardPluginEntry): string;
  ensurePrepareData(): Promise<void>;
  handleConnect(): Promise<void>;
  retryConnect(): Promise<void>;
  goToServer(): void;
  goToPrepare(): void;
  goToAccount(): void;
  beginAccount(): void;
};

/**
 * 登录向导模型（4 步：连接 → 准备必装插件 → 账户登录）。
 *
 * @param deps - 可选回调（socket draft 改变时触发）。
 * @returns 向导状态与动作。
 */
export function useLoginWizard(deps: UseLoginWizardDeps = {}): LoginWizardModel {
  const conn = useLoginConnection({ onSocketDraftChanged: deps?.onSocketDraftChanged });
  const ws = useAuthServerWorkspace();
  const pluginsCapabilities = getPluginsCapabilities();

  const step = ref<LoginStep>("server");

  const requiredPluginsDeclared = computed(() => ws.serverInfoStore.value.info.value?.requiredPlugins ?? null);
  const plugins = createRequiredSetupPluginsWorkspace({
    socket: ws.socket,
    requiredPluginsDeclared,
  });

  const currentServerSocket = ws.socket;

  const serverConnectFailed = computed(() => ws.connectionPhase.value === "failed");
  const serverInfo = computed(() => ws.serverInfoStore.value.info.value);
  const serverConfirmed = computed(
    () => ws.connectionPhase.value === "connected" && Boolean(serverInfo.value?.serverId),
  );

  const requiredEntries = computed<WizardPluginEntry[]>(() =>
    plugins.catalog.value.filter((p) => p.required),
  );

  const allRequiredReady = computed<boolean>(() => {
    const ids = requiredEntries.value.map((p) => p.pluginId);
    if (ids.length === 0) return true;
    return ids.every((id) => {
      const s = plugins.installedById.value[id];
      return Boolean(s?.enabled) && s?.status === "ok";
    });
  });

  function latestVersion(plugin: WizardPluginEntry): string {
    return pluginsCapabilities.catalog.resolveLatestVersion(plugin);
  }

  async function ensurePrepareData(): Promise<void> {
    if (!ws.socket.value) return;
    await Promise.all([ws.refreshServerInfo(), plugins.refreshCatalog()]);
    await plugins.refreshInstalledAndRecheck(requiredEntries.value.map((p) => p.pluginId));
  }

  async function handleConnect(): Promise<void> {
    await conn.handleConnect();
    if (serverConfirmed.value) {
      await ensurePrepareData();
      step.value = "prepare";
    }
  }

  async function retryConnect(): Promise<void> {
    return handleConnect();
  }

  function goToServer(): void {
    step.value = "server";
  }

  function goToPrepare(): void {
    step.value = "prepare";
  }

  function goToAccount(): void {
    step.value = "account";
  }

  function beginAccount(): void {
    if (allRequiredReady.value) step.value = "account";
  }

  onMounted(() => {
    if (serverConfirmed.value) {
      void ensurePrepareData().then(() => {
        step.value = "prepare";
      });
    }
  });

  return {
    step,
    transport: conn.transport,
    socketDraft: conn.socketDraft,
    connectionPhase: ws.connectionPhase,
    connectionDetail: ws.connectionDetail,
    connectionPillState: ws.connectionPillState,
    currentServerSocket,
    serverConnectFailed,
    serverInfo,
    serverConfirmed,
    plugins,
    requiredEntries,
    allRequiredReady,
    missingRequiredIds: plugins.missingRequiredIds,
    latestVersion,
    ensurePrepareData,
    handleConnect,
    retryConnect,
    goToServer,
    goToPrepare,
    goToAccount,
    beginAccount,
  };
}
