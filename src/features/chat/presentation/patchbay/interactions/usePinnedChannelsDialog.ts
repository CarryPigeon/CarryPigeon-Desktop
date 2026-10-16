/**
 * @fileoverview 置顶频道编辑弹窗编排。
 * @description chat｜presentation composable：管理弹窗可见性、目标服务器快照与整份有序列表保存。
 */

import { computed, reactive, ref } from "vue";

export type UsePinnedChannelsDialogDeps = {
  /** 当前服务器 socket；为空表示尚未选中服务器。 */
  currentServerSocket(): string;
  /** 当前服务器展示名。 */
  currentServerName(): string;
  /** 指定服务器下的置顶频道有序列表。 */
  pinnedIds(serverSocket: string): readonly string[];
  /** 覆盖指定服务器的置顶频道有序列表。 */
  setPinnedOrder(serverSocket: string, channelIds: readonly string[]): Promise<void>;
  /** 保存成功提示。 */
  notifySaved(): void;
  /** 保存失败提示。 */
  notifySaveFailed(): void;
  /** 非预期错误上报（打开失败 / 保存异常）。 */
  onError(action: string, error: unknown): void;
};

export type PinnedChannelsDialogModel = {
  /** 弹窗可见性。 */
  visible: boolean;
  /** 是否正在保存。 */
  saving: boolean;
  /** 打开弹窗时快照的服务器 socket。 */
  serverSocket: string;
  /** 打开弹窗时快照的服务器展示名。 */
  serverName: string;
  /** 快照服务器下的置顶频道有序列表（保存后随 store 刷新）。 */
  pinnedIds: readonly string[];
  /** 打开弹窗；未选中服务器时不打开。 */
  open(): void;
  /** 关闭弹窗并复位保存态。 */
  close(): void;
  /** 保存草稿顺序：成功关闭并提示，失败保持打开。 */
  handleConfirm(orderedIds: readonly string[]): Promise<void>;
};

/**
 * 创建置顶频道编辑弹窗模型。
 *
 * @param deps - 服务器快照、置顶状态读写与提示依赖。
 * @returns 弹窗状态与开合/保存动作（reactive 包装，模板可直接消费）。
 */
export function usePinnedChannelsDialog(
  deps: UsePinnedChannelsDialogDeps,
): PinnedChannelsDialogModel {
  const visible = ref(false);
  const saving = ref(false);
  const serverSocket = ref("");
  const serverName = ref("");

  const pinnedIds = computed(() => deps.pinnedIds(serverSocket.value));

  function open(): void {
    const socket = deps.currentServerSocket();
    if (!socket) {
      // 未选中服务器时无法定位写入目标，直接拒绝打开并上报，避免"保存了但没生效"。
      deps.onError(
        "chat_pinned_channels_dialog_open_failed",
        new Error("no active server socket"),
      );
      return;
    }
    serverSocket.value = socket;
    serverName.value = deps.currentServerName();
    visible.value = true;
  }

  function close(): void {
    visible.value = false;
  }

  async function handleConfirm(orderedIds: readonly string[]): Promise<void> {
    const socket = serverSocket.value || deps.currentServerSocket();
    if (!socket || saving.value) return;
    saving.value = true;
    try {
      await deps.setPinnedOrder(socket, orderedIds);
      deps.notifySaved();
      close();
    } catch (error) {
      deps.onError("chat_pinned_channels_dialog_save_failed", error);
      deps.notifySaveFailed();
    } finally {
      saving.value = false;
    }
  }

  return reactive({
    visible,
    saving,
    serverSocket,
    serverName,
    pinnedIds,
    open,
    close,
    handleConfirm,
  }) as unknown as PinnedChannelsDialogModel;
}
