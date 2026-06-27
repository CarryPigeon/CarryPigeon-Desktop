<script setup lang="ts">
/**
 * @fileoverview 页面顶部统一头部（PageHeader.vue）。
 * @description 提供"返回 + 标题 + 副标题 + 右侧操作"一致布局；调用方通过 slot 注入操作区。
 */

import { useI18n } from "vue-i18n";

defineOptions({ name: "PageHeader" });

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    back?: boolean;
    backLabel?: string;
  }>(),
  {
    subtitle: "",
    back: false,
    backLabel: "",
  },
);

const emit = defineEmits<{
  (e: "back"): void;
}>();

const { t } = useI18n();

function onBack(): void {
  emit("back");
}

const resolvedBackLabel = (): string => {
  if (props.backLabel.trim().length > 0) return props.backLabel;
  return t("back");
};
</script>

<template>
  <!-- 组件：PageHeader｜职责：页面顶部"返回 + 标题 + 副标题 + 操作"统一布局 -->
  <!-- 区块：<header> .cp-page-header -->
  <header class="cp-page-header">
    <!-- 返回 -->
    <button
      v-if="props.back"
      class="cp-page-header__back"
      type="button"
      data-testid="page-header-back"
      @click="onBack"
    >
      {{ resolvedBackLabel() }}
    </button>
    <!-- 标题块 -->
    <div class="cp-page-header__title">
      <div class="cp-page-header__name">{{ props.title }}</div>
      <div v-if="props.subtitle.trim().length > 0" class="cp-page-header__sub">
        {{ props.subtitle }}
      </div>
    </div>
    <!-- 右侧操作 -->
    <div v-if="$slots.actions" class="cp-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
/* 样式：PageHeader｜布局：左返回 / 中标题 / 右操作 三栏 */
.cp-page-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
}

/* 返回按钮（pill，size 12px） */
.cp-page-header__back {
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

.cp-page-header__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* 标题文字 */
.cp-page-header__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* 副标题 */
.cp-page-header__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 右侧操作区 */
.cp-page-header__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
