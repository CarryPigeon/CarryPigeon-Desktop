/**
 * @fileoverview Quick Switcher 编排：候选项构建、选择分发、v-model 适配。
 * @description chat｜presentation composable：统一快速切换入口的数据组装与动作分发。
 */

import { computed, watch, type ComputedRef, type Ref } from "vue";
import type { ChannelSelectionOutcome } from "@/features/chat/room-session/api";
import type { QuickSwitcherItem } from "@/features/chat/presentation/types/quickSwitcher";
import { createAsyncTaskRunner } from "./asyncTaskRunner";
import {
  closeQuickSwitcher,
  openQuickSwitcher,
  quickSwitcherActiveIndex,
  quickSwitcherOpen,
  quickSwitcherQuery,
} from "@/features/chat/presentation/store/quickSwitcherStore";

type RefLike<T> = Ref<T> | ComputedRef<T>;

type ServerQuickItem = { serverSocket: string; name: string };
type ChannelQuickItem = { id: string; name: string; joined?: boolean };
type PluginQuickItem = { pluginId: string; name: string };

const QUICK_ROUTE_ITEMS: QuickSwitcherItem[] = [
  { kind: "route", id: "/plugins", title: "Plugin Center", subtitle: "/plugins" },
  { kind: "route", id: "/required-setup", title: "Required Setup", subtitle: "/required-setup" },
  { kind: "route", id: "/settings", title: "Settings", subtitle: "/settings" },
  { kind: "route", id: "/", title: "Login", subtitle: "/" },
];

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

function buildQuickSwitcherItems(deps: UseQuickSwitcherDeps): QuickSwitcherItem[] {
  const normalizedQuery = quickSwitcherQuery.value.trim().toLowerCase();
  const items: QuickSwitcherItem[] = [...QUICK_ROUTE_ITEMS];

  for (const rack of deps.serverRacks.value) {
    items.push({ kind: "server", id: rack.serverSocket, title: rack.name, subtitle: rack.serverSocket });
  }
  for (const channel of deps.allChannels.value) {
    items.push({ kind: "channel", id: channel.id, title: channel.name, subtitle: channel.id });
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
  const qsItems = computed(() => buildQuickSwitcherItems(deps));
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
          runAsyncTask(
            deps.onChannelSelect(item.id).then((outcome) => {
              if (!outcome.ok) deps.onAsyncError("chat_select_channel_from_quick_switcher_failed", outcome.error.message);
              return outcome;
            }),
            "chat_select_channel_from_quick_switcher_failed",
          );
        }
        break;
      }
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
