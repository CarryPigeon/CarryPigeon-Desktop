import { reactive } from "vue";
import type { ChannelModelProps } from "../../components/items/ChannelModel.vue";

const channelState = reactive<{ channels: ChannelModelProps[] }>({
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
    }
  ],
});

export function useChannelStore() {
  return {
    channels: channelState.channels,
    addChannel,
    removeChannel,
    hasChannel,
    clearChannels,
  };
}

export function hasChannel(channelName: string): boolean {
  const name = channelName.trim();
  if (!name) return false;
  return channelState.channels.some((item) => item.channelName === name);
}

export function addChannel(channel: ChannelModelProps): void {
  const name = channel.channelName.trim();
  if (!name) return;
  if (hasChannel(name)) return;

  channelState.channels.push({
    ...channel,
    channelName: name,
  });
}

export function removeChannel(channelName: string): void {
  const index = channelState.channels.findIndex((item) => item.channelName === channelName);
  if (index >= 0) {
    channelState.channels.splice(index, 1);
  }
}

export function clearChannels(): void {
  channelState.channels.splice(0, channelState.channels.length);
}
