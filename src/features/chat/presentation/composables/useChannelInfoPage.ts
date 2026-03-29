/**
 * @fileoverview 频道信息页编排。
 * @description chat｜presentation composable：收敛频道信息展示、加入动作与资料编辑流程。
 */

import { computed, ref, watch, type ComputedRef, type Ref } from "vue";
import { useRouter, type Router } from "vue-router";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";
import type {
  ApplyJoinChannelOutcome,
  UpdateChannelMetaOutcome,
} from "@/features/chat/room-governance/api-types";
import { getRoomSessionCapabilities } from "@/features/chat/room-session/api";
import type {
  ChannelSelectionOutcome,
  ChatChannel,
  RoomSessionDirectoryCapabilities,
} from "@/features/chat/room-session/api-types";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import { useChannelInfoPageRoute } from "./useChannelInfoPageRoute";

type ChannelMetaDraft = {
  name: string;
  brief: string;
};

export type ChannelInfoPageDeps = {
  directory: RoomSessionDirectoryCapabilities;
  requestJoin(channelId: string): Promise<ApplyJoinChannelOutcome>;
  saveChannelMeta(channelId: string, draft: ChannelMetaDraft): Promise<UpdateChannelMetaOutcome>;
  mayEditChannelMeta(channel: ChatChannel | null): boolean;
  openPatchbayForChannel(channel: ChatChannel | null): Promise<ChannelSelectionOutcome | null> | ChannelSelectionOutcome | null;
};

export type ChannelInfoPageModel = {
  channelId: ComputedRef<string>;
  channelName: ComputedRef<string>;
  channelBrief: ComputedRef<string>;
  membershipStatus: ComputedRef<"joined" | "not_joined">;
  isEditing: Ref<boolean>;
  isRequestingJoin: Ref<boolean>;
  isSavingMeta: Ref<boolean>;
  actionError: Ref<string>;
  draftChannelName: Ref<string>;
  draftChannelBrief: Ref<string>;
  hasChannel: ComputedRef<boolean>;
  isJoined: ComputedRef<boolean>;
  joinRequested: ComputedRef<boolean>;
  canRequestJoin: ComputedRef<boolean>;
  mayEditChannelMeta: ComputedRef<boolean>;
  beginEdit(): void;
  cancelEdit(): void;
  saveEdit(): Promise<void>;
  handleJoin(): Promise<void>;
  openInPatchbay(): Promise<void>;
  goBack(): void;
};

function createDefaultChannelInfoPageDeps(router: Router): ChannelInfoPageDeps {
  const roomGovernanceCapabilities = getRoomGovernanceCapabilities();
  const roomSessionCapabilities = getRoomSessionCapabilities();
  const roomDirectory = roomSessionCapabilities.directory;
  const currentSession = roomSessionCapabilities.currentChannel;

  return {
    directory: roomDirectory,
    requestJoin(channelId: string): Promise<ApplyJoinChannelOutcome> {
      return roomGovernanceCapabilities.forChannel(channelId).applyJoin();
    },
    saveChannelMeta(channelId: string, draft: ChannelMetaDraft): Promise<UpdateChannelMetaOutcome> {
      return roomGovernanceCapabilities.forChannel(channelId).updateMeta(draft);
    },
    mayEditChannelMeta(): boolean {
      return false;
    },
    async openPatchbayForChannel(channel: ChatChannel | null): Promise<ChannelSelectionOutcome | null> {
      if (channel?.joined) {
        const outcome = await currentSession.selectChannel(channel.id);
        if (!outcome.ok) return outcome;
        void router.push("/chat");
        return outcome;
      }
      roomDirectory.focusDiscoverChannel(channel?.name ?? "");
      void router.push("/chat");
      return null;
    },
  };
}

/**
 * 创建频道信息页视图模型。
 *
 * @param deps - 页面动作依赖；默认连接到 chat 子域 API。
 * @returns 频道信息页状态与动作。
 */
