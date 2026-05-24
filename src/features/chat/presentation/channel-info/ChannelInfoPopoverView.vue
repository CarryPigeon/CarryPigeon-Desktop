<script setup lang="ts">
/**
 * @fileoverview ChannelInfoPopoverView.vue
 * @description chat｜视图：ChannelInfoPopoverView。
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

/**
 * 从 query 参数中读取频道公告。
 *
 * @returns 公告内容字符串。
 */
function computeAnnouncement(): string {
  return String(route.query.announcement ?? "");
}

const name = computed(computeName);
const bio = computed(computeBio);
const owner = computed(computeOwner);
const announcement = computed(computeAnnouncement);
</script>

<template>
  <!-- 视图：ChannelInfoPopoverView｜职责：频道信息 Popover -->
  <!-- 区块：<main> .cp-pop -->
  <main class="cp-pop">
    <div class="cp-pop__title">{{ name }}</div>
    <div class="cp-pop__row"><MonoTag :value="owner" :copyable="true" title="owner" /></div>
    <div class="cp-pop__bio">{{ bio || "—" }}</div>
    <div v-if="announcement" class="cp-pop__announcement">
      <div class="cp-pop__label">Announcement</div>
      <div class="cp-pop__anncText">{{ announcement }}</div>
    </div>
  </main>
</template>

<style scoped lang="scss">
/* ChannelInfoPopoverView styles */
/* Selector: `.cp-pop` — popover page surface. */
.cp-pop {
  height: 100%;
  padding: 12px;
  background: var(--cp-surface);
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  border: 1px solid var(--cp-border);
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

/* Selector: `.cp-pop__announcement` — announcement section. */
.cp-pop__announcement {
  margin-top: 10px;
}

/* Selector: `.cp-pop__label` — announcement label. */
.cp-pop__label {
  font-size: 11px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Selector: `.cp-pop__anncText` — announcement text. */
.cp-pop__anncText {
  margin-top: 4px;
  font-size: 12px;
  color: var(--cp-text);
}
</style>
