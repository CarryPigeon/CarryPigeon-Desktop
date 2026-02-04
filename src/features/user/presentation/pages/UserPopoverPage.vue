<script setup lang="ts">
/**
 * @fileoverview UserPopoverPage.vue
 * @description Lightweight popover window for user info (minimal for preview).
 */

import { computed } from "vue";
import { useRoute } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";

const route = useRoute();

/**
 * Read user display name from query params.
 *
 * @returns Name string.
 */
function computeName(): string {
  return String(route.query.name ?? "");
}

/**
 * Read user email from query params.
 *
 * @returns Email string.
 */
function computeEmail(): string {
  return String(route.query.email ?? "");
}

/**
 * Read user bio from query params.
 *
 * @returns Bio string.
 */
function computeBio(): string {
  return String(route.query.bio ?? "");
}

const name = computed(computeName);
const email = computed(computeEmail);
const bio = computed(computeBio);
</script>

<template>
  <!-- 页面：UserPopoverPage｜职责：用户信息 Popover -->
  <!-- 区块：<main> .cp-pop -->
  <main class="cp-pop">
    <div class="cp-pop__title">{{ name || "User" }}</div>
    <div class="cp-pop__row"><MonoTag :value="email || '—'" :copyable="true" /></div>
    <div class="cp-pop__bio">{{ bio || "—" }}</div>
  </main>
</template>

<style scoped lang="scss">
/* UserPopoverPage styles */
/* Selector: `.cp-pop` — popover page surface. */
.cp-pop {
  height: 100%;
  padding: 12px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
}

/* Selector: `.cp-pop__title` — title line. */
.cp-pop__title {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 16px;
  color: var(--cp-text);
}

/* Selector: `.cp-pop__row` — metadata row wrapper. */
.cp-pop__row {
  margin-top: 10px;
}

/* Selector: `.cp-pop__bio` — bio paragraph. */
.cp-pop__bio {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.45;
}
</style>
