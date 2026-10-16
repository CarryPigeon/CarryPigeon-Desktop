<script setup lang="ts">
/**
 * @fileoverview ContextMenuSurface.vue
 * @description shared/ui｜统一菜单浮层：全屏 backdrop + 面板 + 视口钳制 + Esc 关闭。
 *
 * 约定：
 * - 面板根类名固定为 `cp-menu`（`CONTEXT_MENU_PANEL_CLASS`），全局右键接管用它识别「右键落在菜单自身」；
 * - 组件不自动关闭，由宿主在动作派发后 `close`（与既有菜单语义一致）。
 */

import { computed, onBeforeUnmount, onMounted, watch, type CSSProperties } from "vue";
import { useFloatingMenu } from "@/shared/ui/useFloatingMenu";

defineOptions({ name: "ContextMenuSurface" });

const props = withDefaults(
  defineProps<{
    /** 是否打开。 */
    open: boolean;
    /** 期望左边缘 x（鼠标 clientX 或锚点右边缘）。 */
    x: number;
    /** 期望上边缘 y。 */
    y: number;
    /** 面板最小宽度（px）。 */
    minWidth?: number;
    /** 面板无障碍标签。 */
    ariaLabel?: string;
  }>(),
  {
    minWidth: 200,
    ariaLabel: "",
  },
);

const emit = defineEmits<{
  close: [];
}>();

const { setMenuEl, menuStyle, schedulePlacement } = useFloatingMenu({
  x: () => props.x,
  y: () => props.y,
  open: () => props.open,
});

watch(
  () => props.open,
  (open) => {
    if (open) schedulePlacement();
  },
);

/** 面板内联样式：定位样式 + 最小宽度。 */
const panelStyle = computed<CSSProperties>(() => ({
  ...menuStyle.value,
  minWidth: `${props.minWidth}px`,
}));

/**
 * 关闭菜单（派发 `close`）。
 *
 * @returns 无返回值。
 */
function handleClose(): void {
  emit("close");
}

/**
 * 全局键盘关闭处理器（Escape）。
 *
 * @param e - Window 键盘事件。
 * @returns 无返回值。
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (!props.open) return;
  if (e.key !== "Escape") return;
  e.preventDefault();
  handleClose();
}

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeydown);
  // 挂载即打开（调用方常驻挂载 + open 翻转，此处兜底）时也需要测量定位
  if (props.open) schedulePlacement();
});
onBeforeUnmount(() => window.removeEventListener("keydown", onGlobalKeydown));
</script>

<template>
  <!-- 组件：ContextMenuSurface｜职责：菜单浮层（backdrop + 面板 + 定位 + Esc） -->
  <teleport to="body">
    <template v-if="props.open">
      <!-- 区块：全屏点击关闭层 -->
      <div class="cp-menu__backdrop" @click="handleClose"></div>
      <!-- 区块：菜单面板 -->
      <div
        :ref="setMenuEl"
        class="cp-menu"
        :style="panelStyle"
        role="menu"
        :aria-label="props.ariaLabel || undefined"
        @click.stop
      >
        <slot />
      </div>
    </template>
  </teleport>
</template>

<style scoped lang="scss">
/* 样式：ContextMenuSurface｜统一菜单外观（简洁实心面板，唯一来源）
   面板底色必须不透明：`--cp-surface` / `--cp-panel` 是为毛玻璃面板准备的半透明色，
   用在右键菜单上会让下层消息、头像、按钮透出来（截图里能看到「hi」头像），故改用 `--cp-panel-solid`。 */
.cp-menu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 10049;
}

.cp-menu {
  position: fixed;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--cp-panel-solid);
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  box-shadow: var(--cp-shadow-float);
}
</style>
