/**
 * @fileoverview members rail model
 * @description
 * 收敛 MembersRail 所需的成员列表读取，避免布局组件直接依赖 governance store。
 */

import { computed, proxyRefs } from "vue";
import type { ComputedRef, ShallowUnwrapRef } from "vue";
import type { RoomGovernanceMembersCapabilities, RoomGovernanceMembersSnapshot } from "@/features/chat/room-governance/api-types";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";

type MembersRailRawModel = {
  members: ComputedRef<RoomGovernanceMembersSnapshot>;
};
export type MembersRailModel = ShallowUnwrapRef<MembersRailRawModel>;

export type UseMembersRailModelDeps = {
  members: RoomGovernanceMembersCapabilities;
};

export function useMembersRailModel(deps: UseMembersRailModelDeps): MembersRailModel {
  const membersSnapshot = useObservedCapabilitySnapshot(deps.members);
  const rawModel: MembersRailRawModel = {
    members: computed(() => membersSnapshot.value),
  };
  return proxyRefs(rawModel);
}
