/**
 * @fileoverview 入群申请管理页编排。
 * @description chat/room-governance｜presentation composable：收敛申请列表加载、过滤与审批动作。
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getRoomGovernanceCapabilities, type ChannelApplication } from "@/features/chat/room-governance/api";
import { useChannelScopedRefresh } from "@/features/chat/presentation/composables/useChannelScopedRefresh";
import { useGovernanceChannelPageRoute } from "./useGovernanceChannelPageRoute";
import { useGovernancePageState } from "./useGovernancePageState";

const roomGovernanceCapabilities = getRoomGovernanceCapabilities();

export type JoinApplicationsPageModel = {
  channelName: ComputedRef<string>;
  pendingApplications: ComputedRef<ChannelApplication[]>;
  isLoading: Ref<boolean>;
  pageError: Ref<string>;
  pendingCount: ComputedRef<number>;
  formatApplyTime(applyTimeMs: number): string;
  handleDecide(applicationId: string, approved: boolean): Promise<void>;
  goBack(): void;
};

/**
 * 创建入群申请页视图模型。
 *
 * @returns 入群申请页状态与动作。
 */
export function useJoinApplicationsPage(): JoinApplicationsPageModel {
  const router = useRouter();
  const { t } = useI18n();
  const { channelId, requestedChannelName } = useGovernanceChannelPageRoute();

  const applications = ref<ChannelApplication[]>([]);
  const { isLoading, pageError, runPageLoad, runChannelAction } = useGovernancePageState({
    channelId,
    onMissingChannel: () => {
      applications.value = [];
    },
  });

  const channelName = computed(() => requestedChannelName.value || t("join_applications"));
  const pendingApplications = computed(() => applications.value.filter((application) => application.status === "pending"));
  const pendingCount = computed(() => pendingApplications.value.length);

  function formatApplyTime(applyTimeMs: number): string {
    if (!applyTimeMs) return "—";
    return new Date(applyTimeMs).toLocaleString();
  }

  async function loadApplications(): Promise<void> {
    await runPageLoad((channelId) => roomGovernanceCapabilities.forChannel(channelId).listApplications(), (nextApplications) => {
      applications.value = nextApplications;
    });
  }

  async function handleDecide(applicationId: string, approved: boolean): Promise<void> {
    await runChannelAction(
      (channelId) => roomGovernanceCapabilities.forChannel(channelId).decideApplication(applicationId, approved),
      loadApplications,
    );
  }

  function goBack(): void {
    router.back();
  }

  useChannelScopedRefresh({
    channelId,
    projection: "applications",
    refresh: loadApplications,
  });

  return {
    channelName,
    pendingApplications,
    isLoading,
    pageError,
    pendingCount,
    formatApplyTime,
    handleDecide,
    goBack,
  };
}
