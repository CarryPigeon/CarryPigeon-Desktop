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
/**
 * MembersRail 组件消费的页面模型。
 */
export type MembersRailModel = ShallowUnwrapRef<MembersRailRawModel>;

/**
 * MembersRail 页面模型依赖。
 */
export type UseMembersRailModelDeps = {
  members: RoomGovernanceMembersCapabilities;
};

/**
 * 创建 MembersRail 页面模型。
 */
export function useMembersRailModel(deps: UseMembersRailModelDeps): MembersRailModel {
  const membersSnapshot = useObservedCapabilitySnapshot(deps.members);
  const rawModel: MembersRailRawModel = {
    members: computed(() => membersSnapshot.value),
  };
  return proxyRefs(rawModel);
}
