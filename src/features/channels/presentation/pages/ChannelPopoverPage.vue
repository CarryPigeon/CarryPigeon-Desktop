<script setup lang="ts">
/**
 * @fileoverview ChannelPopoverPage.vue 文件职责说明。
 */

import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("ChannelPopoverPage");

const route = useRoute();
// We are not passing ID currently in the openChannelPopover function, but we might in the future.
// The params passed are: avatar, name, bio.
const channelAvatar = computed(() => String(route.query.avatar ?? ""));
const channelName = computed(() => String(route.query.name ?? ""));
const channelDescription = computed(() =>
    String(route.query.bio ?? route.query.description ?? ""),
);

const cardRef = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;

/**
 * updateWindowSize 方法说明。
 * @returns 返回值说明。
 */
const updateWindowSize = async () => {
    if (!cardRef.value) return;

    // Get the exact size of the content
    // We use scrollWidth/scrollHeight or getBoundingClientRect
    // getBoundingClientRect includes border and padding which is what we want for box-sizing: border-box
    const rect = cardRef.value.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);

    try {
        // Resize the window to match the content
        await getCurrentWindow().setSize(new LogicalSize(width, height));
    } catch (error) {
        logger.error("Failed to resize channel popover window", { error: String(error) });
    }
};

onMounted(() => {
    if (cardRef.value) {
        // Initial resize
        updateWindowSize();

        // Watch for size changes (e.g. image loading, font loading)
        resizeObserver = new ResizeObserver(() => {
            updateWindowSize();
        });
        resizeObserver.observe(cardRef.value);
    }
});

onUnmounted(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
});
</script>

<template>
    <!-- 页面：ChannelPopoverPage｜职责：频道信息弹窗（Tauri 窗口）；交互：内容自适应窗口尺寸 -->
    <!-- 区块：<div> .card -->
    <div class="card" ref="cardRef">
        <!-- 区块：<div> .header -->
        <div class="header">
            <img
                v-if="channelAvatar"
                class="avatar"
                :src="channelAvatar"
                alt="Channel Avatar"
            />
            <!-- 区块：<div> .avatar -->
            <div v-else class="avatar placeholder" aria-hidden="true"></div>

            <!-- 区块：<div> .meta -->
            <div class="meta">
                <!-- 区块：<div> .name -->
                <div class="name" :title="channelName">
                    {{ channelName }}
                </div>
            </div>
        </div>

        <!-- 区块：<div> -->
        <div
            v-if="channelDescription"
            class="description"
            :title="channelDescription"
        >
            {{ channelDescription }}
        </div>
        <!-- 区块：<div> .description-muted -->
        <div v-else class="description-muted">&nbsp;</div>
    </div>
</template>

<style scoped lang="scss">
/* 样式：Popover 卡片；约束：透明背景 + 禁止滚动条（窗口尺寸随内容调整） */
:global(html),
/* 样式：:global(body) */
:global(body) {
    margin: 0;
    padding: 0;
    background: transparent;
    // Hide scrollbars since we are resizing the window to fit content
    overflow: hidden;
}

/* 样式：.card */
.card {
    // Width is controlled by the window size initially (e.g. 300px),
    // or we can force a specific width here and the window will resize to it.
    // Using 100vw means it takes the initial window width.
    width: 100vw;
    height: auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: var(--cp-panel, rgba(17, 24, 39, 0.78));
    border: 1px solid var(--cp-border);
    // Note: Border radius might show white corners if window is not transparent
    // but usually popover windows are rectangular or handle transparency.
    // Given previous styles, we keep it.
    border-radius: 18px;
    // To properly support rounded corners and shadows, the window background must be transparent
    // and this card should have margin. For now, we fit the window exactly.

    overflow: hidden;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    animation: cp-fade-up 260ms var(--cp-ease, ease) both;
}

/* 样式：.header */
.header {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
}

/* 样式：.avatar */
.avatar {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    object-fit: cover;
    background: var(--cp-hover-bg);
    border: 1px solid var(--cp-border-light);
    flex: 0 0 auto;
}

/* 样式：.avatar.placeholder */
.avatar.placeholder {
    background: var(--cp-hover-bg);
}

/* 样式：.meta */
.meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
}

/* 样式：.name */
.name {
    font-size: 14px;
    font-weight: 600;
    color: var(--cp-text);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 样式：.description */
.description {
    font-size: 12px;
    color: var(--cp-text-muted);
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    line-clamp: 3;
    /* Ensure long words don't break layout */
    word-break: break-word;
    white-space: normal;
}

/* 样式：.description-muted */
.description-muted {
    color: transparent;
}
</style>
