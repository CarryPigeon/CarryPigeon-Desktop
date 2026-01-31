<script setup lang="ts">
/**
 * @fileoverview GroupMemberModel.vue 文件职责说明。
 */

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

/**
 * click_avatar 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
function click_avatar(event: MouseEvent) {
    emit("avatar-click", { screenX: event.screenX, screenY: event.screenY });
}

/**
 * onAvatarContextMenu 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
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
  <!-- 组件：成员条目｜职责：展示成员头像与基础信息 -->
  <!-- 区块：<div> .group-member-model -->
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
/* 样式：成员条目布局与头像尺寸 */
.group-member-model {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    width: 100%;
    box-sizing: border-box;
    border-radius: var(--cp-radius, 14px);
    transition:
        background-color var(--cp-fast, 160ms) var(--cp-ease, ease),
        transform var(--cp-fast, 160ms) var(--cp-ease, ease);

    /* 样式：&:hover */
    &:hover {
        background-color: var(--cp-hover-bg);
        transform: translateY(-1px);
    }
}

/* 样式：.member-avatar */
.member-avatar {
    width: 32px;
    height: 32px;
    margin-right: 10px;
    border-radius: 14px;
    object-fit: cover;
    cursor: pointer;
    flex-shrink: 0;
    background: var(--cp-hover-bg);
}

/* 样式：.member-name */
.member-name {
    margin: 0;
    font-size: 13px;
    color: var(--cp-text, #1a1a1a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
