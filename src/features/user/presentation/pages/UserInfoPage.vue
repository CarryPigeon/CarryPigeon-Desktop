<script setup lang="ts">
/**
 * @fileoverview UserInfoPage.vue
 * @description user｜页面：UserInfoPage。
 */

import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { currentUser } from "@/features/user/presentation/store/userData";

const route = useRoute();
const router = useRouter();

/**
 * 读取某个字段的展示值（query 优先，store 作为兜底）。
 *
 * 说明：
 * - 该页面既可通过路由 query 直达，也可展示当前登录用户（store）。
 * - 统一用 `String(...)` 归一化，避免 query 为数组类型时导致渲染异常。
 *
 * @param key - query 字段名（例如 `uid` / `email`）。
 * @param fallback - store 兜底值。
 * @returns 归一化后的字符串值。
 */
function readQueryOrFallback(key: "uid" | "name" | "email" | "bio", fallback: unknown): string {
  return String(route.query[key] ?? fallback ?? "");
}

/**
 * 读取要展示的用户 id（query 优先，store 兜底）。
 *
 * @returns 用户 id 字符串。
 */
function computeUid(): string {
  return readQueryOrFallback("uid", currentUser.id);
}

/**
 * 读取展示名称（query 优先，store 兜底）。
 *
 * @returns 用户名称。
 */
function computeName(): string {
  return readQueryOrFallback("name", currentUser.username);
}

/**
 * 读取邮箱（query 优先，store 兜底）。
 *
 * @returns 用户邮箱。
 */
function computeEmail(): string {
  return readQueryOrFallback("email", currentUser.email);
}

/**
 * 读取简介/描述（query 优先，store 兜底）。
 *
 * @returns 用户简介。
 */
function computeBio(): string {
  return readQueryOrFallback("bio", currentUser.description);
}

const uid = computed(computeUid);
const name = computed(computeName);
const email = computed(computeEmail);
const bio = computed(computeBio);
</script>

<template>
  <!-- 页面：UserInfoPage｜职责：用户资料展示 -->
  <!-- 区块：<main> .cp-info -->
  <main class="cp-info">
    <header class="cp-info__head">
      <button class="cp-info__back" type="button" @click="router.back()">Back</button>
      <div class="cp-info__title">
        <div class="cp-info__name">{{ name || "User" }}</div>
        <div class="cp-info__sub">Profile</div>
      </div>
    </header>

    <section class="cp-info__body">
      <div class="cp-info__card">
        <div class="cp-info__k">uid</div>
        <div class="cp-info__v"><MonoTag :value="uid" :copyable="true" /></div>
      </div>
      <div class="cp-info__card">
        <div class="cp-info__k">email</div>
        <div class="cp-info__v"><MonoTag :value="email" :copyable="true" /></div>
      </div>
      <div class="cp-info__card wide">
        <div class="cp-info__k">bio</div>
        <div class="cp-info__v">{{ bio || "—" }}</div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；页面为“头部卡片 + 内容网格面板”。 */
.cp-info {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-info__head {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}

.cp-info__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-info__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-info__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-info__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-info__body {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cp-info__card {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
}

.cp-info__card.wide {
  grid-column: 1 / -1;
}

.cp-info__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-info__v {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.45;
}
</style>
