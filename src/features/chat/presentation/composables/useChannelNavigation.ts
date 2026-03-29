/**
 * @fileoverview 频道导航组合式函数（基于当前频道列表推导 query 并路由跳转）。
 * @description chat｜presentation composable：聚合频道详情类页面跳转与 query 构造。
 * 将 MainPage 中与“频道详情类页面跳转”相关的逻辑集中在一起，减少页面文件体积，
 * 同时避免多个入口重复构造 query 参数。
 */

import type { ComputedRef, Ref } from "vue";
import { useRouter } from "vue-router";
import type { ChatChannel } from "@/features/chat/room-session/contracts";

type RefLike<T> = Ref<T> | ComputedRef<T>;
type ChannelListItem = ChatChannel;
type ChannelRouteQuery = Record<string, string | undefined>;

export type UseChannelNavigationDeps = {
  /**
   * 当前可见的全量频道列表。
   *
   * 说明：
   * 由调用方显式注入，避免 composable 直接依赖全局 chat store。
   */
  allChannels: RefLike<readonly ChannelListItem[]>;
};

/**
 * 频道导航能力集合。
 */
export type ChannelNavigation = {
  /**
   * 按 id 查找频道（用于构造 UI 或路由 query）。
   */
  findChannelById(channelId: string): ChannelListItem | null;
  /**
   * 打开频道信息预览页（轻量只读）。
   */
  openChannelInfo(channelId: string): void;
  /**
   * 打开频道成员管理页。
   */
  openChannelMembers(channelId: string): void;
  /**
   * 打开入群申请管理页。
   */
  openJoinApplications(channelId: string): void;
  /**
   * 打开封禁管理页。
   */
  openChannelBans(channelId: string): void;
};

/**
 * 创建频道导航工具。
 *
 * @param deps - 频道数据依赖。
 * @returns 频道导航能力集合。
 */
export function useChannelNavigation(deps: UseChannelNavigationDeps): ChannelNavigation {
  const router = useRouter();

  /**
   * 按 id 从展示层 store 中查找频道。
   *
   * @param channelId - 频道 id。
   * @returns 找到则返回频道；否则返回 `null`。
   */
  function findChannelById(channelId: string): ChannelListItem | null {
    const list = deps.allChannels.value;
    for (const item of list) {
      if (item.id === channelId) return item;
    }
    return null;
  }

  /**
   * 基于频道 id 构造 query 并执行路由跳转。
   *
   * @param channelId - 频道 id。
   * @param path - 目标路由路径。
   * @param createQuery - query 构造函数。
   */
  function openChannelRoute(
    channelId: string,
    path: string,
    createQuery: (channel: ChannelListItem) => ChannelRouteQuery,
  ): void {
    const channel = findChannelById(channelId);
    if (!channel) return;
    void router.push({
      path,
      query: createQuery(channel),
    });
  }

  /**
   * 打开频道信息预览页（轻量只读）。
   *
   * 说明：该预览页通过 query 参数传递频道信息（用于快速查看，不依赖额外拉取）。
   *
   * @param channelId - 频道 id。
   * @returns 无返回值。
   */
  function openChannelInfo(channelId: string): void {
    openChannelRoute(channelId, "/channel-info", (channel) => ({
      id: channel.id,
      name: channel.name,
      bio: channel.brief,
    }));
  }

  /**
   * 生成“基础频道 query”。
   *
   * @param channel - 频道对象。
   * @returns 仅包含 `id/name` 的 query。
   */
  function buildBaseChannelQuery(channel: ChannelListItem): ChannelRouteQuery {
    return {
      id: channel.id,
      name: channel.name,
    };
  }

  /**
   * 打开频道成员管理页。
   *
   * @param channelId - 频道 id。
   * @returns 无返回值。
   */
  function openChannelMembers(channelId: string): void {
    openChannelRoute(channelId, "/channel-members", buildBaseChannelQuery);
  }

  /**
   * 打开入群申请管理页。
   *
   * @param channelId - 频道 id。
   * @returns 无返回值。
   */
  function openJoinApplications(channelId: string): void {
    openChannelRoute(channelId, "/channel-applications", buildBaseChannelQuery);
  }

  /**
   * 打开封禁管理页。
   *
   * @param channelId - 频道 id。
   * @returns 无返回值。
   */
  function openChannelBans(channelId: string): void {
    openChannelRoute(channelId, "/channel-bans", buildBaseChannelQuery);
  }

  return {
    findChannelById,
    openChannelInfo,
    openChannelMembers,
    openJoinApplications,
    openChannelBans,
  };
}
