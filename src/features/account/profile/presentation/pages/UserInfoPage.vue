<script setup lang="ts">
/**
 * @fileoverview UserInfoPage.vue
 * @description account/profile｜页面：UserInfoPage。
 */

import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { getCurrentUserCapabilities } from "@/features/account/current-user/api";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";

const currentUser = useObservedCapabilitySnapshot(getCurrentUserCapabilities());

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
function readQueryOrFallback(
  key: "uid" | "name" | "email" | "bio" | "avatarUrl" | "backgroundUrl",
  fallback: unknown,
): string {
  return String(route.query[key] ?? fallback ?? "");
}

/**
 * 读取要展示的用户 id（query 优先，store 兜底）。
 *
 * @returns 用户 id 字符串。
 */
function computeUid(): string {
  return readQueryOrFallback("uid", currentUser.value.id);
}

/**
 * 读取展示名称（query 优先，store 兜底）。
 *
 * @returns 用户名称。
 */
function computeName(): string {
  return readQueryOrFallback("name", currentUser.value.username);
}

/**
 * 读取邮箱（query 优先，store 兜底）。
 *
 * @returns 用户邮箱。
 */
function computeEmail(): string {
  return readQueryOrFallback("email", currentUser.value.email);
}

/**
 * 读取简介/描述（query 优先，store 兜底）。
 *
 * @returns 用户简介。
 */
function computeBio(): string {
  return readQueryOrFallback("bio", currentUser.value.description);
}

/**
 * 读取头像（query 优先，空值则回退为空字符串）。
 */
function computeAvatarUrl(): string {
  return readQueryOrFallback("avatarUrl", "");
}

/**
 * 读取背景图（query 优先，空值则回退为空字符串）。
 */
function computeBackgroundUrl(): string {
  return readQueryOrFallback("backgroundUrl", "");
}

const uid = computed(computeUid);
const name = computed(computeName);
const email = computed(computeEmail);
const bio = computed(computeBio);
const avatarUrl = computed(computeAvatarUrl);
const backgroundUrl = computed(computeBackgroundUrl);
const heroStyle = computed(() => {
  if (backgroundUrl.value) {
    return {
      backgroundImage: [
        "linear-gradient(180deg, rgba(15, 23, 42, 0.18) 0%, rgba(15, 23, 42, 0.56) 56%, rgba(15, 23, 42, 0.82) 100%)",
        `url(${backgroundUrl.value})`,
      ].join(", "),
    };
  }

  return {};
});
</script>

<template>
  <!-- 页面：UserInfoPage｜职责：用户资料展示 -->
  <!-- 区块：<main> .cp-info -->
  <main class="cp-info">
    <header class="cp-info__hero" :style="heroStyle">
      <div class="cp-info__hero-overlay"></div>
      <div class="cp-info__hero-top">
        <button class="cp-info__back" type="button" @click="router.back()">Back</button>
      </div>
      <div class="cp-info__hero-content">
        <div class="cp-info__avatar">
          <img v-if="avatarUrl" class="cp-info__avatar-image" :src="avatarUrl" :alt="name || 'User'" />
          <div v-else class="cp-info__avatar-fallback">{{ (name || "U").slice(0, 1).toUpperCase() }}</div>
        </div>
        <div class="cp-info__hero-text">
          <div class="cp-info__name">{{ name || "User" }}</div>
          <div class="cp-info__sub">Profile · Full details</div>
          <div class="cp-info__hero-meta">
            <span class="cp-info__hero-pill">uid available</span>
            <span class="cp-info__hero-pill">email available</span>
            <span class="cp-info__hero-pill">bio available</span>
          </div>
        </div>
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
        <div class="cp-info__v cp-info__bio">{{ bio || "—" }}</div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；页面为“背图横幅 + 资料详情面板”。 */
.cp-info {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-info__hero {
  position: relative;
  min-height: 220px;
  border: 1px solid var(--cp-border);
  background:
    radial-gradient(circle at 20% 18%, color-mix(in oklab, var(--cp-highlight) 28%, transparent), transparent 36%),
    linear-gradient(135deg, color-mix(in oklab, var(--cp-primary) 40%, var(--cp-panel)) 0%, color-mix(in oklab, var(--cp-accent) 24%, var(--cp-panel-muted)) 100%);
  background-size: cover;
  background-position: center;
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  overflow: hidden;
  padding: 14px;
}

.cp-info__hero-overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.08) 0%, rgba(15, 23, 42, 0.22) 36%, rgba(15, 23, 42, 0.72) 100%),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0) 42%);
  pointer-events: none;
}

.cp-info__hero-top {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: flex-start;
}

.cp-info__hero-content {
  position: relative;
  z-index: 1;
  margin-top: 90px;
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.cp-info__avatar {
  flex: 0 0 auto;
  width: 84px;
  height: 84px;
  border-radius: 24px;
  padding: 4px;
  background: color-mix(in oklab, var(--cp-panel) 76%, transparent);
  box-shadow: var(--cp-shadow-soft);
  overflow: hidden;
}

.cp-info__avatar-image,
.cp-info__avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: 20px;
}

.cp-info__avatar-image {
  object-fit: cover;
}

.cp-info__avatar-fallback {
  display: grid;
  place-items: center;
  font-family: var(--cp-font-display);
  font-size: 32px;
  font-weight: 900;
  color: var(--cp-text);
  background: color-mix(in oklab, var(--cp-panel) 82%, var(--cp-accent));
}

.cp-info__hero-text {
  min-width: 0;
  flex: 1 1 auto;
}

.cp-info__back {
  border: 1px solid var(--cp-border);
  background: color-mix(in oklab, var(--cp-panel) 74%, transparent);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
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
  font-size: 24px;
  color: #fff;
  line-height: 1.1;
}

.cp-info__sub {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
}

.cp-info__hero-meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cp-info__hero-pill {
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
}

.cp-info__body {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
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

.cp-info__bio {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .cp-info {
    padding: 10px;
    gap: 10px;
  }

  .cp-info__hero {
    min-height: 200px;
  }

  .cp-info__hero-content {
    margin-top: 80px;
    align-items: flex-start;
  }

  .cp-info__avatar {
    width: 72px;
    height: 72px;
    border-radius: 20px;
  }

  .cp-info__avatar-fallback {
    font-size: 28px;
  }

  .cp-info__name {
    font-size: 20px;
  }

  .cp-info__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .cp-info__card.wide {
    grid-column: auto;
  }
}
</style>
