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

/**
 * 当前 chat 可见用户快照。
 *
 * 这是 account/currentUser capability 的响应式投影，
 * 仅供 chat feature 内部使用，不应作为跨 feature 稳定值继续外传。
 */
export const currentChatUser = computed(() => currentChatUserState.value);
/**
 * 当前 chat 用户 id 的归一化只读投影。
 */
export const currentChatUserId = computed(() => String(currentChatUserState.value.id || "").trim());
/**
 * 当前 chat 用户名的归一化只读投影。
 */
export const currentChatUsername = computed(() => String(currentChatUserState.value.username || "").trim());

/**
 * 读取当前 chat 用户 id。
 *
 * 该 helper 用于那些不想依赖 Vue `computed` 的 application/runtime 代码。
 */
export function getCurrentChatUserId(): string {
  return currentChatUserId.value;
}
