<script lang="ts">
import { defineComponent, computed, ref } from 'vue';
import MemberMessageBubble from './MemberMessageBubble.vue';
import UserMessageBubble from './UserMessageBubble.vue';
import type { Message } from './messageTypes';
import name from '../users/UserComponent.vue';
import id from '../users/UserComponent.vue';

const messageList = ref<Message[]>([]);

export function importMessage(value: Message[]) {
    messageList.value = [...value];
}

export function addMessage(value: Message) {
    messageList.value = [...messageList.value, value];
}

const resolveTimestamp = (message: Message): number => {
    const payload = message as unknown as Record<string, unknown>;
    const raw = payload.timestamp;

    if (typeof raw === 'number') return raw;
    if (raw instanceof Date) return raw.getTime();

    if (typeof raw === 'string' && raw.length > 0) {
        const parsed = Date.parse(raw);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    return 0;
};

const isMemberMessage = (message: Message,user_id: number): boolean => {
    const payload = message as unknown as Record<string, unknown>;
    const role = payload.from_id as number;
    return role == user_id;
};

export default defineComponent({
    name: 'MessageBubbleComponents',
    components: {
        MemberMessageBubble,
        UserMessageBubble,
    },
    setup() {
        const orderedMessages = computed(() =>
            [...messageList.value].sort((a, b) => resolveTimestamp(a) - resolveTimestamp(b))
        );
        
        const getIdValue = computed(() => {
            return id.value;
        });
        
        const getNameValue = computed(() => {
            return name.value;
        });

        return {
            orderedMessages,
            isMemberMessage,
            getIdValue,
            getNameValue
        };
    },
});
</script>

<template>
    <!-- 要求能够按照时间顺序，从下到上满足按照时间的从新到旧进行MemberMessageBubble和UserMessageBubble的交替渲染 -->
    <div class="message-list">
        <template
            v-for="(message, index) in orderedMessages"
            :key="message.id ?? message.from_id ?? message.timestamp ?? index"
        >
            <MemberMessageBubble v-if="isMemberMessage(message, getIdValue ?? 0)" :name="message.name" :message="message.content" :avatar="message.avatar" :date="message.timestamp" :message-id="message.id" />
            <UserMessageBubble v-else :name="getNameValue ?? 'error'" :message="message.content" :avatar="message.avatar" :date="message.timestamp" :message-id="message.id" />
        </template>
    </div>
</template>

<style scoped lang="scss">
</style>
