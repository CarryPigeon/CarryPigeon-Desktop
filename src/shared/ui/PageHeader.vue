<script setup lang="ts">
/**
 * @fileoverview 页面顶部统一头部（PageHeader.vue）。
 * @description 提供"返回 + 标题 + 副标题 + 右侧操作"一致布局；调用方通过 slot 注入操作区。
 */

import BackButton from "@/shared/ui/BackButton.vue";

defineOptions({ name: "PageHeader" });

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    back?: boolean;
    backLabel?: string;
    /** 返回按钮的 data-testid（默认 page-header-back，兼容各页面既有选择器）。 */
    backTestId?: string;
  }>(),
  {
    subtitle: "",
    back: false,
    backLabel: "",
    backTestId: "page-header-back",
  },
);

const emit = defineEmits<{
  (e: "back"): void;
}>();

function onBack(): void {
  emit("back");
}
</script>

<template>
  <!-- 组件：PageHeader｜职责：页面顶部"返回 + 标题 + 副标题 + 操作"统一布局 -->
  <!-- 区块：<header> .cp-page-header -->
  <header class="cp-page-header">
    <!-- 返回（统一共享控件 BackButton） -->
    <BackButton
      v-if="props.back"
      :label="props.backLabel"
      :test-id="props.backTestId"
      @click="onBack"
    />
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
/* 样式：PageHeader｜布局：左返回 / 中标题 / 右操作 三栏；作为工作台顶部控制台铺在共享玻璃面上 */
.cp-page-header {
  @include cp-console;

  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
}

/* 标题文字：工作台控制台规格（14px/700 display） */
.cp-page-header__name {
  @include cp-console-title;
}

/* 副标题 */
.cp-page-header__sub {
  @include cp-console-sub;
}

/* 右侧操作区 */
.cp-page-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
</style>
