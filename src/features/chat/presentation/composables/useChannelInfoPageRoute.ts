/**
 * @fileoverview 频道信息页路由适配。
 * @description chat｜presentation composable：统一解析频道信息页依赖的原始 route query。
 */

import { computed, type ComputedRef } from "vue";
import { useRoute } from "vue-router";

export type ChannelInfoPageRoute = {
  /**
   * 当前页面绑定的频道 id。
   */
  channelId: ComputedRef<string>;
  /**
   * query 中请求的频道名称；为空时由页面模型自行回退。
   */
  requestedChannelName: ComputedRef<string>;
  /**
   * query 中请求的频道简介；为空时由页面模型自行回退。
   */
  requestedChannelBrief: ComputedRef<string>;
};

/**
 * 解析频道信息页的原始路由上下文。
 *
 * @returns 频道信息页路由上下文。
 */
export function useChannelInfoPageRoute(): ChannelInfoPageRoute {
  const route = useRoute();

  const channelId = computed(() => String(route.query.id ?? "").trim());
  const requestedChannelName = computed(() => String(route.query.name ?? "Channel"));
  const requestedChannelBrief = computed(() => String(route.query.bio ?? route.query.description ?? ""));

  return {
    channelId,
    requestedChannelName,
    requestedChannelBrief,
  };
}
