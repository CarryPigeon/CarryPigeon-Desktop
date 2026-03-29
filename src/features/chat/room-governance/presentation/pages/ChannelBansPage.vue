<script setup lang="ts">
/**
 * @fileoverview ChannelBansPage.vue
 * @description chat｜页面：ChannelBansPage。
 */

import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import GovernancePageShell from "@/features/chat/room-governance/presentation/components/GovernancePageShell.vue";
import { useChannelBansPage } from "@/features/chat/room-governance/presentation/composables/useChannelBansPage";

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
  <GovernancePageShell
    :channel-name="channelName"
    :subtitle="`${t('channel_bans')} (${banCount})`"
    :is-loading="isLoading"
    :error-message="pageError"
    @back="goBack"
  >
    <template #back-label>{{ t("back") }}</template>
    <template #loading>{{ t("loading") }}</template>
    <template #actions>
        <button class="cp-bans__btn primary" type="button" :disabled="!canOpenAddBanDialog" @click="openAddBanDialog">{{ t("add_ban") }}</button>
    </template>
    <template #default>
      <div v-if="bans.length === 0" class="cp-bans__empty">{{ t("no_bans") }}</div>
      <div v-for="b in bans" :key="b.uid" class="cp-banCard">
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
          <button class="cp-banCard__btn" type="button" @click="handleRemoveBan(b.uid)">
            {{ t("remove_ban") }}
          </button>
        </div>
      </div>
    </template>

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
  </GovernancePageShell>
</template>

<style scoped lang="scss">
.cp-bans__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-bans__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-bans__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-banCard {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.cp-banCard__info {
  min-width: 0;
}

.cp-banCard__name {
  font-size: 14px;
  color: var(--cp-text);
  font-weight: 500;
}

.cp-banCard__reason {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.4;
}

.cp-banCard__label {
  color: var(--cp-text-muted);
}

.cp-banCard__until {
  margin-top: 6px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-banCard__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-banCard__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-bans__empty {
  padding: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--cp-text-muted);
}

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
  font-size: 12px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-addBan__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cp-addBan__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-addBan__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-addBan__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-addBan__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
