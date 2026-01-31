/**
 * @fileoverview userMockService.ts 文件职责说明。
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

export class MockUserService {
  constructor(_serverSocket: string) {}

  /**
   * register method.
   * @returns TODO.
   */
  async register(): Promise<string> {
    await delay(MOCK_LATENCY_MS);
    return "mock-token";
  }

  /**
   * loginByEmail method.
   * @returns TODO.
   */
  async loginByEmail(): Promise<string> {
    await delay(MOCK_LATENCY_MS);
    return "mock-token";
  }

  /**
   * loginByToken method.
   * @param token - TODO.
   * @returns TODO.
   */
  async loginByToken(token: string): Promise<{ token: string; uid: number }> {
    await delay(MOCK_LATENCY_MS);
    return { token, uid: 1 };
  }

  /**
   * logoutToken method.
   * @returns TODO.
   */
  async logoutToken(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
  }

  /**
   * getUserProfile method.
   * @returns TODO.
   */
  async getUserProfile(): Promise<Record<string, unknown>> {
    await delay(MOCK_LATENCY_MS);
    return {
      username: "MockUser",
      avatar: -1,
      email: "mock@example.com",
      sex: 0,
      brief: "Mock profile",
      birthday: Date.now() - 1000 * 60 * 60 * 24 * 365 * 10,
    };
  }

  /**
   * updateUserProfile method.
   * @returns TODO.
   */
  async updateUserProfile(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
  }

  /**
   * updateUserEmail method.
   * @returns TODO.
   */
  async updateUserEmail(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
  }
}
