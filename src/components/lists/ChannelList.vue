<script setup lang="ts">
import { ref } from "vue";
import ChannelModel, {
    type ChannelModelProps,
} from "../items/ChannelModel.vue";
import ChannelContextMenu, {
    type ChannelMenuAction,
} from "../items/ChannelContextMenu.vue";
import { useChannelStore } from "../../script/store/channelStore";

// 从 store 中获取频道列表和当前激活的频道状态
const { channels, activeChannelId, setActiveChannel } = useChannelStore();

// 右键菜单状态
const menuOpen = ref(false);
const menuPosition = ref({ x: 0, y: 0 });
const selectedChannel = ref<ChannelModelProps | null>(null);

// 处理频道点击事件：激活选中频道
function handleChannelClick(channel: ChannelModelProps) {
    setActiveChannel(channel.cid);
}

// 处理右键点击事件：显示上下文菜单
function handleContextMenu(event: MouseEvent, channel: ChannelModelProps) {
    event.preventDefault();
    menuPosition.value = { x: event.clientX, y: event.clientY };
    selectedChannel.value = channel;
    menuOpen.value = true;
}

// 处理菜单动作
async function handleMenuAction(action: ChannelMenuAction) {
    if (!selectedChannel.value) return;

    switch (action) {
        case "copyId":
            if (selectedChannel.value.cid) {
                await navigator.clipboard.writeText(
                    selectedChannel.value.cid.toString(),
                );
            }
            break;
        case "copyName":
            await navigator.clipboard.writeText(
                selectedChannel.value.channelName,
            );
            break;
        case "pin":
            // TODO: Implement pin logic
            console.log("Pin channel:", selectedChannel.value.channelName);
            break;
        case "settings":
            // TODO: Implement settings logic
            console.log(
                "Settings for channel:",
                selectedChannel.value.channelName,
            );
            break;
        case "settings_recv_notify":
            console.log(
                "Settings: Receive and Notify for",
                selectedChannel.value.channelName,
            );
            break;
        case "settings_recv_silent":
            console.log(
                "Settings: Receive Silent for",
                selectedChannel.value.channelName,
            );
            break;
        case "settings_no_recv":
            console.log(
                "Settings: No Receive for",
                selectedChannel.value.channelName,
            );
            break;
        case "deleteHistory":
            // TODO: Implement delete history logic
            console.log(
                "Delete history for channel:",
                selectedChannel.value.channelName,
            );
            break;
    }
}
</script>

<template>
    <div class="channelList">
        <ul class="list">
            <li v-for="item in channels" :key="item.channelName">
                <ChannelModel
                    v-bind="item"
                    :active="item.cid === activeChannelId"
                    @model-click="handleChannelClick(item)"
                    @contextmenu="(e: MouseEvent) => handleContextMenu(e, item)"
                />
            </li>
        </ul>

        <ChannelContextMenu
            v-model:open="menuOpen"
            :x="menuPosition.x"
            :y="menuPosition.y"
            :cid="selectedChannel?.cid"
            :channel-name="selectedChannel?.channelName ?? ''"
            @action="handleMenuAction"
        />
    </div>
</template>

<style scoped lang="scss">
.channelList {
    position: absolute;
    left: 63px;
    top: 60px;
    width: 255px;
    height: calc(100vh - 120px);
    opacity: 1;
    background: rgba(243, 244, 246, 1);
    border: 1px solid rgba(231, 232, 236, 1);
    overflow-y: auto;
}

.list {
    list-style-type: none;
    padding: 0;
    margin: 0;
}
</style>
