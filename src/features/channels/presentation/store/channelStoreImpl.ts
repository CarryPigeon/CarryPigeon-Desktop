/**
 * @fileoverview channelStoreImpl.ts 文件职责说明。
 */
import { reactive, toRef } from "vue";
import type { ChannelModelProps } from "../types/ChannelModelProps";
import type { Channel } from "../../domain/entities/Channel";
import type { Member } from "../../../user/domain/entities/Member";

// 频道状态存储
const channelState = reactive<{
  channels: ChannelModelProps[];
  activeChannelId: number | undefined;
}>({
  // 默认频道列表
  channels: [
    {
      cid: 1,
      imgUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
      channelName: "General",
      latestMsg: "Hello everyone! Welcome to the general channel.",
      owner: -1,
    },
    {
      cid: 2,
      imgUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka",
      channelName: "Development",
      latestMsg: "The build is failing on CI, can someone check?",
      owner: -1,
    },
    {
      cid: 3,
      imgUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Willow",
      channelName: "Design Team",
      latestMsg: "New mockups are ready for review.",
      owner: -1,
    },
  ],
  // 当前激活的频道 ID
  activeChannelId: undefined,
});

/**
 * Exported constant.
 * @constant
 */
export const channel: Channel[] = [
  {
    cid: 1,
    channelName: "General",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=General",
    description: "Welcome to the General channel!",
    participants: [
      {
        id: 1,
        name: "Felix",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
        description: "",
      },
      {
        id: 3,
        name: "Willow",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Willow",
        description: "",
      },
    ],
  },
  {
    cid: 2,
    channelName: "Development Team",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Development",
    description: "Discussing development-related topics.",
    participants: [
      {
        id: 1,
        name: "Felix",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
        description: "",
      },
      {
        id: 2,
        name: "Ella",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Ella",
        description: "",
      },
    ],
  },
  {
    cid: 3,
    channelName: "Marketing Team",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Marketing",
    description: "Discussing marketing-related topics.",
    participants: [
      {
        id: 1,
        name: "Felix",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
        description: "",
      },
      {
        id: 3,
        name: "Willow",
        avatarUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Willow",
        description: "",
      },
    ],
  },
];

/**
 * getParticipants 方法说明。
 * @param cid - 参数说明。
 * @returns 返回值说明。
 */
export function getParticipants(cid: number): Promise<Member[]> {
  return new Promise((resolve) => {
    resolve(channel[cid - 1].participants);
  });
}

// 导出频道存储钩子
/**
 * useChannelStore 方法说明。
 * @returns 返回值说明。
 */
export function useChannelStore() {
  return {
    channels: channelState.channels,
    activeChannelId: toRef(channelState, "activeChannelId"),
    setActiveChannel,
    addChannel,
    removeChannel,
    hasChannel,
    importChannels,
    clearChannels,
  };
}

// 设置当前激活的频道
/**
 * setActiveChannel 方法说明。
 * @param id - 参数说明。
 * @returns 返回值说明。
 */
export function setActiveChannel(id: number | undefined): void {
  channelState.activeChannelId = id;
}

// 检查是否存在同名频道
/**
 * hasChannel 方法说明。
 * @param channelName - 参数说明。
 * @returns 返回值说明。
 */
export function hasChannel(channelName: string): boolean {
  const name = channelName.trim();
  if (!name) return false;
  return channelState.channels.some((item) => item.channelName === name);
}

// 添加新频道
/**
 * addChannel 方法说明。
 * @param channel - 参数说明。
 * @returns 返回值说明。
 */
export function addChannel(channel: ChannelModelProps): void {
  const name = channel.channelName.trim();
  if (!name) return;
  if (hasChannel(name)) return;

  channelState.channels.push({
    ...channel,
    channelName: name,
  });
}

/**
 * importChannels 方法说明。
 * @param channels - 参数说明。
 * @returns 返回值说明。
 */
export function importChannels(channels: ChannelModelProps[]): void {
  channelState.channels.splice(0, channelState.channels.length, ...channels);
}

// 移除频道
/**
 * removeChannel 方法说明。
 * @param channelName - 参数说明。
 * @returns 返回值说明。
 */
export function removeChannel(channelName: string): void {
  const index = channelState.channels.findIndex((item) => item.channelName === channelName);
  if (index >= 0) {
    channelState.channels.splice(index, 1);
  }
}

// 清空所有频道
/**
 * clearChannels 方法说明。
 * @returns 返回值说明。
 */
export function clearChannels(): void {
  channelState.channels.splice(0, channelState.channels.length);
}
