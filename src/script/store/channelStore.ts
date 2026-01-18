import { reactive, toRef } from "vue";
import type { ChannelModelProps } from "../../components/items/ChannelModel.vue";

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
    },
    {
      cid: 2,
      imgUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka",
      channelName: "Development",
      latestMsg: "The build is failing on CI, can someone check?",
    },
    {
      cid: 3,
      imgUrl: "https://api.dicebear.com/9.x/adventurer/svg?seed=Willow",
      channelName: "Design Team",
      latestMsg: "New mockups are ready for review.",
    },
  ],
  // 当前激活的频道 ID
  activeChannelId: undefined,
});

// 导出频道存储钩子
export function useChannelStore() {
  return {
    channels: channelState.channels,
    activeChannelId: toRef(channelState, "activeChannelId"),
    setActiveChannel,
    addChannel,
    removeChannel,
    hasChannel,
    clearChannels,
  };
}

// 设置当前激活的频道
export function setActiveChannel(id: number | undefined): void {
  channelState.activeChannelId = id;
}

// 检查是否存在同名频道
export function hasChannel(channelName: string): boolean {
  const name = channelName.trim();
  if (!name) return false;
  return channelState.channels.some((item) => item.channelName === name);
}

// 添加新频道
export function addChannel(channel: ChannelModelProps): void {
  const name = channel.channelName.trim();
  if (!name) return;
  if (hasChannel(name)) return;

  channelState.channels.push({
    ...channel,
    channelName: name,
  });
}

// 移除频道
export function removeChannel(channelName: string): void {
  const index = channelState.channels.findIndex(
    (item) => item.channelName === channelName,
  );
  if (index >= 0) {
    channelState.channels.splice(index, 1);
  }
}

// 清空所有频道
export function clearChannels(): void {
  channelState.channels.splice(0, channelState.channels.length);
}
