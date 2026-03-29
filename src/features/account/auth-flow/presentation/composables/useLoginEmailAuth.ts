/**
 * @fileoverview useLoginEmailAuth.ts
 * @description account/auth-flow｜页面编排：登录认证动作（发码/登录/倒计时）。
 */

import { onBeforeUnmount, ref, type Ref } from "vue";
import type { Router } from "vue-router";
import { getAuthFlowCapabilities } from "@/features/account/auth-flow/api";
import { AuthError, toAuthErrorMessage } from "@/features/account/auth-flow/domain/errors/AuthErrors";
import { authServerSocket } from "@/features/account/auth-flow/integration/serverWorkspace";

const authFlowCapabilities = getAuthFlowCapabilities();

export type UseLoginEmailAuthDeps = {
  router: Router;
};

export type LoginEmailAuthModel = {
  email: Ref<string>;
  code: Ref<string>;
  sending: Ref<boolean>;
  loggingIn: Ref<boolean>;
  banner: Ref<string>;
  countdown: Ref<number>;
  clearBanner(): void;
  handleSendCode(): Promise<void>;
  handleLogin(): Promise<void>;
};

/**
 * 登录认证模型（发码 + 登录）。
 *
 * @param deps - 依赖（路由）。
 * @returns 页面可直接绑定的认证状态与动作。
 */
export function useLoginEmailAuth(deps: UseLoginEmailAuthDeps): LoginEmailAuthModel {
  const { router } = deps;

  const email = ref("");
  const code = ref("");
  const sending = ref(false);
  const loggingIn = ref(false);
  const banner = ref("");
  const countdown = ref(0);

  let countdownTimer: number | null = null;

  function toBannerMessage(error: unknown): string {
    return toAuthErrorMessage(error);
  }

  function clearBanner(): void {
    banner.value = "";
  }

  function stopCountdown(): void {
    if (!countdownTimer) return;
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }

  function startCountdown(seconds: number): void {
    stopCountdown();
    countdown.value = Math.max(0, Math.trunc(seconds));
    countdownTimer = window.setInterval(() => {
      countdown.value = Math.max(0, countdown.value - 1);
      if (countdown.value <= 0) stopCountdown();
    }, 1000);
  }

  function readRequiredSocket(): string | null {
    const socket = authServerSocket.value.trim();
    if (socket) return socket;
    banner.value = toBannerMessage(new AuthError({ code: "missing_server_socket", message: "Missing server socket." }));
    return null;
  }

  function readRequiredEmail(): string | null {
    const value = email.value.trim();
    if (value) return value;
    banner.value = toBannerMessage(new AuthError({ code: "missing_email", message: "Missing email." }));
    return null;
  }

  function readRequiredEmailAndCode(): { email: string; code: string } | null {
    const emailValue = email.value.trim();
    const codeValue = code.value.trim();
    if (emailValue && codeValue) {
      return { email: emailValue, code: codeValue };
    }
    banner.value = toBannerMessage(new AuthError({ code: "missing_email_or_code", message: "Missing email or code." }));
    return null;
  }

  async function handleSendCode(): Promise<void> {
    clearBanner();
    const socket = readRequiredSocket();
    if (!socket) return;
    const emailValue = readRequiredEmail();
    if (!emailValue) return;
    const authServer = authFlowCapabilities.forServer(socket);

    sending.value = true;
    try {
      const outcome = await authServer.sendVerificationCode(emailValue);
      if (outcome.ok) {
        startCountdown(outcome.cooldownSec);
        banner.value = "Code sent.";
      } else {
        banner.value = outcome.error.message;
      }
    } finally {
      sending.value = false;
    }
  }

  async function handleLogin(): Promise<void> {
    clearBanner();
    const socket = readRequiredSocket();
    if (!socket) return;
    const credential = readRequiredEmailAndCode();
    if (!credential) return;
    const authServer = authFlowCapabilities.forServer(socket);

    loggingIn.value = true;
    try {
      const outcome = await authServer.signInWithEmailCode(credential.email, credential.code);
      if (outcome.ok && outcome.kind === "signed_in") {
        void router.replace({ path: outcome.redirectTo, query: outcome.login.isNewUser ? { welcome: "new" } : undefined });
        return;
      }
      if (outcome.ok && outcome.kind === "required_setup") {
        authFlowCapabilities.updateMissingRequiredPlugins([...outcome.missingPluginIds]);
        void router.replace("/required-setup");
        return;
      }
      banner.value = outcome.error.message;
    } finally {
      loggingIn.value = false;
    }
  }

  onBeforeUnmount(() => {
    stopCountdown();
  });

  return {
    email,
    code,
    sending,
    loggingIn,
    banner,
    countdown,
    clearBanner,
    handleSendCode,
    handleLogin,
  };
}
