/**
 * @fileoverview account/current-user application facade。
 * @description
 * 收敛当前用户展示快照的读取、订阅与受控写入，避免公共 API 直接依赖展示层 store。
 */

import {
  clearCurrentUser as clearCurrentUserInternal,
  getCurrentUserSnapshot as getCurrentUserSnapshotInternal,
  observeCurrentUserSnapshot as observeCurrentUserSnapshotInternal,
  setCurrentUser as setCurrentUserInternal,
} from "../presentation/store/userData";
import type { CurrentUser } from "./currentUserContracts";

export type { CurrentUser, CurrentUserTrustLevel } from "./currentUserContracts";

export function getCurrentUserSnapshot(): CurrentUser {
  return getCurrentUserSnapshotInternal();
}

export function observeCurrentUserSnapshot(observer: (snapshot: CurrentUser) => void): () => void {
  return observeCurrentUserSnapshotInternal(observer);
}

export function replaceCurrentUserSnapshot(next: CurrentUser): CurrentUser {
  setCurrentUserInternal(next);
  return getCurrentUserSnapshotInternal();
}

export function clearCurrentUserSnapshot(): void {
  clearCurrentUserInternal();
}
