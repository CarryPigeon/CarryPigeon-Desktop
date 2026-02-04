<script setup lang="ts">
/**
 * @fileoverview ChannelPopoverPage.vue
 * @description Lightweight popover window for channel info (minimal for preview).
 */

import { computed } from "vue";
import { useRoute } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";

const route = useRoute();

/**
 * Read the channel display name from query params.
 *
 * @returns Channel name string.
 */
function computeName(): string {
  return String(route.query.name ?? "Channel");
}

/**
 * Read the channel bio/description from query params.
 *
 * @returns Channel bio string (may be empty).
 */
function computeBio(): string {
  return String(route.query.bio ?? route.query.description ?? "");
}

/**
 * Read the channel owner label from query params.
 *
 * @returns Owner display string.
 */
function computeOwner(): string {
  return String(route.query.owner ?? "—");
}

const name = computed(computeName);
const bio = computed(computeBio);
const owner = computed(computeOwner);
</script>

<template>
  <!-- 页面：ChannelPopoverPage｜职责：频道信息 Popover -->
  <!-- 区块：<main> .cp-pop -->
  <main class="cp-pop">
    <div class="cp-pop__title">{{ name }}</div>
    <div class="cp-pop__row"><MonoTag :value="owner" :copyable="true" title="owner" /></div>
    <div class="cp-pop__bio">{{ bio || "—" }}</div>
  </main>
</template>

<style scoped lang="scss">
/* ChannelPopoverPage styles */
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
