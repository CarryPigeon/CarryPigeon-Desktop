/**
 * @fileoverview members rail model
 * @description
 * 收敛 MembersRail 所需的成员列表读取，避免布局组件直接依赖 governance store。
 */

import { computed, proxyRefs } from "vue";
import type { ComputedRef, ShallowUnwrapRef } from "vue";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";

const roomGovernanceCapabilities = getRoomGovernanceCapabilities();

type MembersRailRawModel = {
  members: ComputedRef<ReturnType<typeof roomGovernanceCapabilities.currentChannel.members.getSnapshot>>;
};
export type MembersRailModel = ShallowUnwrapRef<MembersRailRawModel>;

export function useMembersRailModel(): MembersRailModel {
  const membersSnapshot = useObservedCapabilitySnapshot(roomGovernanceCapabilities.currentChannel.members);
  const rawModel: MembersRailRawModel = {
    members: computed(() => membersSnapshot.value),
  };
  return proxyRefs(rawModel);
}
