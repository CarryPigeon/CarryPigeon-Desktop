<script setup lang="ts">
/**
 * @fileoverview ChannelList.vue 文件职责说明。
 */

import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { MessagePlugin } from "tdesign-vue-next";
import { USE_MOCK_API } from "@/shared/config/runtime";
import ChannelModel from "../items/ChannelModel.vue";
import ChannelContextMenu, {
    type ChannelMenuAction,
} from "../items/ChannelContextMenu.vue";
import { useChannelStore } from "../../store/channelStore";
import { createLogger } from "@/shared/utils/logger";
import ServerInfoCard from "@/features/servers/presentation/components/cards/ServerInfoCard.vue";
import ServerInfoModal from "@/features/servers/presentation/components/modals/ServerInfoModal.vue";
import { getOpenInfoWindowUsecase } from "@/features/windows/di/windows.di";
import { createChannelApplicationService } from "@/features/channels/data/channelServiceFactory";
import { mockSearchChannels } from "@/features/channels/mock/channelMockService";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import type { ChannelModelProps } from "../../types/ChannelModelProps";

const { t } = useI18n();

// 从 store 中获取频道列表和当前激活的频道状态
const { channels, activeChannelId, setActiveChannel, addChannel } = useChannelStore();
const logger = createLogger("ChannelList");

const emit = defineEmits<{
    (e: "channel-click", cid: number): void;
}>();

// 右键菜单状态
const menuOpen = ref(false);
const menuPosition = ref({ x: 0, y: 0 });
const selectedChannel = ref<ChannelModelProps | null>(null);

// 频道列表初始宽度
const channelListWidth = ref(240);
// 是否正在调整大小
const isResizingWidth = ref(false);
const listRef = ref<HTMLElement | null>(null);

// 搜索逻辑
const searchQuery = ref("");
const normalizedQuery = computed(() => searchQuery.value.trim());

const localMatches = computed(() => {
    const query = normalizedQuery.value.toLowerCase();
    if (!query) return [];
    return channels.filter((item) => {
        const name = item.channelName.toLowerCase();
        const id = item.cid ? String(item.cid) : "";
        return name.includes(query) || (id && id.includes(query));
    });
});

type RemoteChannel = {
    cid: number;
    name: string;
    brief?: string;
    avatar?: string;
    owner?: number;
};

const remoteMatches = ref<RemoteChannel[]>([]);
const remoteLoading = ref(false);
const remoteError = ref<string | null>(null);

watch(normalizedQuery, (value) => {
    if (!value) {
        remoteMatches.value = [];
        remoteLoading.value = false;
        remoteError.value = null;
        return;
    }

    if (USE_MOCK_API) {
        const socket = currentServerSocket.value || "mock://handshake";
        const joined = new Set(channels.map((item) => item.cid).filter(Boolean));
        remoteMatches.value = mockSearchChannels(socket, value)
            .filter((item) => !joined.has(item.cid))
            .map((item) => ({
                cid: item.cid,
                name: item.name,
                brief: item.brief,
                owner: item.owner,
                avatar: `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(item.name)}`,
            }));
        remoteLoading.value = false;
        remoteError.value = null;
        return;
    }

    // TODO: 接入服务端搜索接口（未加入频道）
    remoteLoading.value = false;
    remoteError.value = null;
    remoteMatches.value = [];
});

// 弹出服务器信息弹窗
const serverInfoOpen = ref(false);

/**
 * 开始调整频道列表宽度
 * @param e 鼠标事件
 */
/**
 * startResizeWidth 方法说明。
 * @param e - 参数说明。
 * @returns 返回值说明。
 */
const startResizeWidth = (e: MouseEvent) => {
    isResizingWidth.value = true;
    document.addEventListener("mousemove", handleResizeWidth);
    document.addEventListener("mouseup", stopResizeWidth);
    e.preventDefault();
};

/**
 * 处理鼠标移动，实时更新宽度
 * @param e 鼠标事件
 */
/**
 * handleResizeWidth 方法说明。
 * @param e - 参数说明。
 * @returns 返回值说明。
 */
