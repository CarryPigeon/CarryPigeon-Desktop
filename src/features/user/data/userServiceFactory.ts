/**
 * @fileoverview userServiceFactory.ts 文件职责说明。
 */
import { USE_MOCK_API } from "@/shared/config/runtime";
import { UserService } from "./userApiImpl";
import { MockUserService } from "../mock/userMockService";

/**
 * createUserService 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function createUserService(serverSocket: string) {
  return USE_MOCK_API ? new MockUserService(serverSocket) : new UserService(serverSocket);
}
