/**
 * @fileoverview chat/accountSession integration
 * @description
 * 为 chat feature 提供统一的账户会话读取入口，避免各子模块直接依赖 account feature。
 */

import { computed } from "vue";
import { getAccountCapabilities } from "@/features/account/api";
import { createCapabilitySnapshotRef } from "@/shared/utils/createCapabilitySnapshotRef";

const accountCapabilities = getAccountCapabilities();
const currentChatUserState = createCapabilitySnapshotRef(accountCapabilities.currentUser);

export const currentChatUser = computed(() => currentChatUserState.value);
export const currentChatUserId = computed(() => String(currentChatUserState.value.id || "").trim());
export const currentChatUsername = computed(() => String(currentChatUserState.value.username || "").trim());

export function getCurrentChatUserId(): string {
  return currentChatUserId.value;
}