const handleResizeWidth = (e: MouseEvent) => {
    if (!isResizingWidth.value) return;

    // 计算新的宽度：鼠标 X 坐标减去当前容器左侧
    const rect = listRef.value?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const newWidth = e.clientX - left;

    // 限制频道列表的最小宽度（160px）和最大宽度（400px）
    if (newWidth >= 160 && newWidth <= 400) {
        channelListWidth.value = newWidth;
        // 更新全局 CSS 变量，以便 ChatBox 和 SearchBar 同步调整其左边距
        document.documentElement.style.setProperty(
            "--channel-list-width",
            `${newWidth}px`,
        );
    }
};

/**
 * 停止调整大小，移除事件监听
 */
/**
 * stopResizeWidth 方法说明。
 * @returns 返回值说明。
 */
const stopResizeWidth = () => {
    isResizingWidth.value = false;
    document.removeEventListener("mousemove", handleResizeWidth);
    document.removeEventListener("mouseup", stopResizeWidth);
};

// 处理频道点击事件：激活选中频道
/**
 * handleChannelClick 方法说明。
 * @param channel - 参数说明。
 * @returns 返回值说明。
 */
function handleChannelClick(channel: ChannelModelProps) {
    setActiveChannel(channel.cid);
    if (channel.cid !== undefined) {
        emit("channel-click", channel.cid);
    }
}

onMounted(() => {
    // 初始化全局宽度变量
    document.documentElement.style.setProperty(
        "--channel-list-width",
        `${channelListWidth.value}px`,
    );
});

// 处理右键点击事件：显示上下文菜单
/**
 * handleContextMenu 方法说明。
 * @param event - 参数说明。
 * @param channel - 参数说明。
 * @returns 返回值说明。
 */
function handleContextMenu(event: MouseEvent, channel: ChannelModelProps) {
    event.preventDefault();
    menuPosition.value = { x: event.clientX, y: event.clientY };
    selectedChannel.value = channel;
    menuOpen.value = true;
}

/**
 * openChannelInfo 方法说明。
 * @param channel - 参数说明。
 * @returns 返回值说明。
 */
function openChannelInfo(channel: ChannelModelProps) {
    const query = new URLSearchParams({
        window: "channel-info",
        avatar: channel.imgUrl ?? "",
        name: channel.channelName ?? "",
        bio: channel.bio ?? "",
        owner: String(channel.owner ?? ""),
    }).toString();

    void getOpenInfoWindowUsecase().execute({
        label: "channel-info",
        title: channel.channelName || t("channel_info"),
        query,
        width: 420,
        height: 360,
    });
}

// 处理菜单动作
/**
 * handleMenuAction 方法说明。
 * @param action - 参数说明。
 * @returns 返回值说明。
 */
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
        case "info":
            openChannelInfo(selectedChannel.value);
            break;
        case "pin":
            // TODO: Implement pin logic
            logger.info("Pin channel (not implemented)", { channelName: selectedChannel.value.channelName, cid: selectedChannel.value.cid });
            break;
        case "settings":
            // TODO: Implement settings logic
            logger.info("Open channel settings (not implemented)", { channelName: selectedChannel.value.channelName, cid: selectedChannel.value.cid });
            break;
        case "settings_recv_notify":
            logger.info("Channel notify setting (not implemented)", { mode: "recv_notify", channelName: selectedChannel.value.channelName, cid: selectedChannel.value.cid });
            break;
        case "settings_recv_silent":
            logger.info("Channel notify setting (not implemented)", { mode: "recv_silent", channelName: selectedChannel.value.channelName, cid: selectedChannel.value.cid });
            break;
        case "settings_no_recv":
            logger.info("Channel notify setting (not implemented)", { mode: "no_recv", channelName: selectedChannel.value.channelName, cid: selectedChannel.value.cid });
            break;
        case "deleteHistory":
            // TODO: Implement delete history logic
            logger.info("Delete channel history (not implemented)", { channelName: selectedChannel.value.channelName, cid: selectedChannel.value.cid });
            break;
    }
}

/**
 * requestJoinChannel 方法说明。
 * @param channel - 参数说明。
 * @returns 返回值说明。
 */
async function requestJoinChannel(channel: RemoteChannel) {
    const socket = currentServerSocket.value;
    if (!socket) {
        MessagePlugin.error(t("server_not_connected"));
        return;
    }

    try {
        const service = createChannelApplicationService(socket);
        await service.applyChannel(channel.cid);
        if (USE_MOCK_API) {
            const avatarUrl = channel.avatar
                ? channel.avatar
                : `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(channel.name)}`;
            addChannel({
                cid: channel.cid,
                channelName: channel.name,
                imgUrl: avatarUrl,
                latestMsg: channel.brief || "",
                bio: channel.brief,
                owner: channel.owner,
            });
        }
        MessagePlugin.success(t("channel_join_request_sent"));
    } catch (e) {
        logger.error("Join channel failed", { error: String(e) });
        MessagePlugin.error(t("channel_join_request_failed"));
    }
}
</script>

