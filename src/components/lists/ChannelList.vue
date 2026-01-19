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

// 频道列表初始宽度
const channelListWidth = ref(255);
// 是否正在调整大小
const isResizingWidth = ref(false);

/**
 * 开始调整频道列表宽度
 * @param e 鼠标事件
 */
const startResizeWidth = (e: MouseEvent) => {
  isResizingWidth.value = true;
  document.addEventListener('mousemove', handleResizeWidth);
  document.addEventListener('mouseup', stopResizeWidth);
  e.preventDefault();
};

/**
 * 处理鼠标移动，实时更新宽度
 * @param e 鼠标事件
 */
const handleResizeWidth = (e: MouseEvent) => {
  if (!isResizingWidth.value) return;
  
  // 计算新的宽度：鼠标 X 坐标减去左侧 ServerList 的固定宽度（63px）
  const newWidth = e.clientX - 63;
  
  // 限制频道列表的最小宽度（160px）和最大宽度（400px）
  if (newWidth >= 160 && newWidth <= 400) {
    channelListWidth.value = newWidth;
    // 更新全局 CSS 变量，以便 ChatBox 和 SearchBar 同步调整其左边距
    document.documentElement.style.setProperty('--channel-list-width', `${newWidth}px`);
  }
};

/**
 * 停止调整大小，移除事件监听
 */
const stopResizeWidth = () => {
  isResizingWidth.value = false;
  document.removeEventListener('mousemove', handleResizeWidth);
  document.removeEventListener('mouseup', stopResizeWidth);
};

// 处理频道点击事件：激活选中频道
function handleChannelClick(channel: ChannelModelProps) {
    setActiveChannel(channel.cid);
}

import { onMounted } from 'vue';

onMounted(() => {
  // 初始化全局宽度变量
  document.documentElement.style.setProperty('--channel-list-width', `${channelListWidth.value}px`);
});

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
    <div class="channelList" :style="{ width: channelListWidth + 'px' }">
        <!-- 宽度调节手柄 -->
        <div class="resizer-h" @mousedown="startResizeWidth"></div>
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
    left: 65px;
    top: 60px;
    height: calc(100vh - 120px);
    opacity: 1;
    background: rgba(243, 244, 246, 1);
    border: 1px solid rgba(231, 232, 236, 1);
    overflow-y: auto;
    display: flex;
    flex-direction: row-reverse; // 让 resizer 在右侧
}

// 垂直方向调节宽度的手柄
.resizer-h {
    width: 4px;
    height: 100%;
    cursor: ew-resize; // 显示左右调节的光标
    background: transparent;
    transition: background 0.2s;
    flex-shrink: 0;
    
    &:hover {
        background: rgba(0, 0, 0, 0.1);
    }
}

.list {
    list-style-type: none;
    padding: 0;
    margin: 0;
    flex: 1;
    overflow-y: auto;
}
</style>
