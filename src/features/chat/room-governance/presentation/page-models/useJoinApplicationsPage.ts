/**
 * @fileoverview 入群申请管理页编排。
 * @description chat/room-governance｜presentation composable：收敛申请列表加载、过滤与审批动作。
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { currentChatUserId } from "@/features/chat/composition/chatAccountSession";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";
import type { ChannelApplication, ChannelMember, RoomGovernanceCapabilities } from "@/features/chat/room-governance/api-types";
import { useChannelScopedRefresh } from "@/features/chat/presentation/shared/useChannelScopedRefresh";
import { useGovernanceChannelPageRoute } from "../page-support/useGovernanceChannelPageRoute";
import { useGovernancePageState } from "../page-support/useGovernancePageState";

type MemberRole = ChannelMember["role"];

/**
 * 入群申请页模型。
 */
export type JoinApplicationsPageModel = {
  channelName: ComputedRef<string>;
  pendingApplications: ComputedRef<ChannelApplication[]>;
  isLoading: Ref<boolean>;
  pageError: Ref<string>;
  pendingCount: ComputedRef<number>;
  canDecide: ComputedRef<boolean>;
  formatApplyTime(applyTimeMs: number): string;
  handleDecide(applicationId: string, approved: boolean): Promise<void>;
  goBack(): void;
};

/**
 * 入群申请页模型依赖。
 */
export type JoinApplicationsPageDeps = {
  governance: RoomGovernanceCapabilities;
  currentUserId: ComputedRef<string>;
};

function createDefaultJoinApplicationsPageDeps(): JoinApplicationsPageDeps {
  return {
    governance: getRoomGovernanceCapabilities(),
    currentUserId: computed(() => currentChatUserId.value),
  };
}

/**
 * 创建入群申请页视图模型。
 *
 * @returns 入群申请页状态与动作。
 */
export function useJoinApplicationsPage(
  deps: JoinApplicationsPageDeps = createDefaultJoinApplicationsPageDeps(),
): JoinApplicationsPageModel {
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

  const currentUserId = computed(() => deps.currentUserId.value);
  const members = ref<ChannelMember[]>([]);
  const currentUserRole = computed<MemberRole>(() => {
    const member = members.value.find((item) => item.uid === currentUserId.value);
    return member?.role ?? "member";
  });
  const isAdmin = computed(() => currentUserRole.value === "admin" || currentUserRole.value === "owner");
  const canDecide = computed(() => isAdmin.value);

  function formatApplyTime(applyTimeMs: number): string {
    if (!applyTimeMs) return "—";
    return new Date(applyTimeMs).toLocaleString();
  }

  async function loadApplications(): Promise<void> {
    await runPageLoad(
      async (channelId) => {
        const channelGovernance = deps.governance.forChannel(channelId);
        const [applicationList, memberList] = await Promise.all([
          channelGovernance.listApplications(),
          channelGovernance.listMembers(),
        ]);
        return { applicationList, memberList };
      },
      ({ applicationList, memberList }) => {
        applications.value = applicationList;
        members.value = memberList;
      },
    );
  }

  async function handleDecide(applicationId: string, approved: boolean): Promise<void> {
    await runChannelAction(
      (channelId) => deps.governance.forChannel(channelId).decideApplication(applicationId, approved),
      async () => {
        // 审批成功后重新加载申请列表并刷新成员侧栏。
        await loadApplications();
        if (approved && channelId.value) {
          try {
            await deps.governance.forChannel(channelId.value).listMembers();
          } catch { /* 成员刷新失败不影响申请列表 */ }
        }
      },
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
    canDecide,
    formatApplyTime,
    handleDecide,
    goBack,
  };
}
