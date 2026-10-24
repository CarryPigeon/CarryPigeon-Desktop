<script setup lang="ts">
/**
 * @fileoverview JoinApplicationsPage.vue
 * @description chat｜页面：JoinApplicationsPage。
 */

import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import GovernancePageShell from "@/features/chat/room-governance/presentation/components/GovernancePageShell.vue";
import { useJoinApplicationsPage } from "@/features/chat/room-governance/presentation/page-models/useJoinApplicationsPage";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';

const { t } = useI18n();
const {
  channelName,
  pendingApplications,
  isLoading,
  pageError,
  pendingCount,
  canDecide,
  formatApplyTime,
  handleDecide,
  goBack,
} = useJoinApplicationsPage();
</script>

<template>
  <!-- 页面：JoinApplicationsPage｜职责：入群申请管理 -->
  <ErrorBoundary>
    <GovernancePageShell
      :channel-name="channelName"
      :subtitle="`${t('join_applications')} (${pendingCount})`"
      :is-loading="isLoading"
      :error-message="pageError"
      @back="goBack"
    >
      <template #loading>{{ t("loading") }}</template>
      <template #default>
        <div v-if="pendingApplications.length === 0" class="cp-apps__empty">{{ t("no_applications") }}</div>
        <!-- 申请行直接落在内容区上，不再叠加分组卡框 -->
        <template v-else>
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
            <div v-if="canDecide" class="cp-appCard__actions">
              <button class="cp-appCard__btn approve" type="button" @click="handleDecide(a.applicationId, true)">
                {{ t("approve") }}
              </button>
              <button class="cp-appCard__btn reject" type="button" @click="handleDecide(a.applicationId, false)">
                {{ t("reject") }}
              </button>
            </div>
          </div>
        </template>
      </template>
    </GovernancePageShell>
  </ErrorBoundary>
</template>

<style scoped lang="scss">
/* 样式：JoinApplicationsPage｜规格：工作台紧凑分组行（无分隔线 + hover）+ 胶囊按钮 */
/* 申请行：分组容器内的一行；行间不画分隔线 */
.cp-appCard {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 8px 10px;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

/* 行 hover 只变底色，不做位移 */
.cp-appCard:hover {
  background: var(--cp-hover-bg);
}

.cp-appCard__info {
  min-width: 0;
}

.cp-appCard__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--cp-text);
}

.cp-appCard__reason {
  margin-top: 4px;
  font-size: 12px;
  color: var(--cp-text);
  line-height: 1.4;
}

.cp-appCard__label {
  color: var(--cp-text-muted);
}

.cp-appCard__time {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-appCard__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-appCard__btn {
  @include cp-pill-button;
}

/* 通过 = 授予访问（accent）；拒绝 = danger */
.cp-appCard__btn.approve {
  border-color: color-mix(in oklab, var(--cp-accent) 40%, var(--cp-border));
  background: var(--cp-accent-soft);
}

.cp-appCard__btn.approve:hover {
  border-color: color-mix(in oklab, var(--cp-accent) 58%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 20%, transparent);
}

.cp-appCard__btn.reject {
  @include cp-pill-button(danger);
}

.cp-apps__empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--cp-text-muted);
}
</style>
