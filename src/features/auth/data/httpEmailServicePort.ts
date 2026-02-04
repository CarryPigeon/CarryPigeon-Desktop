/**
 * @fileoverview httpEmailServicePort.ts
 * @description HTTP implementation of EmailServicePort.
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import type { EmailServicePort } from "../domain/ports/EmailServicePort";

/**
 * Create an HTTP-backed EmailServicePort.
 *
 * @param serverSocket - Server socket.
 * @returns EmailServicePort implementation.
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
