/**
 * @fileoverview 频道封禁管理页编排。
 * @description chat/room-governance｜presentation composable：收敛封禁列表、候选成员与新增/解除封禁动作。
 */

import { computed, ref, watch, type ComputedRef, type Ref, type WritableComputedRef } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { currentChatUserId } from "@/features/chat/composition/chatAccountSession";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";
import type { ChannelBan, ChannelMember, RoomGovernanceCapabilities } from "@/features/chat/room-governance/api-types";
import { useChannelScopedRefresh } from "@/features/chat/presentation/shared/useChannelScopedRefresh";
import { useGovernanceChannelPageRoute } from "../page-support/useGovernanceChannelPageRoute";
import { useGovernancePageState } from "../page-support/useGovernancePageState";

type MemberRole = ChannelMember["role"];

type BanDurationOption = {
  value: string;
  label: string;
  ms: number;
};

/**
 * 频道封禁页模型。
 */
export type ChannelBansPageModel = {
  channelName: ComputedRef<string>;
  bans: Ref<ChannelBan[]>;
  isLoading: Ref<boolean>;
  pageError: Ref<string>;
  addBanDialogVisible: WritableComputedRef<boolean>;
  selectedUid: Ref<string>;
  banDuration: Ref<string>;
  banReason: Ref<string>;
  durationOptions: readonly BanDurationOption[];
  bannableMembers: ComputedRef<ChannelMember[]>;
  banCount: ComputedRef<number>;
  canOpenAddBanDialog: ComputedRef<boolean>;
  canSubmitAddBan: ComputedRef<boolean>;
  canRemoveBan: ComputedRef<boolean>;
  formatBanUntil(untilMs: number): string;
  openAddBanDialog(): void;
  closeAddBanDialog(): void;
  handleAddBan(): Promise<void>;
  handleRemoveBan(uid: string): Promise<void>;
  goBack(): void;
};

/**
 * 频道封禁页模型依赖。
 */
export type ChannelBansPageDeps = {
  governance: RoomGovernanceCapabilities;
  currentUserId: ComputedRef<string>;
};

function createDefaultChannelBansPageDeps(): ChannelBansPageDeps {
  return {
    governance: getRoomGovernanceCapabilities(),
    currentUserId: computed(() => currentChatUserId.value),
  };
}

/**
 * 创建频道封禁页视图模型。
 *
 * @returns 频道封禁页状态与动作。
 */
export function useChannelBansPage(
  deps: ChannelBansPageDeps = createDefaultChannelBansPageDeps(),
): ChannelBansPageModel {
  const router = useRouter();
  const { t } = useI18n();
  const { channelId, requestedChannelName } = useGovernanceChannelPageRoute();

  const bans = ref<ChannelBan[]>([]);
  const members = ref<ChannelMember[]>([]);
  const { isLoading, pageError, runPageLoad, runChannelAction } = useGovernancePageState({
    channelId,
    onMissingChannel: () => {
      bans.value = [];
      members.value = [];
    },
  });

  const showAddBan = ref(false);
  const selectedUid = ref("");
  const banDuration = ref("1d");
  const banReason = ref("");
  const channelName = computed(() => requestedChannelName.value || t("channel_bans"));

  const currentUserId = computed(() => deps.currentUserId.value);
  const currentUserRole = computed<MemberRole>(() => {
    const member = members.value.find((item) => item.uid === currentUserId.value);
    return member?.role ?? "member";
  });
  const isOwner = computed(() => currentUserRole.value === "owner");
  const isAdmin = computed(() => currentUserRole.value === "admin" || currentUserRole.value === "owner");

  const durationOptions: readonly BanDurationOption[] = [
    { value: "1h", label: "duration_1h", ms: 1000 * 60 * 60 },
    { value: "1d", label: "duration_1d", ms: 1000 * 60 * 60 * 24 },
    { value: "7d", label: "duration_7d", ms: 1000 * 60 * 60 * 24 * 7 },
    { value: "30d", label: "duration_30d", ms: 1000 * 60 * 60 * 24 * 30 },
    { value: "perm", label: "ban_permanent", ms: 0 },
  ];

  const bannableMembers = computed(() => {
    const bannedUids = new Set(bans.value.map((ban) => ban.uid));
    return members.value.filter((member) => {
      // Never allow banning yourself or the channel owner
      if (member.uid === currentUserId.value) return false;
      if (member.role === "owner") return false;
      // Already banned — cannot ban again
      if (bannedUids.has(member.uid)) return false;
      // Owner can ban admins and regular members
      if (isOwner.value) return true;
      // Admin can only ban regular members (not other admins)
      if (isAdmin.value && member.role === "member") return true;
      // Regular members cannot ban anyone
      return false;
    });
  });
  const banCount = computed(() => bans.value.length);
  const canOpenAddBanDialog = computed(() => bannableMembers.value.length > 0);
  const canSubmitAddBan = computed(() => Boolean(selectedUid.value));
  const canRemoveBan = computed(() => isAdmin.value);
  const addBanDialogVisible = computed({
    get: () => showAddBan.value,
    set: (visible: boolean) => {
      if (visible) {
        openAddBanDialog();
        return;
      }
      closeAddBanDialog();
    },
  });

  function resetBanDraft(): void {
    selectedUid.value = "";
    banDuration.value = "1d";
    banReason.value = "";
  }

  function formatBanUntil(untilMs: number): string {
    if (!untilMs || untilMs === 0) return t("ban_permanent");
    return new Date(untilMs).toLocaleString();
  }

  async function loadData(): Promise<void> {
    await runPageLoad(
      async (channelId) => {
        const channelGovernance = deps.governance.forChannel(channelId);
        const [banList, memberList] = await Promise.all([
          channelGovernance.listBans(),
          channelGovernance.listMembers(),
        ]);
        return { banList, memberList };
      },
      ({ banList, memberList }) => {
        bans.value = banList;
        members.value = memberList;
      },
    );
  }

  function openAddBanDialog(): void {
    if (!canOpenAddBanDialog.value) return;
    showAddBan.value = true;
  }

  function closeAddBanDialog(): void {
    showAddBan.value = false;
    resetBanDraft();
  }

  async function handleAddBan(): Promise<void> {
    if (!selectedUid.value) return;
    const duration = durationOptions.find((option) => option.value === banDuration.value);
    const until = duration?.ms === 0 ? 0 : Date.now() + (duration?.ms ?? 0);
    await runChannelAction(
      (channelId) => deps.governance.forChannel(channelId).setBan(selectedUid.value, until, banReason.value),
      async () => {
        closeAddBanDialog();
        await loadData();
      },
    );
  }

  async function handleRemoveBan(uid: string): Promise<void> {
    await runChannelAction(
      (channelId) => deps.governance.forChannel(channelId).removeBan(uid),
      loadData,
    );
  }

  function goBack(): void {
    router.back();
  }

  watch(showAddBan, (visible) => {
    if (!visible) resetBanDraft();
  });

  watch(canOpenAddBanDialog, (canOpen) => {
    if (!canOpen && showAddBan.value) closeAddBanDialog();
  });

  useChannelScopedRefresh({
    channelId,
    projection: "bans",
    refresh: loadData,
  });

  return {
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
    canRemoveBan,
    formatBanUntil,
    openAddBanDialog,
    closeAddBanDialog,
    handleAddBan,
    handleRemoveBan,
    goBack,
  };
}
