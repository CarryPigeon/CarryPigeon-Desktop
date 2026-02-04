/**
 * @fileoverview mockEmailServicePort.ts
 * @description Mock EmailServicePort implementation for UI preview.
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import type { EmailServicePort } from "../domain/ports/EmailServicePort";

/**
 * Create a mock EmailServicePort.
 *
 * @param serverSocket - Server socket (unused in mock email flow).
 * @returns EmailServicePort implementation.
 */
export function createMockEmailServicePort(serverSocket: string): EmailServicePort {
  void serverSocket;
  return {
    async sendCode(email: string): Promise<void> {
      void email;
      await sleep(MOCK_LATENCY_MS);
      return;
    },
  };
}
