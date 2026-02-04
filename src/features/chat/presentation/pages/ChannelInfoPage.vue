
<script setup lang="ts">
/**
 * @fileoverview ChannelInfoPage.vue
 * @description Channel info window/page for UI preview (view + edit mock metadata).
 *
 * PRD mapping:
 * - P0-C2 频道资料：owner 可更新频道资料（name/brief/avatar）——此页提供 name/brief 的 mock 编辑入口。
 */

import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { allChannels, applyJoin, channelTab, selectChannel, updateChannelMeta } from "@/features/chat/presentation/store/chatStore";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

/**
 * Read channel id from query params.
 *
 * @returns Channel id.
 */
function computeChannelId(): string {
  return String(route.query.id ?? "").trim();
}

const channelId = computed(computeChannelId);

/**
 * Find a channel record in the mock store by id.
 *
 * @param id - Channel id.
 * @returns Channel when found, otherwise `null`.
 */
function findChannelById(id: string) {
  for (const c of allChannels.value) {
    if (c.id === id) return c;
  }
  return null;
}

/**
 * Resolve the current channel model.
 *
 * @returns Channel model, or `null` when not found.
 */
function computeChannel() {
  return findChannelById(channelId.value);
}

const channel = computed(computeChannel);

/**
 * Compute display name for this page (channel store wins over query fallback).
 *
 * @returns Channel display name.
 */
function computeName(): string {
  return channel.value?.name ?? String(route.query.name ?? "Channel");
}

/**
 * Compute brief/description for this page (channel store wins over query fallback).
 *
 * @returns Channel brief string.
 */
function computeBrief(): string {
  return channel.value?.brief ?? String(route.query.bio ?? route.query.description ?? "");
}

const name = computed(computeName);
const brief = computed(computeBrief);

const editing = ref(false);
const draftName = ref("");
const draftBrief = ref("");

/**
 * Enter edit mode and initialize drafts from current values.
 */
function beginEdit(): void {
  editing.value = true;
  draftName.value = name.value;
  draftBrief.value = brief.value;
}

/**
 * Exit edit mode without saving changes.
 */
function cancelEdit(): void {
  editing.value = false;
}

/**
 * Save channel metadata into the mock store.
 */
function saveEdit(): void {
  if (!channelId.value) return;
  updateChannelMeta(channelId.value, { name: draftName.value, brief: draftBrief.value });
  editing.value = false;
}

/**
 * Apply/join the current channel when it is discoverable.
 */
function handleJoin(): void {
  if (!channelId.value) return;
  applyJoin(channelId.value);
}

/**
 * Open Patchbay and focus the current channel.
 *
 * If the user is not yet joined, this simply navigates to Patchbay and lets
 * the user join from the Discover tab.
 */
function openInPatchbay(): void {
  if (channel.value?.joined) {
    selectChannel(channel.value.id);
    void router.push("/chat");
    return;
  }
  channelTab.value = "discover";
  void router.push("/chat");
}

/**
 * Watch-source: channel id.
 *
 * @returns Current channel id.
 */
function watchChannelId(): string {
  return channelId.value;
}

/**
 * Reset editing state when switching channels.
 *
 * @returns void
 */
function handleChannelIdChange(): void {
  editing.value = false;
}

watch(
  watchChannelId,
  handleChannelIdChange,
);
</script>

<template>
  <!-- 页面：ChannelInfoPage｜职责：频道信息展示/编辑（mock）｜交互：编辑保存、申请加入、跳转回插线板 -->
  <!-- 区块：<main> .cp-info -->
  <main class="cp-info">
    <header class="cp-info__head">
      <button class="cp-info__back" type="button" @click="router.back()">Back</button>
      <div class="cp-info__title">
        <div class="cp-info__name">{{ name }}</div>
        <div class="cp-info__sub">Channel</div>
      </div>
      <div class="cp-info__headRight">
        <button class="cp-info__btn" type="button" @click="openInPatchbay">{{ t("back_to_patchbay") }}</button>
      </div>
    </header>

    <section class="cp-info__body">
      <div class="cp-info__card">
        <div class="cp-info__k">channel_id</div>
        <div class="cp-info__v"><MonoTag :value="channelId || '—'" :copyable="true" /></div>
      </div>
      <div class="cp-info__card wide">
        <div class="cp-info__k">{{ t("channel_brief") }}</div>
        <div v-if="!editing" class="cp-info__v">{{ brief || t("channel_brief_placeholder") }}</div>
        <div v-else class="cp-info__edit">
          <div class="cp-info__editField">
            <div class="cp-info__editLabel">name</div>
            <t-input v-model="draftName" clearable />
          </div>
          <div class="cp-info__editField">
            <div class="cp-info__editLabel">brief</div>
            <t-textarea v-model="draftBrief" :autosize="{ minRows: 3, maxRows: 6 }" />
          </div>
          <div class="cp-info__editActions">
            <button class="cp-info__btn primary" type="button" @click="saveEdit">{{ t("save") }}</button>
            <button class="cp-info__btn" type="button" @click="cancelEdit">{{ t("cancel") }}</button>
          </div>
        </div>
      </div>
      <div class="cp-info__card wide">
        <div class="cp-info__k">membership</div>
        <div class="cp-info__v">
          <span class="cp-info__pill" :data-ok="Boolean(channel?.joined)">{{ channel?.joined ? "joined" : "not joined" }}</span>
          <button v-if="channel && !channel.joined" class="cp-info__btn primary" type="button" :disabled="channel.joinRequested" @click="handleJoin">
            {{ channel.joinRequested ? t("channel_join_request_sent") : t("apply_join") }}
          </button>
          <button v-if="channel && channel.joined" class="cp-info__btn" type="button" @click="beginEdit">{{ t("edit") }}</button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* ChannelInfoPage styles */
/* Page wrapper */
.cp-info {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Header card */
.cp-info__head {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

/* Header right action area */
.cp-info__headRight {
  display: flex;
  justify-content: flex-end;
}

/* Back button */
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

/* Back hover */
.cp-info__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Channel name */
.cp-info__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* Subtitle */
.cp-info__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Body grid */
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

/* Info card */
.cp-info__card {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
}

/* Full-width card */
.cp-info__card.wide {
  grid-column: 1 / -1;
}

/* Card label */
.cp-info__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Card value */
.cp-info__v {
  margin-top: 10px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.45;
}

/* Edit mode wrapper */
.cp-info__edit {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Edit field wrapper */
.cp-info__editField {
  min-width: 0;
}

/* Edit label */
.cp-info__editLabel {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Edit actions row */
.cp-info__editActions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

/* Button */
.cp-info__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Button hover */
.cp-info__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Primary button */
.cp-info__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

/* Disabled button */
.cp-info__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Membership pill */
.cp-info__pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-family: var(--cp-font-mono);
  margin-right: 10px;
}

/* Membership pill variant: joined */
.cp-info__pill[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel-muted));
  color: var(--cp-text);
}
</style>
