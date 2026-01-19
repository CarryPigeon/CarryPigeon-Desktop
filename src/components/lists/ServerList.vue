<script setup lang="ts">
import { reactive, ref } from "vue";
import Avatar from "/test_avatar.jpg?url";
import { useRouter } from "vue-router";

import ServerContextMenu, {
    type ChannelMenuAction,
} from "../items/ServerContextMenu.vue";
import MenuButton, { type MenuButtonAction } from "../items/MenuButton.vue";
import AboutModal from "../modals/AboutModal.vue";

const router = useRouter();

function click_avatar() {
    router.push("/user_info");
}

interface ChannelProps {
    channel: string;
    active: boolean;
    imageUrl: string;
    onClick: () => void;
}

interface AvatarProps {
    username: string;
    imageUrl: string;
}

const avatar_props = reactive<AvatarProps>({
    username: "",
    imageUrl: "",
});
const channel_props = reactive<ChannelProps[]>([] as ChannelProps[]);

const menuOpen = ref(false);
const menuPosition = ref({ x: 0, y: 0 });
const selectedChannel = ref<ChannelProps | null>(null);

function handleContextMenu(event: MouseEvent, item: ChannelProps) {
    event.preventDefault();
    menuPosition.value = { x: event.clientX, y: event.clientY };
    selectedChannel.value = item;
    menuOpen.value = true;
}

const aboutModalOpen = ref(false);

function handleMenuBtnAction(action: MenuButtonAction) {
    if (action === "about") {
        aboutModalOpen.value = true;
    }
}

async function handleMenuAction(action: ChannelMenuAction) {
    if (!selectedChannel.value) return;

    switch (action) {
        case "copyId":
            await navigator.clipboard.writeText(selectedChannel.value.channel);
            break;
        case "copyName":
            await navigator.clipboard.writeText(selectedChannel.value.channel);
            break;
        case "pin":
            console.log("Pin channel:", selectedChannel.value.channel);
            break;
        case "settings":
            console.log("Settings for channel:", selectedChannel.value.channel);
            break;
        case "settings_recv_notify":
            console.log(
                "Settings: Receive and Notify for",
                selectedChannel.value.channel,
            );
            break;
        case "settings_recv_silent":
            console.log(
                "Settings: Receive Silent for",
                selectedChannel.value.channel,
            );
            break;
        case "settings_no_recv":
            console.log(
                "Settings: No Receive for",
                selectedChannel.value.channel,
            );
            break;
        case "deleteHistory":
            console.log(
                "Delete history for channel:",
                selectedChannel.value.channel,
            );
            break;
    }
}

function addChannel(
    channel: string,
    active: boolean,
    imageUrl: string,
    onClick: () => void,
) {
    channel_props.push({ channel, active, imageUrl, onClick });
}

function deleteChannel(channel: string) {
    const index = channel_props.findIndex((item) => item.channel === channel);
    if (index !== -1) {
        channel_props.splice(index, 1);
    }
}

function getAvatar(username: string, imageUrl: string) {
    avatar_props.username = username;
    avatar_props.imageUrl = imageUrl;
}

defineExpose({
    addChannel,
    deleteChannel,
    getAvatar,
});

addChannel("111", false, Avatar, () => {});
</script>

<template>
    <div class="list">
        <img
            class="avatar"
            :src="avatar_props.imageUrl"
            alt="avatar"
            @click="click_avatar"
        />

        <ul class="server_item_list">
            <li
                v-for="item in channel_props"
                :key="item.channel"
                @click="item.onClick"
                @contextmenu="(e) => handleContextMenu(e, item)"
            >
                <img class="image" :src="item.imageUrl" :alt="item.channel" />
            </li>
        </ul>

        <div class="bottom-actions">
            <MenuButton @action="handleMenuBtnAction" />
        </div>

        <ServerContextMenu
            v-model:open="menuOpen"
            :x="menuPosition.x"
            :y="menuPosition.y"
            :cid="Number(selectedChannel?.channel) || undefined"
            :channel-name="selectedChannel?.channel ?? ''"
            @action="handleMenuAction"
        />

        <AboutModal v-model:open="aboutModalOpen" />
    </div>
</template>

<style scoped lang="scss">
.list {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 65px;
    height: 100vh;
    background: rgba(17, 24, 39, 1);
    padding: 10px 0;
    box-sizing: border-box;
}

.avatar {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    margin-bottom: 15px;
    cursor: pointer;
    flex-shrink: 0;
}

.server_item_list {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-left: 0;
    padding-left: 0;
    margin-top: 0;
    width: 100%;
    gap: 10px;
    overflow-y: auto;
    flex: 1;
}

.image {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    cursor: pointer;
    flex-shrink: 0;
}

.bottom-actions {
    width: 100%;
    padding-top: 10px;
    border-top: 1px solid rgba(148, 163, 184, 0.18);
    display: flex;
    justify-content: center;
    background-color: transparent;
    margin-top: 10px;
    margin-right: 0;
    padding-right: 0;
    border-right: 0;
}
</style>
