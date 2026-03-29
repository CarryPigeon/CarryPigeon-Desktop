/**
 * @fileoverview 治理子页面的频道 id 守卫。
 * @description chat/room-governance｜presentation composable helper：统一缺失频道 id 时的错误与状态回退策略。
 */

import type { Ref } from "vue";

const MISSING_CHANNEL_ID_MESSAGE = "Missing channel id.";

export type RequireGovernanceChannelIdArgs = {
  loading: Ref<boolean>;
  error: Ref<string>;
  onMissingChannel(): void;
};

/**
 * 读取治理页面必须存在的频道 id；缺失时统一回写页面错误态。
 *
 * @param channelId - 待校验的频道 id。
 * @param args - 错误回写与缺失态清理参数。
 * @returns 合法频道 id；缺失时返回 `null`。
 */
export function requireGovernanceChannelId(
  channelId: string,
  args: RequireGovernanceChannelIdArgs,
): string | null {
  if (channelId) return channelId;

  args.onMissingChannel();
  args.loading.value = false;
  args.error.value = MISSING_CHANNEL_ID_MESSAGE;
  return null;
}
