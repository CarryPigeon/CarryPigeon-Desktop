<script setup lang="ts">
/**
 * @fileoverview ParticipantsList.vue 文件职责说明。
 */

import type { Member } from "@/features/user/domain/entities/Member";
import GroupMemberModel from "../items/GroupMemberModel.vue";
import { ref, onMounted } from "vue";

const props = defineProps<{
    length: number;
    online: number;
    member: Member[];
}>();

// 成员列表初始宽度
const participantsWidth = ref(240);
// 是否正在调整大小
const isResizingWidth = ref(false);

/**
 * 开始调整成员列表宽度
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

    // 计算新的宽度：视口宽度减去鼠标 X 坐标
    const newWidth = window.innerWidth - e.clientX;

    // 限制成员列表的最小宽度（160px）和最大宽度（400px）
    if (newWidth >= 160 && newWidth <= 400) {
        participantsWidth.value = newWidth;
        // 更新全局 CSS 变量，以便 ChatBox, TextArea 和 SearchBar 同步调整其右边距
        document.documentElement.style.setProperty(
            "--participants-list-width",
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

onMounted(() => {
    // 初始化全局宽度变量
    document.documentElement.style.setProperty(
        "--participants-list-width",
        `${participantsWidth.value}px`,
    );
});

const emit = defineEmits<{
    (
        e: "avatar-click",
        payload: { screenX: number; screenY: number; member: Member },
    ): void;
    (
        e: "avatar-contextmenu",
        payload: {
            screenX: number;
            screenY: number;
            clientX: number;
            clientY: number;
            member: Member;
        },
    ): void;
}>();
</script>

<template>
    <!-- 组件：ParticipantsList｜职责：右侧成员列表；交互：拖拽调宽并同步 --participants-list-width -->
    <!-- 区块：<div> .participants-list -->
    <div class="participants-list">
        <!-- 宽度调节手柄 -->
        <!-- 区块：<div> .resizer-h -->
        <div class="resizer-h" @mousedown="startResizeWidth"></div>
        <!-- 区块：<div> .participants-number -->
        <div class="participants-number">
            <p class="participants-title">{{ $t("participants") }} - {{ props.length }}</p>
        </div>
        <!-- 区块：<div> .list -->
        <div class="list" :style="{ width: participantsWidth + 'px' }">
            <!-- 区块：<ul> -->
            <ul style="list-style-type: none; padding: 0">
                <!-- 区块：<li> -->
                <li v-for="item in props.member" :key="item.id">
                    <GroupMemberModel
                        :avatar="item.avatarUrl"
                        :name="item.name"
                        @avatar-click="
                            (pos) =>
                                emit('avatar-click', { ...pos, member: item })
                        "
                        @avatar-contextmenu="
                            (pos) =>
                                emit('avatar-contextmenu', {
                                    ...pos,
                                    member: item,
                                })
                        "
                    />
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped lang="scss">
/* 样式：右侧固定成员列表 */
.participants-list {
    position: relative;
    height: 100%;
    display: grid;
    grid-template-columns: 4px 1fr;
    grid-template-rows: 44px minmax(0, 1fr);
    z-index: 100;
    background: transparent;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

/* 样式：.resizer-h */
.resizer-h {
    width: 4px;
    height: 100%;
    cursor: ew-resize;
    background: transparent;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
    grid-column: 1;
    grid-row: 1 / span 2;

    /* 样式：&:hover */
    &:hover {
        background-color: var(--cp-hover-bg-2);
    }
}

/* 样式：.list */
.list {
    position: relative;
    display: grid;
    padding: 6px 0;
    top: 0;
    height: 100%;
    background: transparent;
    flex: 1;
    overflow-y: auto;
    grid-column: 2;
    grid-row: 2;
}

/* 样式：.participants-number */
.participants-number {
    z-index: 1;
    margin-left: 0;
    position: relative;
    left: 0;
    top: 0;
    border: none;
    box-sizing: border-box;
    height: 44px;
    background: transparent;
    border-bottom: 1px solid var(--cp-border-light);
    color: var(--cp-text, #1a1a1a);
    font-weight: 500;
    font-size: 12px;
    width: 100%;
    display: flex;
    align-items: center;
    grid-column: 2;
    grid-row: 1;
}

/* 样式：.participants-title */
.participants-title {
    margin: 0;
    padding-left: 12px;
}
</style>
