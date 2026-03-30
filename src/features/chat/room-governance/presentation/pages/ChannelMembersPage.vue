<script setup lang="ts">
/**
 * @fileoverview ChannelMembersPage.vue
 * @description chat｜页面：ChannelMembersPage。
 */

import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import GovernancePageShell from "@/features/chat/room-governance/presentation/components/GovernancePageShell.vue";
import { useChannelMembersPage } from "@/features/chat/room-governance/presentation/page-models/useChannelMembersPage";

const { t } = useI18n();
const {
  channelName,
  members,
  isLoading,
  pageError,
  memberCount,
  formatJoinTime,
  roleLabel,
  canPromoteMember,
  canDemoteAdmin,
  canKickMember,
  handleKick,
  handleSetAdmin,
  handleRemoveAdmin,
  goBack,
} = useChannelMembersPage();
</script>

<template>
  <!-- 页面：ChannelMembersPage｜职责：频道成员管理 -->
  <GovernancePageShell
    :channel-name="channelName"
    :subtitle="`${t('channel_members')} (${memberCount})`"
    :is-loading="isLoading"
    :error-message="pageError"
    @back="goBack"
  >
    <template #back-label>{{ t("back") }}</template>
    <template #loading>{{ t("loading") }}</template>
    <template #default>
      <div v-for="m in members" :key="m.uid" class="cp-memberCard">
        <AvatarBadge :name="m.nickname" :size="40" />
        <div class="cp-memberCard__info">
          <div class="cp-memberCard__name">{{ m.nickname }}</div>
          <div class="cp-memberCard__role" :data-role="m.role">{{ roleLabel(m.role) }}</div>
          <div class="cp-memberCard__time">{{ t("joined_at") }}: {{ formatJoinTime(m.joinTime) }}</div>
        </div>
        <div class="cp-memberCard__actions">
          <button v-if="canPromoteMember(m)" class="cp-memberCard__btn" type="button" @click="handleSetAdmin(m.uid)">
            {{ t("set_admin") }}
          </button>
          <button v-if="canDemoteAdmin(m)" class="cp-memberCard__btn" type="button" @click="handleRemoveAdmin(m.uid)">
            {{ t("remove_admin") }}
          </button>
          <button v-if="canKickMember(m)" class="cp-memberCard__btn danger" type="button" @click="handleKick(m.uid)">
            {{ t("kick_member") }}
          </button>
        </div>
      </div>
    </template>
  </GovernancePageShell>
</template>

<style scoped lang="scss">
.cp-memberCard {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.cp-memberCard__info {
  min-width: 0;
}

.cp-memberCard__name {
  font-size: 14px;
  color: var(--cp-text);
  font-weight: 500;
}

.cp-memberCard__role {
  margin-top: 4px;
  font-size: 12px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-memberCard__role[data-role="owner"] {
  color: var(--cp-accent);
}

.cp-memberCard__role[data-role="admin"] {
  color: var(--cp-info);
}

.cp-memberCard__time {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-memberCard__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cp-memberCard__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-memberCard__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-memberCard__btn.danger {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}

.cp-memberCard__btn.danger:hover {
  background: color-mix(in oklab, var(--cp-danger) 18%, var(--cp-hover-bg));
}
</style>
