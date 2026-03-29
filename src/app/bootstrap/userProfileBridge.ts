/**
 * @fileoverview userProfileBridge.ts
 * @description 应用启动编排：用户资料桥接注册。
 */

import type { Router } from "vue-router";
import { listenUserProfileRequest, emitUserProfileResponse, type UserProfileRequest } from "@/shared/tauri";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import { getAccountCapabilities } from "@/features/account/api";
import { readAuthSession, writeAuthSession } from "@/shared/utils/localState";

const serverConnectionCapabilities = getServerConnectionCapabilities();
const accountCapabilities = getAccountCapabilities();
const PROFILE_MUTATION_UNSUPPORTED_MESSAGE =
  "Current server API does not support profile update endpoints (/api/users write operations).";

let userProfileBridgeUnlisten: (() => void) | null = null;
let userProfileBridgeStarting: Promise<() => void> | null = null;

/**
 * 将桥接层捕获的错误映射为稳定的响应文案。
 *
 * @param error - 捕获的异常对象。
 * @returns 返回给 native 侧的可读错误文本。
 */
function toBridgeErrorMessage(error: unknown): string {
  if (accountCapabilities.profileErrors.isMutationUnsupported(error)) {
    return PROFILE_MUTATION_UNSUPPORTED_MESSAGE;
  }
  return accountCapabilities.profileErrors.toMessage(error);
}

async function emitBridgeSuccess(id: string): Promise<void> {
  await emitUserProfileResponse({ id, ok: true });
}

async function emitBridgeFailure(id: string, error: unknown): Promise<void> {
  await emitUserProfileResponse({
    id,
    ok: false,
    message: toBridgeErrorMessage(error),
  });
}

async function emitMissingServerSocketFailure(id: string): Promise<void> {
  await emitUserProfileResponse({
    id,
    ok: false,
    message: "Missing server socket",
  });
}

function buildUnsupportedActionMessage(payload: UserProfileRequest): string {
  const action = String((payload as { type?: unknown }).type ?? "");
  return `Unsupported user-profile action: ${action}`;
}

async function dispatchBridgeRequest(payload: UserProfileRequest, router: Router): Promise<void> {
  const { id: requestId } = payload;
  const socket = serverConnectionCapabilities.workspace.readSocket();
  if (!socket) {
    await emitMissingServerSocketFailure(requestId);
    return;
  }

  switch (payload.type) {
    case "send_email_code": {
      const outcome = await accountCapabilities.forServer(socket).sendVerificationCode(payload.email);
      if (!outcome.ok) {
        await emitUserProfileResponse({
          id: requestId,
          ok: false,
          message: outcome.error.message,
        });
        return;
      }
      await emitBridgeSuccess(requestId);
      return;
    }
    case "logout": {
      const session = readAuthSession(socket);
      const refreshToken = session?.refreshToken ?? "";
      if (refreshToken) {
        const revokeOutcome = await accountCapabilities.forServer(socket).revokeToken(refreshToken);
        if (!revokeOutcome.ok) {
          await emitUserProfileResponse({
            id: requestId,
            ok: false,
            message: revokeOutcome.error.message,
          });
          return;
        }
      }
      writeAuthSession(socket, null);
      accountCapabilities.currentUser.clearSnapshot();
      serverConnectionCapabilities.workspace.selectSocket("");
      void router.replace("/");
      await emitBridgeSuccess(requestId);
      return;
    }
    case "update_profile": {
      if (!accountCapabilities.profileErrors.supportsMutation()) {
        await emitUserProfileResponse({
          id: requestId,
          ok: false,
          message: PROFILE_MUTATION_UNSUPPORTED_MESSAGE,
        });
        return;
      }
      if (payload.emailUpdate) {
        const emailOutcome = await accountCapabilities.forServer(socket).updateUserEmail(
          payload.emailUpdate.email,
          payload.emailUpdate.code,
        );
        if (!emailOutcome.ok) {
          await emitUserProfileResponse({
            id: requestId,
            ok: false,
            message: emailOutcome.error.message,
          });
          return;
        }
      }
      const profileOutcome = await accountCapabilities.forServer(socket).updateUserProfile({
        username: payload.profile.username,
        avatar: payload.profile.avatar,
        sex: payload.profile.sex,
        brief: payload.profile.brief,
        birthday: payload.profile.birthday,
      });
      if (!profileOutcome.ok) {
        await emitUserProfileResponse({
          id: requestId,
          ok: false,
          message: profileOutcome.error.message,
        });
        return;
      }
      const accessToken = readAuthSession(socket)?.accessToken ?? "";
      if (accessToken.trim()) {
        try {
          await accountCapabilities.forServer(socket).syncCurrentUserSnapshot(accessToken);
        } catch {
          const currentUserSnapshot = accountCapabilities.currentUser.getSnapshot();
          accountCapabilities.currentUser.applyAuthenticatedSnapshot({
            uid: currentUserSnapshot.id,
            email: payload.emailUpdate?.email ?? currentUserSnapshot.email,
          });
          accountCapabilities.currentUser.applyLocalProfilePatch({
            username: payload.profile.username,
            description: payload.profile.brief,
          });
        }
      } else {
        const currentUserSnapshot = accountCapabilities.currentUser.getSnapshot();
        accountCapabilities.currentUser.applyLocalProfilePatch({
          username: payload.profile.username,
          description: payload.profile.brief,
          email: payload.emailUpdate?.email ?? currentUserSnapshot.email,
        });
      }

      await emitBridgeSuccess(requestId);
      return;
    }
    default: {
      await emitUserProfileResponse({
        id: requestId,
        ok: false,
        message: buildUnsupportedActionMessage(payload),
      });
      return;
    }
  }
}

/**
 * 注册 user-profile 请求/响应桥接（native ↔ webview）。
 *
 * @param router - 应用路由实例。
 * @returns 取消注册函数（幂等注册时返回同一个取消句柄）。
 */
export async function registerUserProfileBridge(router: Router): Promise<() => void> {
  if (userProfileBridgeUnlisten) return userProfileBridgeUnlisten;
  if (userProfileBridgeStarting) return userProfileBridgeStarting;

  // Store startup promise so concurrent callers share one registration flow.
  userProfileBridgeStarting = listenUserProfileRequest(async (event) => {
    const payload = event.payload;
    const requestId = payload.id;
    try {
      await dispatchBridgeRequest(payload, router);
    } catch (e) {
      await emitBridgeFailure(requestId, e);
    }
  })
    .then((unlisten) => {
      // Wrap native unlisten so we can clear local lifecycle state together.
      userProfileBridgeUnlisten = () => {
        unlisten();
        userProfileBridgeUnlisten = null;
      };
      return userProfileBridgeUnlisten;
    })
    .finally(() => {
      userProfileBridgeStarting = null;
    });

  return userProfileBridgeStarting;
}

/**
 * 注销 user-profile 桥接监听（best-effort）。
 */
export function unregisterUserProfileBridge(): void {
  if (!userProfileBridgeUnlisten) return;
  userProfileBridgeUnlisten();
}
