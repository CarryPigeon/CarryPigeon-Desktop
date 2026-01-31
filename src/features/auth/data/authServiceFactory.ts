/**
 * @fileoverview authServiceFactory.ts 文件职责说明。
 */
import { USE_MOCK_API } from "@/shared/config/runtime";
import { EmailService } from "./emailServiceImpl";
import { MockEmailService } from "../mock/authMockService";

/**
 * createEmailService 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function createEmailService(serverSocket: string) {
  return USE_MOCK_API ? new MockEmailService(serverSocket) : new EmailService(serverSocket);
}
