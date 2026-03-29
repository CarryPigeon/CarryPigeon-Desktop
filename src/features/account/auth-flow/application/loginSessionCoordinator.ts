/**
 * @fileoverview account/auth-flow login session coordinator。
 * @description
 * 收敛邮箱验证码登录后的会话持久化与当前用户快照同步，避免页面层自行编排登录事务。
 */

import { applyAuthenticatedUserSnapshot, syncCurrentUserSnapshot } from "@/features/account/application/currentUserSnapshot";
import { writeAuthSession } from "@/shared/utils/localState";
import { getLoginWithEmailCodeUsecase } from "../di/auth.di";
import { AuthRequiredPluginMissingError } from "../domain/errors/AuthErrors";
import type { AuthSignInOutcome } from "./authFlowOutcome";
import { toAuthFlowErrorInfo } from "./authFlowOutcome";

/**
 * 执行邮箱验证码登录，并完成本地会话与当前用户快照同步。
 *
 * 事务顺序：
 * 1. 调用认证用例完成登录；
 * 2. 持久化本地 auth session；
 * 3. best-effort 同步权威当前用户快照；
 * 4. 同步失败时回退到最小认证快照。
 *
 * @param serverSocket - 当前目标服务器 socket。
 * @param email - 登录邮箱。
 * @param code - 邮箱验证码。
 * @returns 显式登录结果。
 */
export async function signInWithEmailCode(
  serverSocket: string,
  email: string,
  code: string,
) : Promise<AuthSignInOutcome> {
  try {
    const login = await getLoginWithEmailCodeUsecase(serverSocket).execute(email, code);

    writeAuthSession(serverSocket, {
      accessToken: login.accessToken,
      refreshToken: login.refreshToken,
      uid: login.uid,
      expiresAtMs: Date.now() + Math.max(0, Math.trunc(login.expiresInSec)) * 1000,
    });

    let currentUser;
    try {
      currentUser = await syncCurrentUserSnapshot(serverSocket, login.accessToken);
    } catch {
      currentUser = applyAuthenticatedUserSnapshot({
        uid: login.uid,
        email,
      });
    }

    return {
      ok: true,
      kind: "signed_in",
      login,
      currentUser,
      redirectTo: "/chat",
    };
  } catch (error) {
    if (error instanceof AuthRequiredPluginMissingError) {
      return {
        ok: true,
        kind: "required_setup",
        missingPluginIds: Object.freeze([...error.payload.missing_plugins]),
        redirectTo: "/required-setup",
      };
    }
    return {
      ok: false,
      kind: "sign_in_rejected",
      error: toAuthFlowErrorInfo(error),
    };
  }
}
