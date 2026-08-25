/**
 * @fileoverview 频道审计日志页编排。
 * @description 按当前频道 cid 调用 GET /api/audit_logs。
 */

import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getAuditLogCapabilities } from "@/features/chat/audit-logs/api";
import { AuditActions, type AuditLogItem, type ChatAuditLogCapabilities } from "@/features/chat/audit-logs/api-types";
import { isSnowflakeId } from "@/shared/utils/snowflakeId";
import { useGovernanceChannelPageRoute } from "@/features/chat/room-governance/presentation/page-support/useGovernanceChannelPageRoute";
import { useGovernancePageState } from "@/features/chat/room-governance/presentation/page-support/useGovernancePageState";

const PAGE_LIMIT = 50;

export type ChannelAuditLogsPageModel = ReturnType<typeof useChannelAuditLogsPage>;

export type ChannelAuditLogsPageDeps = {
  auditLogs: ChatAuditLogCapabilities;
};

function createDefaultDeps(): ChannelAuditLogsPageDeps {
  return { auditLogs: getAuditLogCapabilities() };
}

/**
 * 创建审计日志页视图模型。
 */
export function useChannelAuditLogsPage(deps: ChannelAuditLogsPageDeps = createDefaultDeps()) {
  const router = useRouter();
  const { t, te } = useI18n();
  const { channelId, requestedChannelName } = useGovernanceChannelPageRoute();
  const items = ref<AuditLogItem[]>([]);
  const nextCursor = ref<string | undefined>(undefined);
  const hasMore = ref(false);
  const loadingMore = ref(false);
  const actionFilter = ref("");
  const actorFilter = ref("");
  const { isLoading, pageError, runPageLoad } = useGovernancePageState({
    channelId,
    onMissingChannel: () => {
      items.value = [];
      nextCursor.value = undefined;
      hasMore.value = false;
    },
  });

  const channelName = computed(() => requestedChannelName.value || t("audit_logs"));
  const itemCount = computed(() => items.value.length);

  function actionLabel(action: string): string {
    const key = `audit_action_${action.replace(/\./g, "_")}`;
    return te(key) ? t(key) : action;
  }

  function formatTime(createdAt: number): string {
    if (!createdAt) return "—";
    return new Date(createdAt).toLocaleString();
  }

  function formatDetails(details: unknown): string {
    if (details == null || details === "") return "—";
    if (typeof details === "string") {
      try {
        return JSON.stringify(JSON.parse(details), null, 2);
      } catch {
        return details;
      }
    }
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  }

  async function loadFirstPage(): Promise<void> {
    const actorUserId = actorFilter.value.trim();
    if (actorUserId && !isSnowflakeId(actorUserId)) {
      pageError.value = t("audit_filter_actor_invalid");
      return;
    }
    const action = actionFilter.value.trim();
    await runPageLoad(
      (cid) => deps.auditLogs.listAuditLogs({
        channelId: cid,
        limit: PAGE_LIMIT,
        ...(actorUserId ? { actorUserId } : {}),
        ...(action ? { action } : {}),
      }),
      (page) => {
        items.value = page.items;
        nextCursor.value = page.nextCursor;
        hasMore.value = Boolean(page.hasMore);
      },
    );
  }

  async function applyFilters(): Promise<void> {
    await loadFirstPage();
  }

  async function loadMore(): Promise<void> {
    const cid = channelId.value.trim();
    if (!cid || !hasMore.value || !nextCursor.value || loadingMore.value) return;
    loadingMore.value = true;
    try {
      const page = await deps.auditLogs.listAuditLogs({
        channelId: cid,
        cursor: nextCursor.value,
        limit: PAGE_LIMIT,
        ...(actorFilter.value.trim() ? { actorUserId: actorFilter.value.trim() } : {}),
        ...(actionFilter.value.trim() ? { action: actionFilter.value.trim() } : {}),
      });
      items.value = [...items.value, ...page.items];
      nextCursor.value = page.nextCursor;
      hasMore.value = Boolean(page.hasMore);
    } catch (error) {
      pageError.value = error instanceof Error ? error.message : String(error);
    } finally {
      loadingMore.value = false;
    }
  }

  function goBack(): void {
    router.back();
  }

  onMounted(() => {
    void loadFirstPage();
  });

  return {
    channelName,
    items,
    isLoading,
    pageError,
    itemCount,
    hasMore,
    loadingMore,
    actionFilter,
    actorFilter,
    actionOptions: AuditActions,
    actionLabel,
    formatTime,
    formatDetails,
    loadMore,
    applyFilters,
    goBack,
  };
}
