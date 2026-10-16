<script setup lang="ts">
/**
 * @fileoverview ContextMenuItem.vue
 * @description shared/ui｜统一菜单条目：禁用/危险/激活态 + 右侧快捷键提示。
 *
 * 说明：`mousedown.prevent` 避免条目抢走焦点（输入框的选区/光标不丢失）。
 */

defineOptions({ name: "ContextMenuItem" });

const props = withDefaults(
  defineProps<{
    /** 是否禁用（禁用时不派发 `select`）。 */
    disabled?: boolean;
    /** 危险动作（删除/撤回等）。 */
    danger?: boolean;
    /** 当前激活（如通知级别选中项）。 */
    active?: boolean;
    /** 快捷键提示（仅展示，不绑定按键）。 */
    shortcut?: string;
  }>(),
  {
    disabled: false,
    danger: false,
    active: false,
    shortcut: "",
  },
);

const emit = defineEmits<{
  select: [];
}>();

/**
 * 条目点击：禁用态直接忽略。
 *
 * @returns 无返回值。
 */
function handleClick(): void {
  if (props.disabled) return;
  emit("select");
}
</script>

<template>
  <!-- 组件：ContextMenuItem｜职责：菜单条目（标签 + 可选快捷键提示） -->
  <button
    class="cp-menu__item"
    :class="{
      'cp-menu__item--danger': props.danger,
      'cp-menu__item--active': props.active,
    }"
    type="button"
    role="menuitem"
    :disabled="props.disabled"
    :aria-disabled="props.disabled ? 'true' : undefined"
    @mousedown.prevent
    @click="handleClick"
  >
    <slot />
    <span v-if="props.shortcut" class="cp-menu__shortcut">{{ props.shortcut }}</span>
  </button>
</template>

<style scoped lang="scss">
/* 样式：ContextMenuItem｜条目布局与状态（hover/激活/危险/禁用） */
.cp-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--cp-text);
  font-size: 13px;
  font-family: var(--cp-font-body);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

.cp-menu__item:hover:not(:disabled),
.cp-menu__item--active {
  background: var(--cp-hover-bg);
}

.cp-menu__item--danger {
  color: var(--cp-danger);
}

.cp-menu__item:disabled {
  color: var(--cp-text-light);
  cursor: default;
  background: transparent;
}

/* 快捷键提示：右对齐弱化文案 */
.cp-menu__shortcut {
  margin-left: auto;
  color: var(--cp-text-light);
  font-size: 11px;
  letter-spacing: 0.02em;
}
</style>
