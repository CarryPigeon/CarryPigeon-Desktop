/**
 * @fileoverview 当前用户数据 store（userData.ts）。
 * @description 展示层 store：提供 UI 使用的“当前用户资料快照”。
 *
 * 架构说明（Clean Architecture）：
 * 该 store 属于 UI/展示层，保存渲染所需与少量 UI 决策所需的“当前用户”数据
 * （例如：判断“这是否是我发送的消息？”）。domain 层不应依赖该 store。
 *
 * 数据来源：
 * - 真实模式：由 API 响应 / Tauri bridge 事件写入。
 * - UI 预览：可能保持默认值；mock 逻辑会退化为确定性身份。
 */

import { reactive, readonly, type DeepReadonly } from "vue";
import type { CurrentUser } from "../../application/currentUserContracts";

/**
 * 用于全局展示层组件的响应式用户资料。
 *
 * 默认值表示“匿名/未登录”。
 *
 * @constant
 */
const currentUserState = reactive<CurrentUser>({
  id: "",
  username: "",
  email: "",
  description: "",
  trustLevel: "anonymous",
});

const EMPTY_CURRENT_USER: CurrentUser = {
  id: "",
  username: "",
  email: "",
  description: "",
  trustLevel: "anonymous",
};
const currentUserObservers = new Set<(snapshot: CurrentUser) => void>();

function cloneCurrentUserSnapshot(input: CurrentUser): CurrentUser {
  return {
    id: input.id,
    username: input.username,
    email: input.email,
    description: input.description,
    trustLevel: input.trustLevel,
  };
}

function notifyCurrentUserObservers(): void {
  const snapshot = cloneCurrentUserSnapshot(currentUserState);
  for (const observer of currentUserObservers) {
    observer(snapshot);
  }
}

/**
 * 对外只读的当前用户快照。
 *
 * 说明：
 * - 外部模块只能读取，不能直接改写；
 * - 写入必须走 application 层的受控入口。
 */
export const currentUser: DeepReadonly<CurrentUser> = readonly(currentUserState);

/**
 * 将部分用户字段合并到 `currentUser`。
 *
 * 该函数刻意保持宽容：仅当 `next` 中字段存在且类型符合预期时才写入。
 * 目的：上游 payload 不完整时，避免把已有字段覆盖为空值。
 *
 * @param next - 要更新的部分用户字段。
 */
export function setCurrentUser(next: Partial<CurrentUser>): void {
  if (typeof next.id === "string") currentUserState.id = next.id;
  if (typeof next.username === "string") currentUserState.username = next.username;
  if (typeof next.email === "string") currentUserState.email = next.email;
  if (typeof next.description === "string") currentUserState.description = next.description;
  if (
    next.trustLevel === "anonymous" ||
    next.trustLevel === "authenticated" ||
    next.trustLevel === "authority_profile"
  ) {
    currentUserState.trustLevel = next.trustLevel;
  }
  notifyCurrentUserObservers();
}

export function clearCurrentUser(): void {
  setCurrentUser(EMPTY_CURRENT_USER);
}

/**
 * 读取当前用户快照（plain object）。
 */
export function getCurrentUserSnapshot(): CurrentUser {
  return cloneCurrentUserSnapshot(currentUserState);
}

/**
 * 订阅当前用户快照变化。
 */
export function observeCurrentUserSnapshot(observer: (snapshot: CurrentUser) => void): () => void {
  currentUserObservers.add(observer);
  observer(getCurrentUserSnapshot());
  return () => {
    currentUserObservers.delete(observer);
  };
}
