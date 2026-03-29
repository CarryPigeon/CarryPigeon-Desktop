/**
 * @fileoverview plugins/accountSession integration
 * @description
 * 为 plugins feature 提供统一的账户会话读取入口，避免内部实现直接依赖 account feature。
 */

import { getAccountCapabilities } from "@/features/account/api";

const accountCapabilities = getAccountCapabilities();

export function getCurrentPluginUserId(): string {
  return String(accountCapabilities.currentUser.getSnapshot().id ?? "").trim();
}
