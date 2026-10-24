<script setup lang="ts">
/**
 * @fileoverview ChannelAuditLogsPage.vue
 * @description 频道审计日志治理页。
 */

import { useI18n } from "vue-i18n";
import GovernancePageShell from "@/features/chat/room-governance/presentation/components/GovernancePageShell.vue";
import { useChannelAuditLogsPage } from "@/features/chat/audit-logs/presentation/page-models/useChannelAuditLogsPage";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";

const { t } = useI18n();
const {
  channelName,
  items,
  isLoading,
  pageError,
  itemCount,
  hasMore,
  loadingMore,
  actionFilter,
  actorFilter,
  actionOptions,
  actionLabel,
  formatTime,
  formatDetails,
  loadMore,
  applyFilters,
  goBack,
} = useChannelAuditLogsPage();
</script>

<template>
  <ErrorBoundary>
    <GovernancePageShell
      :channel-name="channelName"
      :subtitle="`${t('audit_logs')} (${itemCount})`"
      :is-loading="isLoading"
      :error-message="pageError"
      @back="goBack"
    >
      <template #loading>{{ t("loading") }}</template>
      <template #actions>
        <!-- 筛选字段化：原生字段使用全局 .cp-field 规格 -->
        <div class="cp-audit__filters">
          <select v-model="actionFilter" class="cp-audit__select cp-field" :aria-label="t('audit_filter_action')">
            <option value="">{{ t("audit_action_all") }}</option>
            <option v-for="action in actionOptions" :key="action" :value="action">
              {{ actionLabel(action) }}
            </option>
          </select>
          <input
            v-model="actorFilter"
            class="cp-audit__input cp-field"
            type="text"
            :placeholder="t('audit_filter_actor_placeholder')"
            :aria-label="t('audit_filter_actor')"
            @keydown.enter="applyFilters"
          />
          <button class="cp-audit__apply" type="button" @click="applyFilters">{{ t("audit_filter_apply") }}</button>
        </div>
      </template>
      <template #default>
        <div v-if="items.length === 0" class="cp-audit__empty">{{ t("audit_logs_empty") }}</div>
        <!-- 审计行直接落在内容区上，不再叠加分组卡框 -->
        <template v-else>
          <article v-for="item in items" :key="item.auditId" class="cp-auditCard">
            <div class="cp-auditCard__head">
              <div class="cp-auditCard__action">{{ actionLabel(item.action) }}</div>
              <div class="cp-auditCard__time">{{ formatTime(item.createdAt) }}</div>
            </div>
            <div class="cp-auditCard__meta">{{ t("audit_actor") }}: {{ item.actorUserId || "—" }}</div>
            <pre class="cp-auditCard__details">{{ formatDetails(item.details) }}</pre>
          </article>
        </template>
        <button
          v-if="hasMore"
          class="cp-audit__more"
          type="button"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? t("loading") : t("load_more") }}
        </button>
      </template>
    </GovernancePageShell>
  </ErrorBoundary>
</template>

<style scoped lang="scss">
/* 样式：ChannelAuditLogsPage｜规格：筛选字段化（cp-field）+ 分组行 + 胶囊按钮 */
.cp-audit__empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--cp-text-muted);
}

/* 审计行：分组容器内的一行；行间不画分隔线 */
.cp-auditCard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

/* 行 hover 只变底色，不做位移 */
.cp-auditCard:hover {
  background: var(--cp-hover-bg);
}

.cp-auditCard__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.cp-auditCard__action {
  font-size: 13px;
  font-weight: 600;
  color: var(--cp-text);
}

.cp-auditCard__time,
.cp-auditCard__meta {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* actor 为标识符：等宽字体 */
.cp-auditCard__meta {
  font-family: var(--cp-font-mono);
}

.cp-auditCard__details {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-sm);
  background: var(--cp-panel-muted);
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--cp-text-muted);
}

.cp-audit__more {
  @include cp-pill-button;

  align-self: center;
}

/* 筛选区：字段 + 胶囊应用按钮 */
.cp-audit__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.cp-audit__select,
.cp-audit__input {
  width: auto;
}

.cp-audit__select {
  min-width: 132px;
}

.cp-audit__input {
  width: 168px;
}

.cp-audit__apply {
  @include cp-pill-button(primary);
}
</style>
