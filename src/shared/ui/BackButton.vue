<script setup lang="ts">
/**
 * @fileoverview BackButton.vue
 * @description 共享 UI：全应用统一的「返回 / 退出页面」按钮。
 *
 * 约定：
 * - 位置由调用方决定（统一放在页面头部左上角）；
 * - 样式只在此处定义，调用方不得再自绘返回按钮；
 * - 组件本身不内建路由，导航行为由调用方通过 click 事件决定。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({ name: "BackButton" });

const props = withDefaults(
  defineProps<{
    /**
     * 按钮文案；为空时回退到 i18n `back`。
     */
    label?: string;
    /**
     * 透传给按钮的 data-testid。
     */
    testId?: string;
  }>(),
  {
    label: "",
    testId: "page-back",
  },
);

const emit = defineEmits<{
  (e: "click"): void;
}>();

const { t } = useI18n();

/**
 * 解析最终展示文案：显式 label 优先，否则使用 i18n `back`。
 */
const resolvedLabel = computed<string>(() =>
  props.label.trim().length > 0 ? props.label : t("back"),
);

/**
 * 触发 click 事件（导航交由调用方处理）。
 */
function onClick(): void {
  emit("click");
}
</script>

<template>
  <!-- 组件：BackButton｜职责：统一的页面返回按钮（药丸 / 小号） -->
  <button
    class="cp-back-btn"
    type="button"
    :data-testid="props.testId"
    @click="onClick"
  >
    {{ resolvedLabel }}
  </button>
</template>

<style scoped lang="scss">
/* 样式：BackButton｜规格：button-size('sm') 药丸；颜色全部取自全局 `--cp-*` 变量 */
.cp-back-btn {
  @include button-size('sm');
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-back-btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-back-btn:focus-visible {
  outline: 2px solid var(--cp-highlight-border);
  outline-offset: 2px;
}

.cp-back-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
