<script setup lang="ts">
const props = defineProps<{
    avatar: string;
    name: string;
}>();

const emit = defineEmits<{
    (e: "avatar-click", payload: { screenX: number; screenY: number }): void;
    (
        e: "avatar-contextmenu",
        payload: {
            screenX: number;
            screenY: number;
            clientX: number;
            clientY: number;
        },
    ): void;
}>();

function click_avatar(event: MouseEvent) {
    emit("avatar-click", { screenX: event.screenX, screenY: event.screenY });
}

function onAvatarContextMenu(event: MouseEvent) {
    emit("avatar-contextmenu", {
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
    });
}
</script>

<template>
    <div class="group-member-model">
        <img
            class="member-avatar"
            :src="props.avatar"
            alt=""
            @click="click_avatar"
            @contextmenu.prevent="onAvatarContextMenu"
        />
        <p class="member-name">{{ props.name }}</p>
    </div>
</template>

<style scoped lang="scss">
.group-member-model {
    display: flex;
    align-items: center;
    padding: 8px 15px;
    width: 100%;
    box-sizing: border-box;
}

.member-avatar {
    width: 40px;
    height: 40px;
    margin-right: 12px;
    border-radius: 50%;
    object-fit: cover;
    cursor: pointer;
    flex-shrink: 0;
}

.member-name {
    margin: 0;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
