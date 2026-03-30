/**
 * @fileoverview 频道投影刷新编排（管理子页面通用）。
 * @description chat｜presentation composable：统一“按频道 + projection”监听窗口事件并触发刷新。
 */

import { onBeforeUnmount, onMounted, type ComputedRef, type Ref } from "vue";
import {
  observeChannelProjectionChanged,
  type ChannelProjectionChangedEvent,
  type ChatChannelProjection,
} from "@/features/chat/presentation/shared/windowMessageEvents";

type ChannelIdRef = Ref<string> | ComputedRef<string>;

/**
 * 频道作用域刷新编排参数。
 */
export type UseChannelScopedRefreshArgs = {
  /**
   * 当前页面绑定的频道 id（通常来自 route query）。
   */
  channelId: ChannelIdRef;
  /**
   * 当前页面关注的变更范围（如 `members` / `applications` / `bans`）。
   */
  projection: ChatChannelProjection;
  /**
   * 刷新逻辑（支持同步或异步）。
   */
  refresh: () => void | Promise<void>;
  /**
   * 挂载时是否立即刷新一次，默认 `true`。
   */
  refreshOnMounted?: boolean;
  /**
   * 异步刷新异常回调（可选）。
   */
  onRefreshError?: (error: unknown) => void;
};

function shouldRefreshForEvent(
  detail: ChannelProjectionChangedEvent | undefined,
  expectedChannelId: string,
  expectedProjection: ChatChannelProjection,
): boolean {
  if (!detail) return false;
  if (String(detail.channelId ?? "").trim() !== expectedChannelId) return false;
  return !detail.projection || detail.projection === expectedProjection;
}

/**
 * 为频道管理子页面注册“挂载刷新 + channel projection changed 增量刷新”行为。
 *
 * @param args - 频道作用域刷新参数。
 * @returns 无返回值。
 */
export function useChannelScopedRefresh(args: UseChannelScopedRefreshArgs): void {
  const { channelId, projection, refresh, refreshOnMounted = true, onRefreshError } = args;
  let stopObserveChannelProjectionChanged: (() => void) | null = null;

  function runRefresh(): void {
    void Promise.resolve(refresh()).catch((error) => {
      onRefreshError?.(error);
    });
  }

  function handleChannelProjectionChanged(detail: ChannelProjectionChangedEvent): void {
    if (!shouldRefreshForEvent(detail, channelId.value, projection)) return;
    runRefresh();
  }

  onMounted(() => {
    if (refreshOnMounted) runRefresh();
    stopObserveChannelProjectionChanged = observeChannelProjectionChanged(handleChannelProjectionChanged);
  });

  onBeforeUnmount(() => {
    stopObserveChannelProjectionChanged?.();
    stopObserveChannelProjectionChanged = null;
  });
}
