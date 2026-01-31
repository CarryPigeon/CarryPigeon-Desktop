<script lang="ts">
/**
 * @fileoverview MessageBubbleComponents.vue 文件职责说明。
 */

import { defineComponent, computed } from 'vue';
import MemberMessageBubble from './MemberMessageBubble.vue';
import UserMessageBubble from './UserMessageBubble.vue';
import type { Message } from './messageTypes';
import { useIgnoreStore } from '../../store/ignoreStore';
import { addMessage, importMessage, messageList } from '../../store/messageList';
import { dayKey, formatDayLabel, formatTimeLabel, resolveTimestamp } from './messageFormat';

export { addMessage, importMessage };

const isMemberMessage = (message: Message, user_id: number): boolean => {
    const payload = message as unknown as Record<string, unknown>;
    const role = (payload.from_id ?? payload.user_id) as number;
    return role !== user_id;
};

type RenderItem =
    | { kind: 'day'; key: string; label: string }
    | {
          kind: 'message';
          key: string;
          message: Message;
          incoming: boolean;
          showMeta: boolean;
          showAvatar: boolean;
          compact: boolean;
          timeLabel: string;
      };

export default defineComponent({
    name: 'MessageBubbleComponents',
    emits: ['avatar-contextmenu'],
    props: {
        user_id: { type: Number, required: true },
    },
    components: {
        MemberMessageBubble,
        UserMessageBubble,
    },
    setup(props) {
        const { ignoredUserIds } = useIgnoreStore();
        const orderedMessages = computed(() =>
            [...messageList.value]
                .filter((message) => !ignoredUserIds.includes(message.from_id))
                .sort((a, b) => resolveTimestamp(a) - resolveTimestamp(b))
        );

        const renderItems = computed<RenderItem[]>(() => {
            const userId = props.user_id ?? 0;
            const items: RenderItem[] = [];
            let lastDay = '';
            let lastSender = -1;
            let lastIncoming: boolean | null = null;
            let lastTs = 0;

            for (const message of orderedMessages.value) {
                const ts = resolveTimestamp(message);
                const currentDay = dayKey(ts);
                if (currentDay && currentDay !== lastDay) {
                    const label = formatDayLabel(ts);
                    items.push({ kind: 'day', key: `day:${currentDay}`, label });
                    lastDay = currentDay;
                    lastSender = -1;
                    lastIncoming = null;
                    lastTs = 0;
                }

                const sender = (message.from_id ?? (message as unknown as { user_id?: number }).user_id ?? 0) as number;
                const incoming = sender !== userId;
                const withinGroupWindow = lastTs > 0 && ts > 0 ? ts - lastTs <= 5 * 60 * 1000 : false;
                const sameGroup = sender === lastSender && incoming === lastIncoming && withinGroupWindow;

                const showMeta = !sameGroup;
                const showAvatar = !sameGroup;
                const compact = sameGroup;

                items.push({
                    kind: 'message',
                    key: `msg:${message.id}:${ts}`,
                    message,
                    incoming,
                    showMeta,
                    showAvatar,
                    compact,
                    timeLabel: formatTimeLabel(ts),
                });

                lastSender = sender;
                lastIncoming = incoming;
                lastTs = ts;
            }

            return items;
        });

        return {
            orderedMessages,
            renderItems,
            isMemberMessage,
            userId: computed(() => props.user_id ?? 0),
        };
    },
});
</script>

<template>
    <!-- 要求能够按照时间顺序，从下到上满足按照时间的从新到旧进行MemberMessageBubble和UserMessageBubble的交替渲染 -->
    <!-- 区块：<div> .message-list -->
    <div class="message-list">
        <template v-for="item in renderItems" :key="item.key">
            <div v-if="item.kind === 'day'" class="day-separator" role="separator">
                <span class="day-separator-pill">{{ item.label }}</span>
            </div>
            <template v-else>
                <MemberMessageBubble
                    v-if="item.incoming"
                    :name="item.message.name"
                    :message="item.message.content"
                    :avatar="item.message.avatar"
                    :date="item.message.timestamp"
                    :time-label="item.timeLabel"
                    :show-meta="item.showMeta"
                    :show-avatar="item.showAvatar"
                    :compact="item.compact"
                    :message-id="item.message.id"
                    :user-id="item.message.from_id ?? (item.message as any).user_id"
                    @avatar-contextmenu="(payload) => $emit('avatar-contextmenu', payload)"
                />
                <UserMessageBubble
                    v-else
                    :name="item.message.name"
                    :message="item.message.content"
                    :avatar="item.message.avatar"
                    :date="item.message.timestamp"
                    :time-label="item.timeLabel"
                    :show-meta="item.showMeta"
                    :show-avatar="item.showAvatar"
                    :compact="item.compact"
                    :message-id="item.message.id"
                    :user-id="item.message.from_id ?? (item.message as any).user_id"
                    @avatar-contextmenu="(payload) => $emit('avatar-contextmenu', payload)"
                />
            </template>
        </template>
    </div>
</template>

<style scoped lang="scss">
/* 样式：.message-list */
.message-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 10px 14px 20px 14px;
}

.day-separator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 0;
}

.day-separator-pill {
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    color: var(--cp-text-muted);
    background: var(--cp-panel-muted);
    border: 1px solid var(--cp-border-light);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}
</style>
