
<script setup lang="ts">
/**
 * @fileoverview ChannelInfoPage.vue
 * @description chat｜页面：ChannelInfoPage。
 *
 * PRD 对照：
 * - P0-C2 频道资料：owner 可更新频道资料（name/brief/avatar）——非 mock 环境下通过后端成员角色判断展示 name/brief 编辑入口。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import PageHeader from "@/shared/ui/PageHeader.vue";
import { useChannelInfoPage } from "@/features/chat/presentation/channel-info/useChannelInfoPage";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';

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
  goBack,
} = useChannelInfoPage();

const membershipStatusText = computed(() =>
  membershipStatus.value === "joined" ? t("membership_joined") : t("membership_not_joined"),
);
</script>

<template>
  <!-- 页面：ChannelInfoPage｜职责：频道信息展示/编辑（mock）｜交互：编辑保存、申请加入、跳转回枢纽 -->
  <!-- 区块：<main> .cp-info -->
  <main class="cp-info">
    <ErrorBoundary>
      <!-- 区块：页面头部｜用途：返回 + 频道名 + 「频道」副标题（保留 channel-info-back 选择器） -->
      <PageHeader
        :title="channelName"
        :subtitle="t('channels')"
        back
        back-test-id="channel-info-back"
        @back="goBack"
      />

      <section class="cp-info__body">
        <div class="cp-info__card">
          <div class="cp-info__k">{{ t("channel_id_label") }}</div>
          <div class="cp-info__v"><MonoTag :value="channelId || '—'" :copyable="true" /></div>
        </div>
        <div class="cp-info__card wide">
          <div class="cp-info__k">{{ t("channel_brief") }}</div>
          <div v-if="!isEditing" class="cp-info__v">{{ channelBrief || t("channel_brief_placeholder") }}</div>
          <div v-else class="cp-info__edit">
            <div class="cp-info__editField">
              <div class="cp-info__editLabel">{{ t("edit_name_label") }}</div>
              <t-input v-model="draftChannelName" clearable />
            </div>
            <div class="cp-info__editField">
              <div class="cp-info__editLabel">{{ t("edit_brief_label") }}</div>
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
          <div class="cp-info__k">{{ t("membership_label") }}</div>
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
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* 样式：ChannelInfoPage｜规格：工作台骨架 + PageHeader + 透明内容区 + cp-card */
/* 布局与变量说明：使用全局 `--cp-*` 变量；内容区为两列网格，部分卡片跨全宽。 */
.cp-info {
  @include cp-workspace;

  overflow: hidden;
}

/* 内容区域：共享玻璃面上的透明网格 */
.cp-info__body {
  @include cp-region;

  flex: 1 1 auto;
  min-height: 0;
  padding: 10px;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

/* 资料卡：内嵌卡片 */
.cp-info__card {
  @include cp-card;

  padding: 12px;
}

.cp-info__card.wide {
  grid-column: 1 / -1;
}

/* 字段标签：本地化文案，不做大写变换 */
.cp-info__k {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

.cp-info__v {
  margin-top: 10px;
  font-size: 13px;
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
  font-weight: 600;
  color: var(--cp-text-muted);
}

.cp-info__editActions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

/* 错误状态条：统一 cp-inline-status */
.cp-info__error {
  @include cp-inline-status(danger);

  margin-top: 6px;
}

/* 按钮：统一胶囊控件 */
.cp-info__btn {
  @include cp-pill-button;
}

/* 保存/申请加入为主操作：highlight */
.cp-info__btn.primary {
  @include cp-pill-button(primary);
}

/* 成员身份状态胶囊：已加入用 accent（连接/开启状态） */
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
  border-color: color-mix(in oklab, var(--cp-accent) 40%, var(--cp-border));
  background: var(--cp-accent-soft);
  color: var(--cp-text);
}
</style>
