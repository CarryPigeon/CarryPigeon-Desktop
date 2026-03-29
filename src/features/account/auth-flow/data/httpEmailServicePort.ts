/**
 * @fileoverview httpEmailServicePort.ts
 * @description account/auth-flow｜数据层实现：httpEmailServicePort。
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import type { EmailServicePort } from "../domain/ports/EmailServicePort";
import { AuthError } from "../domain/errors/AuthErrors";

/**
 * 创建 HTTP 版本的 EmailServicePort。
 *
 * @param serverSocket - 服务端 socket。
 * @returns EmailServicePort 实现。
 */
export function createHttpEmailServicePort(serverSocket: string): EmailServicePort {
  const client = new HttpJsonClient({ serverSocket, apiVersion: 1 });
  return {
    async sendCode(email: string): Promise<void> {
      const value = email.trim();
      if (!value) {
        throw new AuthError({ code: "missing_email", message: "Missing email." });
      }
      try {
        await client.requestJson<void>("POST", "/auth/email_codes", { email: value });
      } catch (e) {
        if (e instanceof AuthError) throw e;
        if (isApiRequestError(e)) {
          throw new AuthError({
            code: "send_code_failed",
            message: `Send code failed: ${e.reason} (HTTP ${e.status})`,
            status: e.status,
            reason: e.reason,
            details: e.details,
            cause: e,
          });
        }
        throw new AuthError({
          code: "send_code_failed",
          message: String(e) || "Send code failed.",
          cause: e,
        });
      }
    },
  };
}
