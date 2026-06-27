/**
 * @fileoverview Quick Switcher 编排：候选项构建、选择分发、v-model 适配。
 * @description chat｜presentation composable：统一快速切换入口的数据组装与动作分发。
 */

import { computed, watch, type ComputedRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { ChannelSelectionOutcome } from "@/features/chat/room-session/api-types";
import type { QuickSwitcherItem } from "@/features/chat/presentation/patchbay/state/quickSwitcherTypes";
import { createAsyncTaskRunner } from "./asyncTaskRunner";
import {
  closeQuickSwitcher,
  openQuickSwitcher,
  quickSwitcherActiveIndex,
  quickSwitcherOpen,
  quickSwitcherQuery,
} from "@/features/chat/presentation/patchbay/state/quickSwitcherStore";

type RefLike<T> = Ref<T> | ComputedRef<T>;

type ServerQuickItem = { serverSocket: string; name: string };
type ChannelQuickItem = { id: string; name: string; joined?: boolean; unread?: number };
type PluginQuickItem = { pluginId: string; name: string };

const QUICK_ROUTE_ITEMS: QuickSwitcherItem[] = [
  { kind: "route", id: "/plugins", title: "Plugin Center", subtitle: "/plugins" },
  { kind: "route", id: "/required-setup", title: "Required Setup", subtitle: "/required-setup" },
  { kind: "route", id: "/settings", title: "Settings", subtitle: "/settings" },
  { kind: "route", id: "/", title: "Login", subtitle: "/" },
];

/**
 * Quick Switcher 编排依赖。
 */
export type UseQuickSwitcherDeps = {
  serverRacks: RefLike<readonly ServerQuickItem[]>;
  allChannels: RefLike<readonly ChannelQuickItem[]>;
  plugins: RefLike<readonly PluginQuickItem[]>;
  findChannelById(channelId: string): ChannelQuickItem | undefined | null;
  onRouteSelect(path: string): void;
  onServerSelect(serverSocket: string): void;
  onChannelSelect(channelId: string): Promise<ChannelSelectionOutcome>;
  onChannelDiscoverFocus(channelName: string): void;
  onModuleSelect(pluginId: string): void;
  onAsyncError(action: string, error: unknown): void;
};

/**
 * 在已加入频道中找到首个有未读的频道。
 *
 * @param channels - 频道摘要列表（含 `unread` 字段）。
 * @returns 首个未读频道；不存在时返回 `undefined`。
 */
function findFirstUnreadChannel(
  channels: readonly ChannelQuickItem[],
): ChannelQuickItem | undefined {
  for (const c of channels) {
    if (c.joined && typeof c.unread === "number" && c.unread > 0) {
      return c;
    }
  }
  return undefined;
}

function buildQuickSwitcherItems(
  deps: UseQuickSwitcherDeps,
  t: (key: string) => string,
): QuickSwitcherItem[] {
  const normalizedQuery = quickSwitcherQuery.value.trim().toLowerCase();
  const items: QuickSwitcherItem[] = [...QUICK_ROUTE_ITEMS];

  // 「下一条未读」特殊项：仅在存在已加入且未读 > 0 的频道时显示。
  const nextUnread = findFirstUnreadChannel(deps.allChannels.value);
  if (nextUnread) {
    const unreadLabel = t("quick_switcher_next_unread");
    const subtitle = `${unreadLabel} · ${nextUnread.name} (${nextUnread.unread})`;
    items.push({ kind: "next_unread", id: nextUnread.id, title: unreadLabel, subtitle });
  }

  for (const rack of deps.serverRacks.value) {
    items.push({ kind: "server", id: rack.serverSocket, title: rack.name, subtitle: rack.serverSocket });
  }

  // 频道列表排序：已加入且未读 > 0 的频道按未读数降序置前，其余保持原序。
  const sortedChannels = [...deps.allChannels.value].sort((a, b) => {
    const aUnread = a.joined && typeof a.unread === "number" ? a.unread : 0;
    const bUnread = b.joined && typeof b.unread === "number" ? b.unread : 0;
    return bUnread - aUnread;
  });
  for (const channel of sortedChannels) {
    const suffix = channel.joined && channel.unread && channel.unread > 0 ? ` · ${channel.unread}` : "";
    items.push({ kind: "channel", id: channel.id, title: channel.name + suffix, subtitle: channel.id });
  }
  for (const plugin of deps.plugins.value) {
    items.push({ kind: "module", id: plugin.pluginId, title: plugin.name, subtitle: plugin.pluginId });
  }

  if (!normalizedQuery) return items;
  return items.filter((item) =>
    `${item.title} ${item.subtitle} ${item.id}`.toLowerCase().includes(normalizedQuery),
  );
}

/**
 * 主页面 Quick Switcher 状态与行为编排。
 *
 * 说明：
 * `QuickSwitcherItem` 抽离到独立类型文件，避免 composable 反向依赖具体 SFC。
 */
export function useQuickSwitcher(deps: UseQuickSwitcherDeps) {
  const { t } = useI18n();
  const qsItems = computed(() => buildQuickSwitcherItems(deps, t));
  const runAsyncTask = createAsyncTaskRunner(deps.onAsyncError);

  function setQuickOpen(open: boolean): void {
    quickSwitcherOpen.value = open;
  }

  function setQuickQuery(query: string): void {
    quickSwitcherQuery.value = query;
  }

  function setQuickActiveIndex(index: number): void {
    quickSwitcherActiveIndex.value = index;
  }

  /**
   * 跳转到首个未读频道（复用 `onChannelSelect` 的选择流程与错误处理）。
   */
  function jumpToFirstUnread(): void {
    const target = findFirstUnreadChannel(deps.allChannels.value);
    if (!target) return;
    runAsyncTask(
      deps.onChannelSelect(target.id).then((outcome) => {
        if (!outcome.ok) {
          deps.onAsyncError("chat_select_channel_from_quick_switcher_failed", outcome.error.message);
        }
        return outcome;
      }),
      "chat_select_channel_from_quick_switcher_failed",
    );
  }

  function handleQuickSelect(item: QuickSwitcherItem): void {
    switch (item.kind) {
      case "route":
        deps.onRouteSelect(item.id);
        break;
      case "server":
        deps.onServerSelect(item.id);
        break;
      case "module":
        deps.onModuleSelect(item.id);
        break;
      case "channel": {
        const channel = deps.findChannelById(item.id);
        // 对未加入频道走 discover 聚焦；已加入频道直接执行切换。
        if (channel && !channel.joined) {
          deps.onChannelDiscoverFocus(channel.name);
        } else {
          // 对已加入频道直接执行切换，并做好错误处理
          // 错误处理：既用 runAsyncTask 兜底异常，又主动检查业务结果，确保不会静默吞错
          runAsyncTask(
            deps.onChannelSelect(item.id).then((outcome) => {
              // 主动检查业务结果，失败时上报错误，不静默吞掉
              if (!outcome.ok) deps.onAsyncError("chat_select_channel_from_quick_switcher_failed", outcome.error.message);
              return outcome;
            }),
            "chat_select_channel_from_quick_switcher_failed",
          );
        }
        break;
      }
      case "next_unread":
        jumpToFirstUnread();
        break;
    }
    closeQuickSwitcher();
  }

  watch(
    () => quickSwitcherQuery.value,
    () => {
      quickSwitcherActiveIndex.value = 0;
    },
  );

  return {
    quickSwitcherOpen,
    quickSwitcherQuery,
    quickSwitcherActiveIndex,
    qsItems,
    setQuickOpen,
    setQuickQuery,
    setQuickActiveIndex,
    handleQuickSelect,
    openQuickSwitcher,
    closeQuickSwitcher,
  };
}