<template>
    <!-- 组件：频道列表｜职责：展示频道列表；支持拖拽调宽与右键菜单 -->
    <!-- 区块：<div> .channelList -->
    <div ref="listRef" class="channelList">
        <!-- 宽度调节手柄 -->
        <!-- 区块：<div> .resizer-h -->
        <div class="resizer-h" @mousedown="startResizeWidth"></div>
        <!-- 区块：<div> .content -->
        <div class="content">
            <ServerInfoCard @open-info="serverInfoOpen = true" />

            <!-- 区块：<div> .search-panel -->
            <div class="search-panel">
                <!-- 区块：<div> .search-input -->
                <div class="search-input">
                    <span class="search-plus">+</span>
                    <input
                        v-model="searchQuery"
                        class="search-input-field"
                        :placeholder="$t('channel_search_placeholder')"
                    />
                </div>
            </div>

            <!-- 区块：<div> .list-scroll -->
            <div class="list-scroll">
                <template v-if="normalizedQuery">
                    <!-- 区块：<div> .search-section -->
                    <div class="search-section">
                        <!-- 区块：<div> .section-title -->
                        <div class="section-title">{{ $t('channels_joined') }}</div>
                        <!-- 区块：<ul> -->
                        <!-- 区块：<ul> .list -->
                        <ul v-if="localMatches.length" class="list">
                            <!-- 区块：<li> -->
                            <li v-for="item in localMatches" :key="item.channelName">
                                <ChannelModel
                                    v-bind="item"
                                    :active="item.cid === activeChannelId"
                                    @model-click="handleChannelClick(item)"
                                    @contextmenu="(e: MouseEvent) => handleContextMenu(e, item)"
                                />
                            </li>
                        </ul>
                        <!-- 区块：<div> .empty-tip -->
                        <div v-else class="empty-tip">{{ $t('channels_joined_empty') }}</div>
                    </div>

                    <!-- 区块：<div> .search-section -->
                    <div class="search-section">
                        <!-- 区块：<div> .section-title -->
                        <div class="section-title">{{ $t('channels_discover') }}</div>
                        <!-- 区块：<div> .empty-tip -->
                        <div v-if="remoteLoading" class="empty-tip">{{ $t('loading') }}</div>
                        <!-- 区块：<div> .empty-tip -->
                        <div v-else-if="remoteError" class="empty-tip">{{ remoteError }}</div>
                        <!-- 区块：<ul> -->
                        <!-- 区块：<ul> .discover-list -->
                        <ul v-else-if="remoteMatches.length" class="discover-list">
                            <!-- 区块：<li> -->
                            <!-- 区块：<li> .discover-item -->
                            <li v-for="item in remoteMatches" :key="item.cid" class="discover-item">
                                <img
                                    class="discover-avatar"
                                    :src="item.avatar || ''"
                                    alt=""
                                />
                                <!-- 区块：<div> .discover-meta -->
                                <div class="discover-meta">
                                    <!-- 区块：<div> .discover-name -->
                                    <div class="discover-name">{{ item.name }}</div>
                                    <!-- 区块：<div> .discover-brief -->
                                    <div class="discover-brief">{{ item.brief || '' }}</div>
                                </div>
                                <!-- 区块：<button> -->
                                <button class="join-btn" type="button" @click="requestJoinChannel(item)">
                                    {{ $t('apply_join') }}
                                </button>
                            </li>
                        </ul>
                        <!-- 区块：<div> .empty-tip -->
                        <div v-else class="empty-tip">{{ $t('channels_discover_empty') }}</div>
                    </div>
                </template>

                <template v-else>
                    <!-- 区块：<ul> -->
                    <ul class="list">
                        <!-- 区块：<li> -->
                        <li v-for="item in channels" :key="item.channelName">
                            <ChannelModel
                                v-bind="item"
                                :active="item.cid === activeChannelId"
                                @model-click="handleChannelClick(item)"
                                @contextmenu="(e: MouseEvent) => handleContextMenu(e, item)"
                            />
                        </li>
                    </ul>
                </template>
            </div>
        </div>

        <ChannelContextMenu
            v-model:open="menuOpen"
            :x="menuPosition.x"
            :y="menuPosition.y"
            :cid="selectedChannel?.cid"
            :channel-name="selectedChannel?.channelName ?? ''"
            @action="handleMenuAction"
        />

        <ServerInfoModal v-model:open="serverInfoOpen" />
    </div>
