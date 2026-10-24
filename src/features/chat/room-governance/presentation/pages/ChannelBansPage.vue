<script setup lang="ts">
/**
 * @fileoverview ChannelBansPage.vue
 * @description chat｜页面：ChannelBansPage。
 */

import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import GovernancePageShell from "@/features/chat/room-governance/presentation/components/GovernancePageShell.vue";
import { useChannelBansPage } from "@/features/chat/room-governance/presentation/page-models/useChannelBansPage";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';

const { t } = useI18n();
const {
  channelName,
  bans,
  isLoading,
  pageError,
  addBanDialogVisible,
  selectedUid,
  banDuration,
  banReason,
  durationOptions,
  bannableMembers,
  banCount,
  canOpenAddBanDialog,
  canSubmitAddBan,
  canRemoveBan,
  formatBanUntil,
  openAddBanDialog,
  closeAddBanDialog,
  handleAddBan,
  handleRemoveBan,
  goBack,
} = useChannelBansPage();
</script>

<template>
  <!-- 页面：ChannelBansPage｜职责：频道封禁管理 -->
  <ErrorBoundary>
    <GovernancePageShell
      :channel-name="channelName"
      :subtitle="`${t('channel_bans')} (${banCount})`"
      :is-loading="isLoading"
      :error-message="pageError"
      @back="goBack"
    >
      <template #loading>{{ t("loading") }}</template>
      <template #actions>
          <button class="cp-bans__btn primary" type="button" :disabled="!canOpenAddBanDialog" @click="openAddBanDialog">{{ t("add_ban") }}</button>
      </template>
      <template #default>
        <div v-if="bans.length === 0" class="cp-bans__empty">{{ t("no_bans") }}</div>
        <!-- 封禁行直接落在内容区上，不再叠加分组卡框 -->
        <template v-else>
          <article v-for="b in bans" :key="b.uid" class="cp-banCard">
            <AvatarBadge :name="b.nickname || b.uid" :size="40" />
            <div class="cp-banCard__info">
              <div class="cp-banCard__name">{{ b.nickname || b.uid }}</div>
              <div class="cp-banCard__reason">
                <span class="cp-banCard__label">{{ t("ban_reason") }}:</span>
                {{ b.reason || "—" }}
              </div>
              <div class="cp-banCard__until">{{ t("ban_until") }}: {{ formatBanUntil(b.until) }}</div>
            </div>
            <div class="cp-banCard__actions">
              <button v-if="canRemoveBan" class="cp-banCard__btn" type="button" @click="handleRemoveBan(b.uid)">
                {{ t("remove_ban") }}
              </button>
            </div>
          </article>
        </template>
      </template>
    </GovernancePageShell>

    <!-- Add Ban Dialog -->
    <t-dialog v-model:visible="addBanDialogVisible" :header="t('add_ban')" :footer="false">
      <div class="cp-addBan">
        <div class="cp-addBan__field">
          <label class="cp-addBan__label">{{ t("select_user") }}</label>
          <t-select v-model="selectedUid" :placeholder="t('select_user')">
            <t-option v-for="m in bannableMembers" :key="m.uid" :value="m.uid" :label="m.nickname" />
          </t-select>
        </div>
        <div class="cp-addBan__field">
          <label class="cp-addBan__label">{{ t("ban_duration") }}</label>
          <t-select v-model="banDuration">
            <t-option v-for="d in durationOptions" :key="d.value" :value="d.value" :label="t(d.label)" />
          </t-select>
        </div>
        <div class="cp-addBan__field">
          <label class="cp-addBan__label">{{ t("ban_reason") }}</label>
          <t-textarea v-model="banReason" :placeholder="t('ban_reason')" :autosize="{ minRows: 2, maxRows: 4 }" />
        </div>
        <div class="cp-addBan__actions">
          <button class="cp-addBan__btn" type="button" @click="closeAddBanDialog">{{ t("cancel") }}</button>
          <button class="cp-addBan__btn primary" type="button" :disabled="!canSubmitAddBan" @click="handleAddBan">{{ t("confirm") }}</button>
        </div>
      </div>
    </t-dialog>
  </ErrorBoundary>
</template>

<style scoped lang="scss">
/* 样式：ChannelBansPage｜规格：分组行（容器 + 分隔线 + hover）+ 胶囊按钮 */
.cp-bans__btn {
  @include cp-pill-button;
}

/* 新增封禁为主操作：highlight */
.cp-bans__btn.primary {
  @include cp-pill-button(primary);
}

/* 封禁行：分组容器内的一行；行间不画分隔线 */
.cp-banCard {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 8px 10px;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

/* 行 hover 只变底色，不做位移 */
.cp-banCard:hover {
  background: var(--cp-hover-bg);
}

.cp-banCard__info {
  min-width: 0;
}

.cp-banCard__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--cp-text);
}

.cp-banCard__reason {
  margin-top: 4px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.4;
}

.cp-banCard__label {
  color: var(--cp-text-muted);
}

.cp-banCard__until {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-banCard__btn {
  @include cp-pill-button;
}

.cp-bans__empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--cp-text-muted);
}

/* 新增封禁表单：字段标签 + 胶囊操作 */
.cp-addBan {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cp-addBan__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-addBan__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

.cp-addBan__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cp-addBan__btn {
  @include cp-pill-button;
}

.cp-addBan__btn.primary {
  @include cp-pill-button(primary);
}
</style>
