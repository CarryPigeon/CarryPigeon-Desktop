/**
 * @fileoverview account/auth-flow login session coordinator。
 * @description
 * 收敛登录后的会话持久化与当前用户快照同步，避免页面层自行编排登录事务。
 */

import { applyAuthenticatedUserSnapshot, syncCurrentUserSnapshot } from "@/features/account/application/currentUserSnapshot";
import { writeAuthSession } from "@/shared/utils/localState";
import {
  getLoginWithEmailCodeUsecase,
  getLoginWithPasswordUsecase,
  getRegisterWithPasswordUsecase,
} from "../di/auth.di";
import { AuthRequiredPluginMissingError } from "../domain/errors/AuthErrors";
import type { AuthLoginResult } from "../domain/types/AuthTypes";
import type { AuthSignInOutcome } from "./authFlowOutcome";
import { toAuthFlowErrorInfo } from "./authFlowOutcome";

async function finalizeSignedInSession(
  serverSocket: string,
  login: AuthLoginResult,
  fallbackIdentity?: { email?: string; username?: string },
): Promise<Extract<AuthSignInOutcome, { kind: "signed_in" }>> {
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
      email: fallbackIdentity?.email,
    });
  }

  return {
    ok: true,
    kind: "signed_in",
    login,
    currentUser,
    redirectTo: "/chat",
  };
}

/**
 * 执行邮箱验证码登录，并完成本地会话与当前用户快照同步。
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
): Promise<AuthSignInOutcome> {
  try {
    const login = await getLoginWithEmailCodeUsecase(serverSocket).execute(email, code);
    return await finalizeSignedInSession(serverSocket, login, { email });
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

/**
 * 执行用户名密码登录，并完成本地会话与当前用户快照同步。
 *
 * @param serverSocket - 当前目标服务器 socket。
 * @param username - 用户名。
 * @param password - 密码。
 * @returns 显式登录结果。
 */
export async function signInWithPassword(
  serverSocket: string,
  username: string,
  password: string,
): Promise<AuthSignInOutcome> {
  try {
    const login = await getLoginWithPasswordUsecase(serverSocket).execute(username, password);
    return await finalizeSignedInSession(serverSocket, login, { username });
  } catch (error) {
    return {
      ok: false,
      kind: "sign_in_rejected",
      error: toAuthFlowErrorInfo(error),
    };
  }
}

/**
 * 先注册再登录（用户名密码），并完成本地会话同步。
 *
 * @param serverSocket - 当前目标服务器 socket。
 * @param username - 用户名。
 * @param password - 密码。
 * @returns 显式登录结果；`login.isNewUser` 在注册路径下标记为 `true`。
 */
export async function registerAndSignInWithPassword(
  serverSocket: string,
  username: string,
  password: string,
): Promise<AuthSignInOutcome> {
  try {
    await getRegisterWithPasswordUsecase(serverSocket).execute(username, password);
    const login = await getLoginWithPasswordUsecase(serverSocket).execute(username, password);
    return await finalizeSignedInSession(
      serverSocket,
      { ...login, isNewUser: true },
      { username },
    );
  } catch (error) {
    return {
      ok: false,
      kind: "sign_in_rejected",
      error: toAuthFlowErrorInfo(error),
    };
  }
}
