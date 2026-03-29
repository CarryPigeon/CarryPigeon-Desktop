/**
 * @fileoverview 频道治理页面通用路由适配。
 * @description chat/room-governance｜presentation composable：统一解析治理子页面依赖的原始频道 query。
 */

import { computed, type ComputedRef } from "vue";
import { useRoute } from "vue-router";

export type GovernanceChannelPageRoute = {
  /**
   * 当前治理页面绑定的频道 id。
   */
  channelId: ComputedRef<string>;
  /**
   * query 中请求的频道名称；为空时由页面自行决定回退标题。
   */
  requestedChannelName: ComputedRef<string>;
};

/**
 * 解析治理子页面的基础频道路由上下文。
 *
 * @returns 页面路由上下文。
 */
export function useGovernanceChannelPageRoute(): GovernanceChannelPageRoute {
  const route = useRoute();

  const channelId = computed(() => String(route.query.id ?? "").trim());
  const requestedChannelName = computed(() => String(route.query.name ?? "").trim());

  return {
    channelId,
    requestedChannelName,
  };
}
