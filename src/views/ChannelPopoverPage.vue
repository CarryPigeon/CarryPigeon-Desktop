<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";

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
        console.error("Failed to resize channel popover window:", error);
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
    <div class="card" ref="cardRef">
        <div class="header">
            <img
                v-if="channelAvatar"
                class="avatar"
                :src="channelAvatar"
                alt="Channel Avatar"
            />
            <div v-else class="avatar placeholder" aria-hidden="true"></div>

            <div class="meta">
                <div class="name" :title="channelName">
                    {{ channelName }}
                </div>
            </div>
        </div>

        <div
            v-if="channelDescription"
            class="description"
            :title="channelDescription"
        >
            {{ channelDescription }}
        </div>
        <div v-else class="description-muted">&nbsp;</div>
    </div>
</template>

<style scoped lang="scss">
:global(html),
:global(body) {
    margin: 0;
    padding: 0;
    background: transparent;
    // Hide scrollbars since we are resizing the window to fit content
    overflow: hidden;
}

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
    background: rgba(255, 255, 255, 1);
    // Note: Border radius might show white corners if window is not transparent
    // but usually popover windows are rectangular or handle transparency.
    // Given previous styles, we keep it.
    border-radius: 0;
    // To properly support rounded corners and shadows, the window background must be transparent
    // and this card should have margin. For now, we fit the window exactly.

    overflow: hidden;
}

.header {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
}

.avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    background: #e5e7eb;
    flex: 0 0 auto;
}

.avatar.placeholder {
    background: #e5e7eb;
}

.meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
}

.name {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.description {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    line-clamp: 3;
    /* Ensure long words don't break layout */
    word-break: break-word;
    white-space: normal;
}

.description-muted {
    color: transparent;
}
</style>
