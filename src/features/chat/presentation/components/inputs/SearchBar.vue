<script setup lang="ts">
/**
 * @fileoverview SearchBar.vue 文件职责说明。
 */

import { ref } from "vue";
import search from '/search.svg?url';


const search_value = ref("");
</script>

<template>
  <!-- 组件：SearchBar｜职责：顶部搜索输入栏 -->
  <!-- 区块：<div> .search-bar -->
  <div class="search-bar">
    <!-- 区块：<div> .search-field -->
    <div class="search-field">
      <img class="search-icon" :src="search" alt="search" />
      <Input class="search-input" v-model="search_value" :placeholder="$t('search_bar')" />
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：顶部搜索栏（嵌在玻璃 TopBar 面板中） */
.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0;
  width: 100%;
  height: 100%;
  background: transparent;
}

/* 样式：.search-field */
.search-field {
  position: relative;
  display: flex;
  margin-left: auto;
  width: 100%;
  min-width: 220px;
  height: var(--cp-field-height, 38px);
  border-radius: 999px;
  background: var(--cp-field-bg);
  border: 1px solid var(--cp-field-border);
  transition:
    border-color var(--cp-fast, 160ms) var(--cp-ease, ease),
    box-shadow var(--cp-fast, 160ms) var(--cp-ease, ease);

  /* 样式：&:focus-within */
  &:focus-within {
    border-color: var(--cp-accent);
    box-shadow: var(--cp-ring);
  }

  &:hover {
    border-color: var(--cp-field-border-hover);
    background: var(--cp-field-bg-hover);
  }
}

/* 样式：.search-input */
.search-input {
  display: flex;
  border: none;
  background: transparent;
  outline: none;
  flex: 1;
  padding: 0 12px 0 8px;
  font-size: 13px;
  color: var(--cp-text, #1a1a1a);

  /* 样式：&::placeholder */
  &::placeholder {
    color: var(--cp-text-muted, #737373);
  }

  :deep(.t-input) {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  :deep(.t-input__wrap) {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  :deep(.t-input--focused),
  :deep(.t-input.t-is-focused) {
    border: none !important;
    box-shadow: none !important;
  }
}

/* 样式：.search-icon */
.search-icon {
  display: flex;
  position: relative;
  border: none;
  background: transparent;
  outline: none;
  z-index: 1;
  margin-left: 10px;
  opacity: 0.62;
  filter: saturate(0.85);
}
</style>
