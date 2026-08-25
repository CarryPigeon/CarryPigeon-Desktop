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
      <template #back-label>{{ t("back") }}</template>
      <template #loading>{{ t("loading") }}</template>
      <template #actions>
        <div class="cp-audit__filters">
          <select v-model="actionFilter" class="cp-audit__select" :aria-label="t('audit_filter_action')">
            <option value="">{{ t("audit_action_all") }}</option>
            <option v-for="action in actionOptions" :key="action" :value="action">
              {{ actionLabel(action) }}
            </option>
          </select>
          <input
            v-model="actorFilter"
            class="cp-audit__input"
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
        <article v-for="item in items" :key="item.auditId" class="cp-auditCard">
          <div class="cp-auditCard__head">
            <div class="cp-auditCard__action">{{ actionLabel(item.action) }}</div>
            <div class="cp-auditCard__time">{{ formatTime(item.createdAt) }}</div>
          </div>
          <div class="cp-auditCard__meta">{{ t("audit_actor") }}: {{ item.actorUserId || "—" }}</div>
          <pre class="cp-auditCard__details">{{ formatDetails(item.details) }}</pre>
        </article>
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
.cp-audit__empty {
  padding: 24px;
  text-align: center;
  color: var(--cp-text-muted);
}

.cp-auditCard {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-auditCard__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
}

.cp-auditCard__action {
  font-size: 14px;
  font-weight: 600;
  color: var(--cp-text);
}

.cp-auditCard__time,
.cp-auditCard__meta {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-auditCard__details {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--cp-text-secondary);
}

.cp-audit__more {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  align-self: center;
}

.cp-audit__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.cp-audit__select,
.cp-audit__input {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  color: var(--cp-text);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
}

.cp-audit__input {
  min-width: 140px;
}

.cp-audit__apply {
  border: 1px solid var(--cp-accent);
  background: var(--cp-accent);
  color: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}
</style>
