<script setup lang="ts">
/**
 * @fileoverview PanelSwitch.vue
 * @description shared/ui｜展示组件：统一布尔开关（role=switch，原生 button 渲染）。
 */

defineOptions({ name: "PanelSwitch", inheritAttrs: true });

const props = withDefaults(
  defineProps<{
    /** 当前是否开启。 */
    modelValue: boolean;
    /** 无障碍名称（行标签），role=switch 必须具备可访问名称。 */
    label: string;
    /** 是否禁用。 */
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

/** 切换开关（原生 button 已处理空格/回车触发 click）。 */
function toggle(): void {
  if (props.disabled) return;
  emit("update:modelValue", !props.modelValue);
}
</script>

<template>
  <!-- 组件：PanelSwitch｜职责：布尔开关 -->
  <button
    class="cp-panel-switch"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    :data-checked="modelValue"
    @click="toggle"
  >
    <span class="cp-panel-switch__thumb" aria-hidden="true" />
  </button>
</template>

<style scoped lang="scss">
/* 样式：PanelSwitch｜规格：40×22 胶囊，开启用 accent（状态语义） */
.cp-panel-switch {
  position: relative;
  flex: 0 0 auto;
  width: 40px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--cp-border);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-panel-switch[data-checked="true"] {
  background: var(--cp-accent);
  border-color: var(--cp-accent);
}

.cp-panel-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cp-panel-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--cp-text-light);
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
}

.cp-panel-switch[data-checked="true"] .cp-panel-switch__thumb {
  transform: translateX(18px);
  background: var(--cp-panel-solid);
}
</style>
