<script setup lang="ts">
/**
 * @fileoverview UserInfoPage.vue
 * @description User info window/page (minimal for UI preview).
 */

import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { currentUser } from "@/features/user/presentation/store/userData";

const route = useRoute();
const router = useRouter();

/**
 * Read the user id to display (query param wins, store fallback).
 *
 * @returns User id as string.
 */
function computeUid(): string {
  return String(route.query.uid ?? currentUser.id ?? "");
}

/**
 * Read the display name (query param wins, store fallback).
 *
 * @returns User name.
 */
function computeName(): string {
  return String(route.query.name ?? currentUser.username ?? "");
}

/**
 * Read the email (query param wins, store fallback).
 *
 * @returns User email.
 */
function computeEmail(): string {
  return String(route.query.email ?? currentUser.email ?? "");
}

/**
 * Read the bio/description (query param wins, store fallback).
 *
 * @returns User bio.
 */
function computeBio(): string {
  return String(route.query.bio ?? currentUser.description ?? "");
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
/* UserInfoPage styles */
/* Selector: `.cp-info` — page wrapper. */
.cp-info {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Selector: `.cp-info__head` — header card (back + title). */
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

/* Selector: `.cp-info__back` — back button. */
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

/* Selector: `.cp-info__back:hover` — hover lift + highlight border. */
.cp-info__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Selector: `.cp-info__name` — page title. */
.cp-info__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* Selector: `.cp-info__sub` — subtitle line. */
.cp-info__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Selector: `.cp-info__body` — scrollable grid panel. */
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

/* Selector: `.cp-info__card` — info card. */
.cp-info__card {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
}

/* Selector: `.cp-info__card.wide` — wide card spanning both columns. */
.cp-info__card.wide {
  grid-column: 1 / -1;
}

/* Selector: `.cp-info__k` — card key label (uppercase). */
.cp-info__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Selector: `.cp-info__v` — card value. */
.cp-info__v {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.45;
}
</style>
