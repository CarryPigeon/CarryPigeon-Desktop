/**
 * @fileoverview 频道成员管理页编排。
 * @description chat/room-governance｜presentation composable：收敛成员列表加载、权限判断与成员管理动作。
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { currentChatUserId } from "@/features/chat/data/account-session";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";
import type { ChannelMember, RoomGovernanceCapabilities } from "@/features/chat/room-governance/api-types";
import { useChannelScopedRefresh } from "@/features/chat/presentation/shared/useChannelScopedRefresh";
import { useGovernanceChannelPageRoute } from "../page-support/useGovernanceChannelPageRoute";
import { useGovernancePageState } from "../page-support/useGovernancePageState";

type MemberRole = ChannelMember["role"];
type RefLike<T> = Ref<T> | ComputedRef<T>;

/**
 * 频道成员页模型。
 */
export type ChannelMembersPageModel = {
  channelName: ComputedRef<string>;
  members: Ref<ChannelMember[]>;
  isLoading: Ref<boolean>;
  pageError: Ref<string>;
  memberCount: ComputedRef<number>;
  formatJoinTime(joinTimeMs: number): string;
  roleLabel(role: MemberRole): string;
  canPromoteMember(member: ChannelMember): boolean;
  canDemoteAdmin(member: ChannelMember): boolean;
  canKickMember(member: ChannelMember): boolean;
  handleKick(uid: string): Promise<void>;
  handleSetAdmin(uid: string): Promise<void>;
  handleRemoveAdmin(uid: string): Promise<void>;
  goBack(): void;
};

/**
 * 频道成员页模型依赖。
 */
export type ChannelMembersPageDeps = {
  governance: RoomGovernanceCapabilities;
  currentUserId: RefLike<string>;
};

function createDefaultChannelMembersPageDeps(): ChannelMembersPageDeps {
  return {
    governance: getRoomGovernanceCapabilities(),
    currentUserId: computed(() => currentChatUserId.value),
  };
}

function hasManageableIdentity(member: ChannelMember, currentUserId: string): boolean {
  return member.role !== "owner" && member.uid !== currentUserId;
}

/**
 * 创建频道成员页视图模型。
 *
 * @returns 成员页状态与动作。
 */
export function useChannelMembersPage(
  deps: ChannelMembersPageDeps = createDefaultChannelMembersPageDeps(),
): ChannelMembersPageModel {
  const router = useRouter();
  const { t } = useI18n();
  const { channelId, requestedChannelName } = useGovernanceChannelPageRoute();

  const members = ref<ChannelMember[]>([]);
  const { isLoading, pageError, runPageLoad, runChannelAction } = useGovernancePageState({
    channelId,
    onMissingChannel: () => {
      members.value = [];
    },
  });

  const channelName = computed(() => requestedChannelName.value || t("channel_members"));
  const currentUserId = computed(() => deps.currentUserId.value);
  const currentUserRole = computed<MemberRole>(() => {
    const member = members.value.find((item) => item.uid === currentUserId.value);
    return member?.role ?? "member";
  });
  const isOwner = computed(() => currentUserRole.value === "owner");
  const isAdmin = computed(() => currentUserRole.value === "admin" || currentUserRole.value === "owner");
  const memberCount = computed(() => members.value.length);

  function formatJoinTime(joinTimeMs: number): string {
    if (!joinTimeMs) return "—";
    return new Date(joinTimeMs).toLocaleDateString();
  }

  function roleLabel(role: MemberRole): string {
    if (role === "owner") return t("role_owner");
    if (role === "admin") return t("role_admin");
    return t("role_member");
  }

  async function loadMembers(): Promise<void> {
    await runPageLoad((channelId) => deps.governance.forChannel(channelId).listMembers(), (nextMembers) => {
      members.value = nextMembers;
    });
  }

  function canPromoteMember(member: ChannelMember): boolean {
    return isOwner.value && member.role === "member" && hasManageableIdentity(member, currentUserId.value);
  }

  function canDemoteAdmin(member: ChannelMember): boolean {
    return isOwner.value && member.role === "admin" && hasManageableIdentity(member, currentUserId.value);
  }

  function canKickMember(member: ChannelMember): boolean {
    return isAdmin.value && hasManageableIdentity(member, currentUserId.value);
  }

  async function handleKick(uid: string): Promise<void> {
    if (!confirm(t("kick_confirm"))) return;
    await runChannelAction(
      (channelId) => deps.governance.forChannel(channelId).kickMember(uid),
      loadMembers,
    );
  }

  async function handleSetAdmin(uid: string): Promise<void> {
    await runChannelAction(
      (channelId) => deps.governance.forChannel(channelId).setAdmin(uid),
      loadMembers,
    );
  }

  async function handleRemoveAdmin(uid: string): Promise<void> {
    await runChannelAction(
      (channelId) => deps.governance.forChannel(channelId).removeAdmin(uid),
      loadMembers,
    );
  }

  function goBack(): void {
    router.back();
  }

  useChannelScopedRefresh({
    channelId,
    projection: "members",
    refresh: loadMembers,
  });

  return {
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
  };
}