</template>

<style scoped lang="scss">
/* 样式：频道列表容器与宽度调节手柄 */
.channelList {
    position: relative;
    flex: 1;
    min-height: 0;
    background: transparent;
    overflow: hidden;
    display: flex;
    flex-direction: row-reverse;
}

/* 样式：.content */
.content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: transparent;
}

/* 样式：.resizer-h */
.resizer-h {
    width: 4px;
    height: 100%;
    cursor: ew-resize;
    background: transparent;
    transition: background-color 0.15s ease;
    flex-shrink: 0;

    /* 样式：&:hover */
    &:hover {
        background-color: var(--cp-hover-bg-2);
    }
}

/* 样式：.search-panel */
.search-panel {
    padding: 12px 12px 12px;
    border-bottom: 1px solid var(--cp-border-light, #f0f0f0);
    background: transparent;
}

/* 样式：.search-input */
.search-input {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--cp-field-border);
    border-radius: var(--cp-radius, 14px);
    padding: 6px 10px;
    background: var(--cp-field-bg);
    transition:
        border-color var(--cp-fast, 160ms) var(--cp-ease, ease),
        box-shadow var(--cp-fast, 160ms) var(--cp-ease, ease),
        background-color var(--cp-fast, 160ms) var(--cp-ease, ease);

    /* 样式：&:focus-within */
    &:focus-within {
        border-color: var(--cp-accent);
        box-shadow: var(--cp-ring);
    }

    &:hover {
        border-color: var(--cp-field-border-hover);
        background: var(--cp-field-bg-hover);
    }
}

/* 样式：.search-plus */
.search-plus {
    width: 20px;
    height: 20px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    font-weight: 600;
    font-size: 14px;
    color: var(--cp-text, #1a1a1a);
    background: var(--cp-panel-muted);
    border: 1px solid var(--cp-border-light);
}

/* 样式：.search-input-field */
.search-input-field {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 13px;
    color: var(--cp-text, #1a1a1a);
    height: 26px;
    line-height: 26px;
    caret-color: var(--cp-accent);

    /* 样式：&::placeholder */
    &::placeholder {
        color: var(--cp-field-placeholder);
    }
}

/* 样式：.list-scroll */
.list-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
}

/* 样式：.list */
.list {
    list-style-type: none;
    padding: 4px 0;
    margin: 0;
    flex: 1;
}

/* 样式：.search-section */
.search-section {
    padding: 8px 12px 0;
}

/* 样式：.section-title */
.section-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--cp-text-muted, #737373);
    margin-bottom: 6px;
}

/* 样式：.empty-tip */
.empty-tip {
    font-size: 13px;
    color: var(--cp-text-light, #a3a3a3);
    padding: 8px 4px 12px;
}

/* 样式：.discover-list */
.discover-list {
    list-style: none;
    margin: 0;
    padding: 0 0 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* 样式：.discover-item */
.discover-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px;
    border-radius: var(--cp-radius, 14px);
    background: var(--cp-panel-muted);
    border: 1px solid var(--cp-border-light);
}

/* 样式：.discover-avatar */
.discover-avatar {
    width: 36px;
    height: 36px;
    border-radius: 14px;
    object-fit: cover;
    background: rgba(20, 32, 29, 0.08);
}

/* 样式：.discover-meta */
.discover-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

/* 样式：.discover-name */
.discover-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--cp-text, #1a1a1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 样式：.discover-brief */
.discover-brief {
    font-size: 12px;
    color: var(--cp-text-muted, #737373);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 样式：.join-btn */
.join-btn {
    border: none;
    background: linear-gradient(180deg, var(--cp-accent), var(--cp-accent-hover));
    color: #ffffff;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 12px 26px var(--cp-accent-shadow);

    /* 样式：&:hover */
    &:hover {
        background: linear-gradient(180deg, var(--cp-accent-hover), var(--cp-accent));
    }
}
</style>
