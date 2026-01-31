/**
 * @fileoverview serverServiceFactory.ts 文件职责说明。
 */
import { USE_MOCK_API } from "@/shared/config/runtime";
import { ServerDataService } from "./serverDataImpl";
import { MockServerDataService } from "../mock/serverMockService";

/**
 * createServerDataService 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function createServerDataService(serverSocket: string) {
  return USE_MOCK_API ? new MockServerDataService(serverSocket) : new ServerDataService(serverSocket);
}
