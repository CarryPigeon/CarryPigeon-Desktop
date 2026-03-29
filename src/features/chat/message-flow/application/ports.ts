/**
 * @fileoverview message-flow 应用层输出端口。
 * @description chat/message-flow｜application：面向消息流用例编排的最小依赖集合。
 */

import type { ChatReadStateReporterPort } from "@/features/chat/application/ports/runtimePorts";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { MessageDomain } from "@/features/chat/message-flow/contracts";

/**
 * message-flow 应用层所需的最小 API 能力。
 */
export type MessageFlowApiPort = Pick<
  ChatApiPort,
  "sendChannelMessage" | "deleteMessage" | "listChannelMessages"
>;

/**
 * message-flow 发送消息后依赖的读状态推进能力。
 */
export type ReadStateReporterPort = ChatReadStateReporterPort;

/**
 * message-flow 查询可用消息 domain 的最小端口。
 */
export type AvailableMessageDomainsPort = {
  getActiveServerSocket(): string;
  getAvailableMessageDomains(serverSocket: string): MessageDomain[];
};
