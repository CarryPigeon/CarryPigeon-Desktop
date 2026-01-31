<script setup lang="ts">
/**
 * @fileoverview UserComponent.vue 文件职责说明。
 */

import setting from "/settings.svg?url";
import { computed } from "vue";
import { useRouter } from "vue-router";

const props = defineProps<{
  avatar?: string;
  name?: string;
  description?: string;
  id?: number;
}>();

const emit = defineEmits<{
  (e: "profile-click"): void;
}>();

/**
 * limitToChars 方法说明。
 * @param input - 参数说明。
 * @param maxChars - 参数说明。
 * @returns 返回值说明。
 */
function limitToChars(input: string, maxChars: number) {
  const chars = Array.from(input);
  if (chars.length <= maxChars) return input;
  return chars.slice(0, maxChars).join("");
}

const avatar = computed(() => props.avatar ?? "");
const name = computed(() => props.name ?? "");
const description = computed(() => limitToChars(props.description ?? "", 25));
const id = computed(() => props.id ?? 0);

const router = useRouter();

/**
 * click_setting 方法说明。
 * @returns 返回值说明。
 */
function click_setting() {
  router.push("/settings");
}

/**
 * click_profile 方法说明。
 * @returns 返回值说明。
 */
function click_profile() {
  emit("profile-click");
}
</script>

<template>
  <!-- 组件：UserComponent｜职责：左下角用户信息与快捷入口（设置/添加频道） -->
  <!-- 区块：<div> .container -->
  <div class="container" @click="click_profile">
    <img class="image" :src="avatar" alt="avatar" />

    <!-- 区块：<div> .info -->
    <div class="info">
      <p class="username">{{ name }} - {{ id }}</p>
      <p class="description">{{ description }}</p>
    </div>

    <!-- 区块：<div> .actions -->
    <div class="actions">
      <img class="setting-icon" :src="setting" @click.stop="click_setting" alt="" />
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：固定底部用户栏（嵌在频道面板底部） */
.container {
  position: relative;
  width: 100%;
  min-height: 50px;
  box-sizing: border-box;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  background: rgba(255, 253, 248, 0.40);
  border-top: 1px solid var(--cp-border-light);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* 样式：.image */
.image {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  background: rgba(20, 32, 29, 0.08);
  cursor: pointer;
  border-radius: 14px;
  border: 1px solid var(--cp-border-light);
}

/* 样式：.info */
.info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 样式：.username */
.username {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--cp-text, #1a1a1a);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.description */
.description {
  margin: 0;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--cp-text-muted, #737373);
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* 样式：.actions */
.actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 样式：.setting-icon */
.setting-icon {
  cursor: pointer;
  padding: 6px;
  border-radius: 12px;
  transition: background-color var(--cp-fast, 160ms) var(--cp-ease, ease);
  opacity: 0.6;

  /* 样式：&:hover */
  &:hover {
    background-color: rgba(15, 118, 110, 0.12);
    opacity: 1;
  }
}
</style>
