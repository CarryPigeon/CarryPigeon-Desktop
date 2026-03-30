
<script setup lang="ts">
/**
 * @fileoverview ChannelInfoPage.vue
 * @description chat｜页面：ChannelInfoPage。
 *
 * PRD 对照：
 * - P0-C2 频道资料：owner 可更新频道资料（name/brief/avatar）——此页提供 name/brief 的 mock 编辑入口。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { useChannelInfoPage } from "@/features/chat/presentation/channel-info/useChannelInfoPage";

const { t } = useI18n();
const {
  channelId,
  channelName,
  channelBrief,
  membershipStatus,
  isEditing,
  isRequestingJoin,
  isSavingMeta,
  actionError,
  draftChannelName,
  draftChannelBrief,
  joinRequested,
  canRequestJoin,
  mayEditChannelMeta,
  beginEdit,
  cancelEdit,
  saveEdit,
  handleJoin,
  openInPatchbay,
  goBack,
} = useChannelInfoPage();

const membershipStatusText = computed(() => (membershipStatus.value === "joined" ? "joined" : "not joined"));
</script>

<template>
  <!-- 页面：ChannelInfoPage｜职责：频道信息展示/编辑（mock）｜交互：编辑保存、申请加入、跳转回插线板 -->
  <!-- 区块：<main> .cp-info -->
  <main class="cp-info">
    <header class="cp-info__head">
      <button class="cp-info__back" type="button" @click="goBack">Back</button>
      <div class="cp-info__title">
        <div class="cp-info__name">{{ channelName }}</div>
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
        <div v-if="!isEditing" class="cp-info__v">{{ channelBrief || t("channel_brief_placeholder") }}</div>
        <div v-else class="cp-info__edit">
          <div class="cp-info__editField">
            <div class="cp-info__editLabel">name</div>
            <t-input v-model="draftChannelName" clearable />
          </div>
          <div class="cp-info__editField">
            <div class="cp-info__editLabel">brief</div>
            <t-textarea v-model="draftChannelBrief" :autosize="{ minRows: 3, maxRows: 6 }" />
          </div>
          <div v-if="actionError" class="cp-info__error">{{ actionError }}</div>
          <div class="cp-info__editActions">
            <button class="cp-info__btn primary" type="button" :disabled="isSavingMeta" @click="saveEdit">
              {{ isSavingMeta ? t("loading") : t("save") }}
            </button>
            <button class="cp-info__btn" type="button" :disabled="isSavingMeta" @click="cancelEdit">{{ t("cancel") }}</button>
          </div>
        </div>
      </div>
      <div class="cp-info__card wide">
        <div class="cp-info__k">membership</div>
        <div class="cp-info__v">
          <span class="cp-info__pill" :data-ok="membershipStatus === 'joined'">{{ membershipStatusText }}</span>
          <button v-if="canRequestJoin" class="cp-info__btn primary" type="button" :disabled="joinRequested || isRequestingJoin" @click="handleJoin">
            {{ joinRequested ? t("channel_join_request_sent") : isRequestingJoin ? t("loading") : t("apply_join") }}
          </button>
          <button v-if="mayEditChannelMeta" class="cp-info__btn" type="button" @click="beginEdit">{{ t("edit") }}</button>
        </div>
        <div v-if="!isEditing && actionError" class="cp-info__error">{{ actionError }}</div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；主区域为两列网格，部分卡片跨全宽。 */
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
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.cp-info__headRight {
  display: flex;
  justify-content: flex-end;
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

.cp-info__edit {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-info__editField {
  min-width: 0;
}

.cp-info__editLabel {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-info__editActions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.cp-info__error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-danger, #b3261e);
}

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

.cp-info__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-info__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-info__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

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

.cp-info__pill[data-ok="true"] {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel-muted));
  color: var(--cp-text);
}
</style>
