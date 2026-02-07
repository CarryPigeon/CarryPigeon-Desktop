/**
 * @fileoverview userProfileBridge.ts
 * @description 应用启动编排：用户资料桥接注册。
 */

import type { Router } from "vue-router";
import { listenUserProfileRequest, emitUserProfileResponse } from "@/shared/tauri";
import { currentServerSocket, setServerSocket } from "@/features/servers/api";
import {
  currentUser,
  getUpdateUserEmailUsecase,
  getUpdateUserProfileUsecase,
  setCurrentUser,
} from "@/features/user/api";
import { getRevokeTokenUsecase, getSendVerificationCodeUsecase } from "@/features/auth/api";
import { readAuthSession, writeAuthSession } from "@/shared/utils/localState";

/**
 * 注册 user-profile 请求/响应桥接（native ↔ webview）。
 *
 * @param router - 应用路由实例。
 * @returns 无返回值。
 */
export function registerUserProfileBridge(router: Router): void {
  void listenUserProfileRequest(async (event) => {
    const payload = event.payload;
    const socket = currentServerSocket.value;
    if (!socket) {
      await emitUserProfileResponse({
        id: payload.id,
        ok: false,
        message: "Missing server socket",
      });
      return;
    }

    try {
      if (payload.type === "send_email_code") {
        await getSendVerificationCodeUsecase(socket).execute(payload.email);
        await emitUserProfileResponse({ id: payload.id, ok: true });
        return;
      }

      if (payload.type === "logout") {
        const session = readAuthSession(socket);
        const refreshToken = session?.refreshToken ?? "";
        if (refreshToken) {
          await getRevokeTokenUsecase(socket).execute(refreshToken);
        }
        writeAuthSession(socket, null);
        setCurrentUser({ id: "", username: "", email: "", description: "" });
        setServerSocket("");
        void router.replace("/");
        await emitUserProfileResponse({ id: payload.id, ok: true });
        return;
      }

      if (payload.type === "update_profile") {
        if (payload.emailUpdate) {
          await getUpdateUserEmailUsecase(socket).execute(payload.emailUpdate.email, payload.emailUpdate.code);
        }
        await getUpdateUserProfileUsecase(socket).execute(
          payload.profile.username,
          payload.profile.avatar,
          payload.profile.sex,
          payload.profile.brief,
          payload.profile.birthday,
        );

        setCurrentUser({
          username: payload.profile.username,
          description: payload.profile.brief,
          email: payload.emailUpdate?.email ?? currentUser.email,
        });

        await emitUserProfileResponse({ id: payload.id, ok: true });
      }
    } catch (e) {
      await emitUserProfileResponse({
        id: payload.id,
        ok: false,
        message: String(e),
      });
    }
  });
}

