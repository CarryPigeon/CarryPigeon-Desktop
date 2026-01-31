/**
 * @fileoverview channelServiceFactory.ts 文件职责说明。
 */
import { USE_MOCK_API } from "@/shared/config/runtime";
import {
  ChannelBasicService,
  ChannelMemberService,
  ChannelMessageService,
  ChannelApplicationService,
} from "./channelApi";
import {
  MockChannelBasicService,
  MockChannelMemberService,
  MockChannelMessageService,
  MockChannelApplicationService,
} from "../mock/channelMockService";

/**
 * createChannelBasicService 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function createChannelBasicService(serverSocket: string) {
  return USE_MOCK_API
    ? new MockChannelBasicService(serverSocket)
    : new ChannelBasicService(serverSocket);
}

/**
 * createChannelMessageService 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function createChannelMessageService(serverSocket: string) {
  return USE_MOCK_API
    ? new MockChannelMessageService(serverSocket)
    : new ChannelMessageService(serverSocket);
}

/**
 * createChannelMemberService 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function createChannelMemberService(serverSocket: string) {
  return USE_MOCK_API
    ? new MockChannelMemberService(serverSocket)
    : new ChannelMemberService(serverSocket);
}

/**
 * createChannelApplicationService 方法说明。
 * @param serverSocket - 参数说明。
 * @returns 返回值说明。
 */
export function createChannelApplicationService(serverSocket: string) {
  return USE_MOCK_API
    ? new MockChannelApplicationService(serverSocket)
    : new ChannelApplicationService(serverSocket);
}
