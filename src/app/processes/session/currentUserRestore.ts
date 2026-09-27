/**
 * @fileoverview 启动恢复当前用户时的鉴权自救编排。
 * @description
 * 收敛「用本地会话恢复当前用户」的重试策略，避免启动路径直接用过期 access token
 * 请求 `GET /users/me`、拿到 401 就清空本地会话（现象：重启后登录态丢失，
 * 频道列表空、聊天区提示「选择一个频道开始聊天」）。
 *
 * 策略：
 * 1. 先用本地 access token 同步；
 * 2. 仅当失败原因是鉴权失败（401/403）时，尝试刷新会话后用新 token 重试一次；
 * 3. 只有「刷新拿不到 token」或「重试仍鉴权失败」才判定为需要清理会话；
 * 4. 网络/解析类错误一律不清理会话（避免服务端不可达时把用户登出）。
 */

/**
 * 恢复结果。
 *
 * - `ok: true`：当前用户快照已同步，`value` 为 `sync` 的返回值；
 * - `ok: false, authFailure: true`：鉴权确实失效（刷新也失败），调用方应清空本地会话；
 * - `ok: false, authFailure: false`：非鉴权错误（网络不可达等），调用方应保留本地会话。
 */
export type CurrentUserRestoreOutcome<T> = { ok: true; value: T } | { ok: false; authFailure: boolean };

/**
 * 恢复当前用户所需的最小依赖。
 */
export type CurrentUserRestoreDeps<T> = {
  /** 本地存储中的 access token。 */
  initialAccessToken: string;
  /** 用指定 access token 同步当前用户资料；失败时抛出异常。 */
  sync(accessToken: string): Promise<T>;
  /** 刷新会话并返回新的 access token；无 refresh token 或刷新失败时返回 `null`。 */
  refresh(): Promise<string | null>;
  /** 判定异常是否为鉴权失败（HTTP 401/403）。 */
  isAuthFailure(error: unknown): boolean;
};

/**
 * 同步当前用户快照：鉴权失败时先刷新再重试一次。
 *
 * @param deps - 恢复所需依赖。
 * @returns 恢复结果（见 `CurrentUserRestoreOutcome`）。
 */
export async function syncCurrentUserWithRefresh<T>(
  deps: CurrentUserRestoreDeps<T>,
): Promise<CurrentUserRestoreOutcome<T>> {
  try {
    const value = await deps.sync(deps.initialAccessToken);
    return { ok: true, value };
  } catch (error) {
    if (!deps.isAuthFailure(error)) return { ok: false, authFailure: false };
  }

  const refreshedAccessToken = await deps.refresh();
  if (!refreshedAccessToken) return { ok: false, authFailure: true };

  try {
    const value = await deps.sync(refreshedAccessToken);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, authFailure: deps.isAuthFailure(error) };
  }
}

/**
 * 计算“回写 uid”所需写出的会话。
 *
 * 关键约束：必须以**存储中的最新会话**为基准（刷新成功后 access/refresh token 已被轮换），
 * 用进入恢复流程时的旧快照回写会把刚刷新的凭证覆盖掉。
 *
 * @param persisted - 重新从存储读到的会话；为空时退化为 `fallback`。
 * @param fallback - 进入恢复流程时使用的会话快照。
 * @param uid - 权威用户 id。
 * @returns 需要写出的会话；uid 已一致（无需写）时返回 `null`。
 */
export function mergeUidIntoSession<T extends { uid?: string }>(
  persisted: T | null,
  fallback: T,
  uid: string,
): T | null {
  const base = persisted ?? fallback;
  if (base.uid === uid) return null;
  return { ...base, uid };
}
