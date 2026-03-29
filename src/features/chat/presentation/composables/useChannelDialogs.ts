/**
 * @fileoverview 频道创建/删除弹窗编排：状态与后续动作处理。
 * @description chat｜presentation composable：收敛主页面频道弹窗状态与删除后续动作。
 */

import { ref, type ComputedRef, type Ref } from "vue";
import type { ChannelSelectionOutcome } from "@/features/chat/room-session/api-types";
import { createAsyncTaskRunner } from "./asyncTaskRunner";

type RefLike<T> = Ref<T> | ComputedRef<T>;

type ChannelLike = {
  id: string;
  name: string;
};

export type UseChannelDialogsDeps = {
  currentChannelId: RefLike<string>;
  channels: RefLike<readonly ChannelLike[]>;
  findChannelById(channelId: string): ChannelLike | null | undefined;
  selectChannel(channelId: string): Promise<ChannelSelectionOutcome>;
  closeChannelMenu(): void;
  onAsyncError(action: string, error: unknown): void;
};

/**
 * 主页面频道创建/删除弹窗编排。
 */
export function useChannelDialogs(deps: UseChannelDialogsDeps) {
  const showCreateChannel = ref(false);
  const showDeleteChannel = ref(false);
  const deleteChannelId = ref("");
  const deleteChannelName = ref("");
  const runAsyncTask = createAsyncTaskRunner(deps.onAsyncError);

  function setShowCreateChannel(visible: boolean): void {
    showCreateChannel.value = visible;
  }

  function setShowDeleteChannel(visible: boolean): void {
    showDeleteChannel.value = visible;
  }

  function handleChannelCreated(channel: ChannelLike): void {
    runAsyncTask(
      deps.selectChannel(channel.id).then((outcome) => {
        if (!outcome.ok) deps.onAsyncError("chat_select_created_channel_failed", outcome.error.message);
        return outcome;
      }),
      "chat_select_created_channel_failed",
    );
  }

  function openDeleteChannelDialog(): void {
    const channel = deps.findChannelById(deps.currentChannelId.value);
    if (!channel) return;
    deleteChannelId.value = channel.id;
    deleteChannelName.value = channel.name;
    showDeleteChannel.value = true;
    deps.closeChannelMenu();
  }

  function handleChannelDeleted(): void {
    const remainingChannels = deps.channels.value;
    if (remainingChannels.length <= 0) return;
    runAsyncTask(
      deps.selectChannel(remainingChannels[0].id).then((outcome) => {
        if (!outcome.ok) deps.onAsyncError("chat_select_after_delete_failed", outcome.error.message);
        return outcome;
      }),
      "chat_select_after_delete_failed",
    );
  }

  return {
    showCreateChannel,
    showDeleteChannel,
    deleteChannelId,
    deleteChannelName,
    setShowCreateChannel,
    setShowDeleteChannel,
    handleChannelCreated,
    openDeleteChannelDialog,
    handleChannelDeleted,
  };
}
