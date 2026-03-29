<script setup lang="ts">
/**
 * @fileoverview JoinApplicationsPage.vue
 * @description chat｜页面：JoinApplicationsPage。
 */

import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import GovernancePageShell from "@/features/chat/room-governance/presentation/components/GovernancePageShell.vue";
import { useJoinApplicationsPage } from "@/features/chat/room-governance/presentation/composables/useJoinApplicationsPage";

const { t } = useI18n();
const {
  channelName,
  pendingApplications,
  isLoading,
  pageError,
  pendingCount,
  formatApplyTime,
  handleDecide,
  goBack,
} = useJoinApplicationsPage();
</script>

<template>
  <!-- 页面：JoinApplicationsPage｜职责：入群申请管理 -->
  <GovernancePageShell
    :channel-name="channelName"
    :subtitle="`${t('join_applications')} (${pendingCount})`"
    :is-loading="isLoading"
    :error-message="pageError"
    @back="goBack"
  >
    <template #back-label>{{ t("back") }}</template>
    <template #loading>{{ t("loading") }}</template>
    <template #default>
      <div v-if="pendingApplications.length === 0" class="cp-apps__empty">{{ t("no_applications") }}</div>
      <div v-for="a in pendingApplications" :key="a.applicationId" class="cp-appCard">
        <AvatarBadge :name="a.nickname || a.uid" :size="40" />
        <div class="cp-appCard__info">
          <div class="cp-appCard__name">{{ a.nickname || a.uid }}</div>
          <div class="cp-appCard__reason">
            <span class="cp-appCard__label">{{ t("application_reason") }}:</span>
            {{ a.reason || "—" }}
          </div>
          <div class="cp-appCard__time">{{ t("applied_at") }}: {{ formatApplyTime(a.applyTime) }}</div>
        </div>
        <div class="cp-appCard__actions">
          <button class="cp-appCard__btn approve" type="button" @click="handleDecide(a.applicationId, true)">
            {{ t("approve") }}
          </button>
          <button class="cp-appCard__btn reject" type="button" @click="handleDecide(a.applicationId, false)">
            {{ t("reject") }}
          </button>
        </div>
      </div>
    </template>
  </GovernancePageShell>
</template>

<style scoped lang="scss">
.cp-appCard {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: start;
}

.cp-appCard__info {
  min-width: 0;
}

.cp-appCard__name {
  font-size: 14px;
  color: var(--cp-text);
  font-weight: 500;
}

.cp-appCard__reason {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.4;
}

.cp-appCard__label {
  color: var(--cp-text-muted);
}

.cp-appCard__time {
  margin-top: 6px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-appCard__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-appCard__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-appCard__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-appCard__btn.approve {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 10%, var(--cp-panel-muted));
}

.cp-appCard__btn.approve:hover {
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}

.cp-appCard__btn.reject {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}

.cp-appCard__btn.reject:hover {
  background: color-mix(in oklab, var(--cp-danger) 18%, var(--cp-hover-bg));
}

.cp-apps__empty {
  padding: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--cp-text-muted);
}
</style>
