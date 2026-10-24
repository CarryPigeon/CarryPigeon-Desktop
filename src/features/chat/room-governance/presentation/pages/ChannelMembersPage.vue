<script setup lang="ts">
/**
 * @fileoverview ChannelMembersPage.vue
 * @description chat｜页面：ChannelMembersPage。
 */

import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import GovernancePageShell from "@/features/chat/room-governance/presentation/components/GovernancePageShell.vue";
import { UserProfilePopover } from "@/features/account/components";
import { useChannelMembersPage } from "@/features/chat/room-governance/presentation/page-models/useChannelMembersPage";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';

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
  <ErrorBoundary>
    <GovernancePageShell
      :channel-name="channelName"
      :subtitle="`${t('channel_members')} (${memberCount})`"
      :is-loading="isLoading"
      :error-message="pageError"
      @back="goBack"
    >
      <template #loading>{{ t("loading") }}</template>
      <template #default>
        <!-- 成员行直接落在内容区上，不再叠加分组卡框 -->
        <div v-for="m in members" :key="m.uid" class="cp-memberCard">
          <UserProfilePopover
            :user-id="m.uid"
            :username="m.nickname"
            trigger="hover"
          >
            <AvatarBadge :name="m.nickname" :size="40" />
          </UserProfilePopover>
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
  </ErrorBoundary>
</template>

<style scoped lang="scss">
/* 样式：ChannelMembersPage｜规格：工作台紧凑分组行（无分隔线 + hover）+ 胶囊按钮 */
/* 成员行：分组容器内的一行；行间不画分隔线 */
.cp-memberCard {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 8px 10px;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

/* 行 hover 只变底色，不做位移 */
.cp-memberCard:hover {
  background: var(--cp-hover-bg);
}

.cp-memberCard__info {
  min-width: 0;
}

.cp-memberCard__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--cp-text);
}

/* 角色标签：状态语义（owner=accent，admin=accent-2） */
.cp-memberCard__role {
  margin-top: 3px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-memberCard__role[data-role="owner"] {
  color: var(--cp-accent);
}

.cp-memberCard__role[data-role="admin"] {
  color: var(--cp-accent-2);
}

.cp-memberCard__time {
  margin-top: 3px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-memberCard__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cp-memberCard__btn {
  @include cp-pill-button;
}

.cp-memberCard__btn.danger {
  @include cp-pill-button(danger);
}
</style>
