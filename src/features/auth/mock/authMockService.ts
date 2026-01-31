/**
 * @fileoverview authMockService.ts 文件职责说明。
 */
import { MOCK_LATENCY_MS } from "@/shared/config/runtime";

/**
 * delay 方法说明。
 * @param ms - 参数说明。
 * @returns 返回值说明。
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockEmailService {
  constructor(_serverSocket: string) {}

  /**
   * sendCode method.
   * @returns TODO.
   */
  async sendCode(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
  }
}
