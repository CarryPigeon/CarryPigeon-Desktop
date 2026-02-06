/**
 * @fileoverview 频道导航组合式函数（基于当前频道列表推导 query 并路由跳转）。
 * @description chat｜模块：useChannelNavigation。
 * 将 MainPage 中与“频道详情类页面跳转”相关的逻辑集中在一起，减少页面文件体积，
 * 同时避免多个入口重复构造 query 参数。
 */

import { useRouter } from "vue-router";
import { allChannels } from "@/features/chat/presentation/store/chatStore";

type ChannelListItem = (typeof allChannels.value)[number];

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
 * @returns 频道导航能力集合。
 */
export function useChannelNavigation(): ChannelNavigation {
  const router = useRouter();

  /**
   * 按 id 从展示层 store 中查找频道。
   *
   * @param channelId - 频道 id。
   * @returns 找到则返回频道；否则返回 `null`。
   */
  function findChannelById(channelId: string): ChannelListItem | null {
    const list = allChannels.value;
    for (const item of list) {
      if (item.id === channelId) return item;
    }
    return null;
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
    const ch = findChannelById(channelId);
    if (!ch) return;
    void router.push({
      path: "/channel-info",
      query: {
        id: ch.id,
        name: ch.name,
        bio: ch.brief,
      },
    });
  }

  /**
   * 打开频道成员管理页。
   *
   * @param channelId - 频道 id。
   * @returns 无返回值。
   */
  function openChannelMembers(channelId: string): void {
    const ch = findChannelById(channelId);
    if (!ch) return;
    void router.push({
      path: "/channel-members",
      query: { id: ch.id, name: ch.name },
    });
  }

  /**
   * 打开入群申请管理页。
   *
   * @param channelId - 频道 id。
   * @returns 无返回值。
   */
  function openJoinApplications(channelId: string): void {
    const ch = findChannelById(channelId);
    if (!ch) return;
    void router.push({
      path: "/channel-applications",
      query: { id: ch.id, name: ch.name },
    });
  }

  /**
   * 打开封禁管理页。
   *
   * @param channelId - 频道 id。
   * @returns 无返回值。
   */
  function openChannelBans(channelId: string): void {
    const ch = findChannelById(channelId);
    if (!ch) return;
    void router.push({
      path: "/channel-bans",
      query: { id: ch.id, name: ch.name },
    });
  }

  return { findChannelById, openChannelInfo, openChannelMembers, openJoinApplications, openChannelBans };
}
