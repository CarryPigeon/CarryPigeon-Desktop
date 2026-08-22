/**
 * @fileoverview 频道信息弹窗编排。
 * @description chat｜presentation composable：管理频道信息应用内弹窗的可见性与目标频道。
 */

import { reactive, ref } from "vue";

export type ChannelInfoDialogTarget = {
  id: string;
  name: string;
  brief: string;
};

export type UseChannelInfoDialogDeps = {
  /**
   * 按频道 id 查找目录频道；找不到时弹窗仍打开（仅展示 id），由内部回落处理。
   */
  findChannelById(channelId: string): { id: string; name?: string; brief?: string } | null;
};

export type ChannelInfoDialogModel = {
  visible: boolean;
  channelId: string;
  channelName: string;
  channelBrief: string;
  openChannelInfo(channelId: string): void;
  close(): void;
};

/**
 * 创建频道信息弹窗模型。
 *
 * @param deps - 频道目录查询依赖。
 * @returns 弹窗状态与开合动作（reactive 包装，模板可直接消费）。
 */
export function useChannelInfoDialog(deps: UseChannelInfoDialogDeps): ChannelInfoDialogModel {
  const visible = ref(false);
  const channelId = ref("");
  const channelName = ref("");
  const channelBrief = ref("");

  function openChannelInfo(nextChannelId: string): void {
    if (!nextChannelId) return;
    const channel = deps.findChannelById(nextChannelId);
    channelId.value = nextChannelId;
    channelName.value = channel?.name ?? "";
    channelBrief.value = channel?.brief ?? "";
    visible.value = true;
  }

  function close(): void {
    visible.value = false;
  }

  return reactive({
    visible,
    channelId,
    channelName,
    channelBrief,
    openChannelInfo,
    close,
  }) as ChannelInfoDialogModel;
}
