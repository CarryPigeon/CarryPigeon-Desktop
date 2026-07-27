/**
 * @fileoverview useLoginPasswordAuth.ts
 * @description account/auth-flow｜页面编排：用户名密码登录/注册。
 */

import { ref, type Ref } from "vue";
import type { Router } from "vue-router";
import { getAuthFlowCapabilities } from "@/features/account/auth-flow/api";
import type { AuthSignInOutcome } from "@/features/account/auth-flow/application/authFlowOutcome";
import { AuthError, toAuthErrorMessage } from "@/features/account/auth-flow/domain/errors/AuthErrors";
import { authServerSocket } from "@/features/account/auth-flow/integration/serverWorkspace";

const authFlowCapabilities = getAuthFlowCapabilities();

export type UseLoginPasswordAuthDeps = {
  router: Router;
  mode?: "login" | "register";
  onRequiredSetup?: (outcome: Extract<AuthSignInOutcome, { kind: "required_setup" }>) => void;
};

export type LoginPasswordAuthModel = {
  username: Ref<string>;
  password: Ref<string>;
  loggingIn: Ref<boolean>;
  banner: Ref<string>;
  clearBanner(): void;
  handlePasswordAuth(): Promise<void>;
};

/**
 * 用户名密码认证模型（登录 / 注册后登录）。
 */
export function useLoginPasswordAuth(deps: UseLoginPasswordAuthDeps): LoginPasswordAuthModel {
  const { router } = deps;

  const username = ref("");
  const password = ref("");
  const loggingIn = ref(false);
  const banner = ref("");

  function clearBanner(): void {
    banner.value = "";
  }

  function readRequiredSocket(): string | null {
    const socket = authServerSocket.value.trim();
    if (socket) return socket;
    banner.value = toAuthErrorMessage(new AuthError({ code: "missing_server_socket", message: "Missing server socket." }));
    return null;
  }

  function readRequiredCredentials(): { username: string; password: string } | null {
    const usernameValue = username.value.trim();
    const passwordValue = password.value;
    if (usernameValue && passwordValue) {
      return { username: usernameValue, password: passwordValue };
    }
    banner.value = toAuthErrorMessage(
      new AuthError({ code: "missing_username_or_password", message: "Missing username or password." }),
    );
    return null;
  }

  async function handlePasswordAuth(): Promise<void> {
    clearBanner();
    const socket = readRequiredSocket();
    if (!socket) return;
    const credential = readRequiredCredentials();
    if (!credential) return;
    const authServer = authFlowCapabilities.forServer(socket);

    loggingIn.value = true;
    try {
      const outcome =
        deps.mode === "register"
          ? await authServer.registerAndSignInWithPassword(credential.username, credential.password)
          : await authServer.signInWithPassword(credential.username, credential.password);

      if (outcome.ok && outcome.kind === "signed_in") {
        void router.replace({
          path: outcome.redirectTo,
          query: outcome.login.isNewUser ? { welcome: "new" } : undefined,
        });
        return;
      }
      if (outcome.ok && outcome.kind === "required_setup") {
        authFlowCapabilities.updateMissingRequiredPlugins([...outcome.missingPluginIds]);
        if (deps.onRequiredSetup) {
          deps.onRequiredSetup(outcome);
        } else {
          void router.replace("/required-setup");
        }
        return;
      }
      banner.value = outcome.error.message;
    } finally {
      loggingIn.value = false;
    }
  }

  return {
    username,
    password,
    loggingIn,
    banner,
    clearBanner,
    handlePasswordAuth,
  };
}
