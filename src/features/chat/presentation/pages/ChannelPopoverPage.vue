<script setup lang="ts">
/**
 * @fileoverview ChannelPopoverPage.vue
 * @description chat｜页面：ChannelPopoverPage。
 */

import { computed } from "vue";
import { useRoute } from "vue-router";
import MonoTag from "@/shared/ui/MonoTag.vue";

const route = useRoute();

/**
 * 从 query 参数中读取频道显示名。
 *
 * @returns 频道名称字符串。
 */
function computeName(): string {
  return String(route.query.name ?? "Channel");
}

/**
 * 从 query 参数中读取频道简介/描述。
 *
 * @returns 频道简介字符串（可能为空）。
 */
function computeBio(): string {
  return String(route.query.bio ?? route.query.description ?? "");
}

/**
 * 从 query 参数中读取频道 owner 标识。
 *
 * @returns owner 显示字符串。
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
