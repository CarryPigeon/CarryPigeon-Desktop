/**
 * @fileoverview mockEmailServicePort.ts
 * @description auth｜Mock 实现：mockEmailServicePort（用于本地预览/测试）。
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import type { EmailServicePort } from "../domain/ports/EmailServicePort";

/**
 * 创建 `EmailServicePort` 的 mock 实现。
 *
 * @param serverSocket - 服务器 Socket 地址（mock 邮件流中不使用，仅保留签名一致性）。
 * @returns `EmailServicePort` 实现。
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