export function useChannelInfoPage(
  deps?: ChannelInfoPageDeps,
): ChannelInfoPageModel {
  const router = useRouter();
  const pageDeps = deps ?? createDefaultChannelInfoPageDeps(router);
  const { channelId, requestedChannelName, requestedChannelBrief } = useChannelInfoPageRoute();
  const directorySnapshot = useObservedCapabilitySnapshot(pageDeps.directory);

  const channel = computed(() => {
    const id = channelId.value;
    if (!id) return null;
    for (const item of directorySnapshot.value.allChannels) {
      if (item.id === id) return item;
    }
    return null;
  });
  const channelName = computed(() => channel.value?.name ?? requestedChannelName.value);
  const channelBrief = computed(() => channel.value?.brief ?? requestedChannelBrief.value);

  const isEditing = ref(false);
  const isRequestingJoin = ref(false);
  const isSavingMeta = ref(false);
  const actionError = ref("");
  const draftChannelName = ref("");
  const draftChannelBrief = ref("");

  const hasChannel = computed(() => channel.value !== null);
  const isJoined = computed(() => Boolean(channel.value?.joined));
  const joinRequested = computed(() => Boolean(channel.value?.joinRequested));
  const membershipStatus = computed<"joined" | "not_joined">(() => (isJoined.value ? "joined" : "not_joined"));
  const canRequestJoin = computed(() => hasChannel.value && !isJoined.value);
  const mayEditChannelMeta = computed(() => pageDeps.mayEditChannelMeta(channel.value));

  function resetDraftToCurrentChannelMeta(): void {
    draftChannelName.value = channelName.value;
    draftChannelBrief.value = channelBrief.value;
  }

  function beginEdit(): void {
    if (!mayEditChannelMeta.value) return;
    isEditing.value = true;
    actionError.value = "";
    resetDraftToCurrentChannelMeta();
  }

  function cancelEdit(): void {
    isEditing.value = false;
    actionError.value = "";
    resetDraftToCurrentChannelMeta();
  }

  async function saveEdit(): Promise<void> {
    if (!channelId.value || !mayEditChannelMeta.value || isSavingMeta.value) return;

    isSavingMeta.value = true;
    actionError.value = "";
    try {
      const outcome = await pageDeps.saveChannelMeta(channelId.value, {
        name: draftChannelName.value,
        brief: draftChannelBrief.value,
      });
      if (!outcome.ok) {
        actionError.value = outcome.error.message;
        return;
      }
      isEditing.value = false;
    } catch (error: unknown) {
      actionError.value = String(error) || "Failed to save channel profile.";
    } finally {
      isSavingMeta.value = false;
    }
  }

  async function handleJoin(): Promise<void> {
    if (!channelId.value || isRequestingJoin.value) return;

    isRequestingJoin.value = true;
    actionError.value = "";
    try {
      const outcome = await pageDeps.requestJoin(channelId.value);
      if (!outcome.ok) {
        actionError.value = outcome.error.message;
      }
    } catch (error: unknown) {
      actionError.value = String(error) || "Failed to send join request.";
    } finally {
      isRequestingJoin.value = false;
    }
  }

  async function openInPatchbay(): Promise<void> {
    const outcome = await pageDeps.openPatchbayForChannel(channel.value);
    if (outcome && !outcome.ok) {
      actionError.value = outcome.error.message;
    }
  }

  function goBack(): void {
    router.back();
  }

  watch(
    channelId,
    () => {
      isEditing.value = false;
      isRequestingJoin.value = false;
      isSavingMeta.value = false;
      actionError.value = "";
      resetDraftToCurrentChannelMeta();
    },
    { immediate: true },
  );

  return {
    channelId,
    channelName,
    channelBrief,
    membershipStatus,
    isEditing,
    isRequestingJoin,
    isSavingMeta,
    actionError,
    draftChannelName,
    draftChannelBrief,
    hasChannel,
    isJoined,
    joinRequested,
    canRequestJoin,
    mayEditChannelMeta,
    beginEdit,
    cancelEdit,
    saveEdit,
    handleJoin,
    openInPatchbay,
    goBack,
  };
}
