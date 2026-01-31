<script setup lang="ts">
/**
 * @fileoverview ServerList.vue 文件职责说明。
 */

import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import Avatar from "/test_avatar.jpg?url";
import { createLogger } from "@/shared/utils/logger";
import { currentServerSocket, setServerSocket } from "@/features/servers/presentation/store/currentServer";
import { useServerListStore } from "@/features/servers/presentation/store/serverListStore";

import ServerContextMenu, {
    type ChannelMenuAction,
} from "../items/ServerContextMenu.vue";
import MenuButton, { type MenuButtonAction } from "../items/MenuButton.vue";
import AboutModal from "../modals/AboutModal.vue";
import ServerManagerModal from "../modals/ServerManagerModal.vue";

const logger = createLogger("ServerList");
const router = useRouter();

const { servers, upsertServer } = useServerListStore();

const sortedServers = computed(() => {
    return [...servers].sort((a, b) => {
        const pinA = a.pinned ? 0 : 1;
        const pinB = b.pinned ? 0 : 1;
        if (pinA !== pinB) return pinA - pinB;
        return a.name.localeCompare(b.name);
    });
});

interface ServerViewItem {
    socket: string;
    name: string;
    active: boolean;
    imageUrl: string;
}

const menuOpen = ref(false);
const menuPosition = ref({ x: 0, y: 0 });
const selectedServer = ref<ServerViewItem | null>(null);

/**
 * handleContextMenu 方法说明。
 * @param event - 参数说明。
 * @param item - 参数说明。
 * @returns 返回值说明。
 */
function handleContextMenu(event: MouseEvent, item: ServerViewItem) {
    event.preventDefault();
    menuPosition.value = { x: event.clientX, y: event.clientY };
    selectedServer.value = item;
    menuOpen.value = true;
}

const aboutModalOpen = ref(false);
const serverManagerOpen = ref(false);

/**
 * handleMenuBtnAction 方法说明。
 * @param action - 参数说明。
 * @returns 返回值说明。
 */
function handleMenuBtnAction(action: MenuButtonAction) {
    if (action === "about") {
        aboutModalOpen.value = true;
    } else if (action === "server_manager") {
        serverManagerOpen.value = true;
    } else if (action === "plugins") {
        void router.push("/plugins");
    } else if (action === "history") {
        logger.info("Open history (not implemented)");
    }
}

/**
 * handleMenuAction 方法说明。
 * @param action - 参数说明。
 * @returns 返回值说明。
 */
async function handleMenuAction(action: ChannelMenuAction) {
    if (!selectedServer.value) return;

    switch (action) {
        case "copyId":
            await navigator.clipboard.writeText(selectedServer.value.socket);
            break;
        case "copyName":
            await navigator.clipboard.writeText(selectedServer.value.name);
            break;
        case "pin":
            logger.info("Pin server (not implemented)", { channel: selectedServer.value.socket });
            break;
        case "settings":
            logger.info("Open server settings (not implemented)", { channel: selectedServer.value.socket });
            break;
        case "settings_recv_notify":
            logger.info("Server notify setting (not implemented)", {
                mode: "recv_notify",
                channel: selectedServer.value.socket,
            });
            break;
        case "settings_recv_silent":
            logger.info("Server notify setting (not implemented)", {
                mode: "recv_silent",
                channel: selectedServer.value.socket,
            });
            break;
        case "settings_no_recv":
            logger.info("Server notify setting (not implemented)", {
                mode: "no_recv",
                channel: selectedServer.value.socket,
            });
            break;
        case "deleteHistory":
            logger.info("Delete server history (not implemented)", { channel: selectedServer.value.socket });
            break;
    }
}

watch(
    currentServerSocket,
    (socket) => {
        if (!socket) return;
        upsertServer({ socket, name: socket });
    },
    { immediate: true },
);
</script>

<template>
    <!-- 组件：ServerList｜职责：左侧服务器列表与底部操作；交互：头像点击/右键菜单 -->
    <!-- 区块：<div> .list -->
    <div class="list">
        <!-- 区块：<div> .top-actions -->
        <div class="top-actions">
            <MenuButton @action="handleMenuBtnAction" />
        </div>

        <!-- 区块：<ul> -->
        <!-- 区块：<ul> .server_item_list -->
        <ul class="server_item_list">
            <!-- 区块：<li> -->
            <li
                v-for="item in sortedServers"
                :key="item.socket"
                :class="{ active: item.socket === currentServerSocket }"
                @click="setServerSocket(item.socket)"
                @contextmenu="(e) => handleContextMenu(e, { socket: item.socket, name: item.name, active: item.socket === currentServerSocket, imageUrl: item.avatarUrl || Avatar })"
            >
                <img class="image" :src="item.avatarUrl || Avatar" :alt="item.name" />
            </li>
        </ul>

        <ServerContextMenu
            v-model:open="menuOpen"
            :x="menuPosition.x"
            :y="menuPosition.y"
            :cid="Number(selectedServer?.socket) || undefined"
            :channel-name="selectedServer?.name ?? ''"
            @action="handleMenuAction"
        />

        <AboutModal v-model:open="aboutModalOpen" />
        <ServerManagerModal v-model:open="serverManagerOpen" />
    </div>
</template>

<style scoped lang="scss">
/* 样式：左侧固定栏（服务器胶囊列表） */
.list {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    background: transparent;
    padding: 8px 0;
    box-sizing: border-box;
    position: relative;
}

/* 样式：.top-actions */
.top-actions {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
}

/* 样式：.server_item_list */
.server_item_list {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0;
    padding: 0;
    width: 100%;
    gap: 8px;
    overflow-y: auto;
    flex: 1;
    list-style: none;

    /* 样式：li */
    li {
        position: relative;
        padding: 3px;
        border-radius: 999px;
        transition:
            background-color var(--cp-fast, 160ms) var(--cp-ease, ease),
            transform var(--cp-fast, 160ms) var(--cp-ease, ease);

        /* 样式：&:hover */
        &:hover {
            background-color: var(--cp-hover-bg);
            transform: translateY(-1px);
        }

        /* 样式：&.active */
        &.active {
            background-color: var(--cp-hover-bg-2);
            box-shadow: 0 10px 26px rgba(0, 0, 0, 0.22);

            /* 样式：&::before */
            &::before {
                content: '';
                position: absolute;
                left: -2px;
                top: 50%;
                transform: translateY(-50%);
                width: 4px;
                height: 16px;
                background: linear-gradient(180deg, var(--cp-accent), var(--cp-accent-2));
                border-radius: 99px;
                box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
            }
        }
    }
}

/* 样式：.image */
.image {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    object-fit: cover;
    display: block;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
}

</style>
