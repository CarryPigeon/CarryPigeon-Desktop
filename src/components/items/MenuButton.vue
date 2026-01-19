<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

// 定义菜单操作：'about', 'history', 'plugins'
export type MenuButtonAction = "about" | "history" | "plugins";

// 加载状态和错误信息的 Props
const props = defineProps<{
    loading?: boolean;
    error?: string | null;
}>();

// 点击菜单项时触发 action 事件
const emit = defineEmits<{
    (e: "action", action: MenuButtonAction): void;
}>();

const isOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const position = ref({ x: 0, y: 0 });

// 点击按钮切换菜单显示/隐藏
async function handleClick(event: MouseEvent) {
    if (isOpen.value) {
        close();
        return;
    }

    // 根据点击坐标设置初始位置
    position.value = { x: event.clientX, y: event.clientY };
    isOpen.value = true;

    // 等待 DOM 更新以计算正确位置
    await nextTick();
    adjustPosition();
}

function close() {
    isOpen.value = false;
}

function emitAction(action: MenuButtonAction) {
    emit("action", action);
    close();
}

// 调整菜单位置以保持在视口范围内
function adjustPosition() {
    const el = menuRef.value;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const padding = 8;

    let x = position.value.x;
    let y = position.value.y;

    // 如果超出右边界，调整 X 坐标
    if (x + rect.width + padding > window.innerWidth) {
        x = Math.max(padding, window.innerWidth - rect.width - padding);
    }

    // 如果超出下边界，调整 Y 坐标
    if (y + rect.height + padding > window.innerHeight) {
        y = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    position.value = { x, y };
}

// 点击外部时关闭菜单
const onDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (menuRef.value?.contains(target)) return;
    close();
};

const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
};

const onWindowResize = () => {
    close();
};

// 根据菜单开启状态管理全局事件监听器
watch(isOpen, (val) => {
    if (val) {
        // 使用 timeout 避免被打开菜单的点击事件立即触发
        setTimeout(() => {
            document.addEventListener("pointerdown", onDocumentPointerDown);
            document.addEventListener("keydown", onDocumentKeyDown);
            window.addEventListener("resize", onWindowResize);
        }, 0);
    } else {
        document.removeEventListener("pointerdown", onDocumentPointerDown);
        document.removeEventListener("keydown", onDocumentKeyDown);
        window.removeEventListener("resize", onWindowResize);
    }
});

onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", onDocumentPointerDown);
    document.removeEventListener("keydown", onDocumentKeyDown);
    window.removeEventListener("resize", onWindowResize);
});
</script>

<template>
    <button
        class="menu-btn"
        type="button"
        :title="props.error ?? ''"
        @click.stop="handleClick"
    >
        <span v-if="props.loading">...</span>
        <svg
            v-else
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M3 12H21"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                d="M3 6H21"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                d="M3 18H21"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    </button>

    <Teleport to="body">
        <div
            v-if="isOpen"
            ref="menuRef"
            class="popup-menu"
            role="menu"
            :style="{ left: `${position.x}px`, top: `${position.y}px` }"
            @contextmenu.prevent
        >
            <button
                class="menu-item"
                type="button"
                @click="emitAction('history')"
            >
                {{ $t("menu_manager_history") }}
            </button>
            <button
                class="menu-item"
                type="button"
                @click="emitAction('plugins')"
            >
                {{ $t("menu_manager_plugins") }}
            </button>
            <button
                class="menu-item"
                type="button"
                @click="emitAction('about')"
            >
                {{ $t("menu_about") }}
            </button>
        </div>
    </Teleport>
</template>

<style scoped lang="scss">
.menu-btn {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    border: 1px dashed rgba(148, 163, 184, 0.35);
    color: rgba(148, 163, 184, 0.9);
    user-select: none;
    background: transparent;
    cursor: pointer;
    padding: 0;

    &:hover {
        border-color: rgba(148, 163, 184, 0.6);
        color: rgba(148, 163, 184, 1);
    }
}

.popup-menu {
    position: fixed;
    z-index: 10000;
    min-width: 160px;
    padding: 6px;
    background: rgba(255, 255, 255, 1);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
}

.menu-item {
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    padding: 8px 10px;
    border: 0;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    transition: background-color 0.2s;

    &:hover {
        background: rgba(0, 0, 0, 0.06);
    }
}
</style>
