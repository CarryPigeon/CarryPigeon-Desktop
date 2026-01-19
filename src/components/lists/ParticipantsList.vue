<script setup lang="ts">
import { Member } from "../../value/memberValue";
import GroupMemberModel from "../items/GroupMemberModel.vue";
import { ref, onMounted } from 'vue';

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
const startResizeWidth = (e: MouseEvent) => {
  isResizingWidth.value = true;
  document.addEventListener('mousemove', handleResizeWidth);
  document.addEventListener('mouseup', stopResizeWidth);
  e.preventDefault();
};

/**
 * 处理鼠标移动，实时更新宽度
 * @param e 鼠标事件
 */
const handleResizeWidth = (e: MouseEvent) => {
  if (!isResizingWidth.value) return;
  
  // 计算新的宽度：视口宽度减去鼠标 X 坐标
  const newWidth = window.innerWidth - e.clientX;
  
  // 限制成员列表的最小宽度（160px）和最大宽度（400px）
  if (newWidth >= 160 && newWidth <= 400) {
    participantsWidth.value = newWidth;
    // 更新全局 CSS 变量，以便 ChatBox, TextArea 和 SearchBar 同步调整其右边距
    document.documentElement.style.setProperty('--participants-list-width', `${newWidth}px`);
  }
};

/**
 * 停止调整大小，移除事件监听
 */
const stopResizeWidth = () => {
  isResizingWidth.value = false;
  document.removeEventListener('mousemove', handleResizeWidth);
  document.removeEventListener('mouseup', stopResizeWidth);
};

onMounted(() => {
  // 初始化全局宽度变量
  document.documentElement.style.setProperty('--participants-list-width', `${participantsWidth.value}px`);
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
    <div class="participants-list" :style="{ width: participantsWidth + 'px' }">
        <!-- 宽度调节手柄 -->
        <div class="resizer-h" @mousedown="startResizeWidth"></div>
        <div class="participants-number" :style="{ width: participantsWidth + 'px' }">
            <p>{{ $t("participants") }} - {{ props.length }}</p>
        </div>
        <div class="list" :style="{ width: participantsWidth + 'px' }">
            <ul style="list-style-type: none; padding: 0">
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
.participants-list {
    position: fixed;
    right: 0;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: row; // 让 resizer 在左侧
    z-index: 100;
}

// 垂直方向调节宽度的手柄
.resizer-h {
    width: 4px;
    height: 100%;
    cursor: ew-resize; // 显示左右调节的光标
    background: transparent;
    transition: background 0.2s;
    flex-shrink: 0;
    
    &:hover {
        background: rgba(0, 0, 0, 0.1);
    }
}

.list {
    position: relative; // 改为 relative 随父容器移动
    display: grid;
    padding: 0;
    top: 0;
    height: calc(100vh - 3px);
    opacity: 1;
    background: rgba(243, 244, 246, 1);
    border: 1px solid rgba(231, 232, 236, 1);
    flex: 1;
}

.participants-number {
    z-index: 1;
    position: absolute; // 改为 absolute
    left: 4px; // 避开 resizer
    margin-left: 10px;
    top: 0;
    border: none;
    box-sizing: border-box;
    height: 50px;
    opacity: 1;
    background: rgba(243, 244, 246, 1);
    border-bottom: 1px solid rgba(227, 229, 233, 1);
}
</style>
