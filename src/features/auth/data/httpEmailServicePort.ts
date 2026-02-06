/**
 * @fileoverview httpEmailServicePort.ts
 * @description auth｜数据层实现：httpEmailServicePort。
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import type { EmailServicePort } from "../domain/ports/EmailServicePort";

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
      if (!value) throw new Error("Missing email");
      await client.requestJson<void>("POST", "/auth/email_codes", { email: value });
    },
  };
}
