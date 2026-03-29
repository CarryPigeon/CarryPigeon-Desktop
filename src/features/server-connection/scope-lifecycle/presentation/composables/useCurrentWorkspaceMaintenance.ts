/**
 * @fileoverview useCurrentWorkspaceMaintenance
 * @description
 * server-connection/scope-lifecycle｜页面编排：当前 server workspace 本地维护信息与清理动作。
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import { getScopeLifecycleCapabilities } from "@/features/server-connection/scope-lifecycle/api";
import { getKnownServerId, getServerScopeKey } from "@/shared/serverIdentity";

const serverConnectionCapabilities = getServerConnectionCapabilities();
const scopeLifecycleCapabilities = getScopeLifecycleCapabilities();

export const CLEAR_CURRENT_WORKSPACE_CONFIRM_TEXT = "CLEAR";

export type CurrentWorkspaceMaintenanceModel = {
  clearConfirm: Ref<string>;
  clearing: Ref<boolean>;
  clearError: Ref<string>;
  clearConfirmToken: string;
  socket: ComputedRef<string>;
  knownServerId: ComputedRef<string>;
  scopeKey: ComputedRef<string>;
  clearCurrentWorkspaceLocalData(): Promise<void>;
};

export function useCurrentWorkspaceMaintenance(): CurrentWorkspaceMaintenanceModel {
  const clearConfirm = ref("");
  const clearing = ref(false);
  const clearError = ref("");

  const socket = computed(() => serverConnectionCapabilities.workspace.readSocket().trim());
  const knownServerId = computed(() => getKnownServerId(socket.value));
  const scopeKey = computed(() => getServerScopeKey(socket.value));

  function readConfirmError(socketValue: string): string | null {
    if (!socketValue) return "Missing server socket.";
    if (clearConfirm.value.trim().toUpperCase() !== CLEAR_CURRENT_WORKSPACE_CONFIRM_TEXT) {
      return `Type "${CLEAR_CURRENT_WORKSPACE_CONFIRM_TEXT}" to confirm.`;
    }
    return null;
  }

  async function clearCurrentWorkspaceLocalData(): Promise<void> {
    clearError.value = "";
    const socketValue = socket.value;
    const confirmError = readConfirmError(socketValue);
    if (confirmError) {
      clearError.value = confirmError;
      return;
    }

    clearing.value = true;
    try {
      await scopeLifecycleCapabilities.clearCurrentWorkspace(socketValue);
      clearConfirm.value = "";
    } catch (error) {
      clearError.value = String(error) || "Clear failed.";
    } finally {
      clearing.value = false;
    }
  }

  return {
    clearConfirm,
    clearing,
    clearError,
    clearConfirmToken: CLEAR_CURRENT_WORKSPACE_CONFIRM_TEXT,
    socket,
    knownServerId,
    scopeKey,
    clearCurrentWorkspaceLocalData,
  };
}
