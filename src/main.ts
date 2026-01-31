/**
 * @fileoverview main.ts 文件职责说明。
 */
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./app/router";
import { i18n } from "./app/i18n";
import "tdesign-vue-next/es/style/index.css";
import { listenUserProfileRequest, emitUserProfileResponse } from "@/shared/tauri";
import { currentServerSocket, setServerSocket } from "@/features/servers/presentation/store/currentServer";
import { createUserService } from "@/features/user/data/userServiceFactory";
import { createEmailService } from "@/features/auth/data/authServiceFactory";
import { setCurrentUser, currentUser } from "@/features/user/presentation/store/userData";
import { readAuthToken, writeAuthToken } from "@/shared/utils/localState";
import { getStoredTheme, setTheme } from "@/shared/utils/theme";

const app = createApp(App);
app.use(router).use(i18n);

// Theme: default to Patchbay unless user explicitly chose legacy.
setTheme(getStoredTheme() ?? "patchbay");

const searchParams = new URLSearchParams(window.location.search);
const windowType = searchParams.get("window");
const isSubWindow = Boolean(windowType);

if (windowType === "user-info-popover") {
  router.replace({
    path: "/user-info-popover",
    query: {
      avatar: searchParams.get("avatar") ?? "",
      name: searchParams.get("name") ?? "",
      email: searchParams.get("email") ?? "",
      bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
    },
  });
} else if (windowType === "channel-info-popover") {
  router.replace({
    path: "/channel-info-popover",
    query: {
      avatar: searchParams.get("avatar") ?? "",
      name: searchParams.get("name") ?? "",
      bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
    },
  });
} else if (windowType === "channel-info") {
  router.replace({
    path: "/channel-info",
    query: {
      avatar: searchParams.get("avatar") ?? "",
      name: searchParams.get("name") ?? "",
      bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
      owner: searchParams.get("owner") ?? "",
    },
  });
} else if (windowType === "user-profile") {
  router.replace({
    path: "/user_info",
    query: {
      uid: searchParams.get("uid") ?? "",
      avatar: searchParams.get("avatar") ?? "",
      name: searchParams.get("name") ?? "",
      email: searchParams.get("email") ?? "",
      bio: searchParams.get("bio") ?? searchParams.get("description") ?? "",
      sex: searchParams.get("sex") ?? "",
      birthday: searchParams.get("birthday") ?? "",
      avatar_id: searchParams.get("avatar_id") ?? "",
      editable: searchParams.get("editable") ?? "",
    },
  });
}

if (!isSubWindow) {
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
        await createEmailService(socket).sendCode(payload.email);
        await emitUserProfileResponse({ id: payload.id, ok: true });
        return;
      }

      if (payload.type === "logout") {
        const token = readAuthToken(socket);
        if (token) {
          await createUserService(socket).logoutToken(token);
        }
        writeAuthToken(socket, "");
        setCurrentUser({ id: 0, username: "", email: "", description: "" });
        setServerSocket("");
        void router.replace("/");
        await emitUserProfileResponse({ id: payload.id, ok: true });
        return;
      }

      if (payload.type === "update_profile") {
        const userService = createUserService(socket);
        if (payload.emailUpdate) {
          await userService.updateUserEmail(payload.emailUpdate.email, payload.emailUpdate.code);
        }
        await userService.updateUserProfile(
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

router.isReady().then(() => {
  app.mount("#app");
});
