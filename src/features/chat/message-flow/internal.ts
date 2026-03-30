/**
 * @fileoverview chat/message-flow 运行时装配出口。
 * @description
 * 为 chat application/runtime 装配根提供 message-flow 子域的内部装配能力。
 */

export { MessageFlowApplicationService } from "./domain/usecases/messageFlowService";
export { createAvailableDomains } from "./domain/services/domains";
export { compareMessages, createMessageMapper, mergeMessages } from "./domain/mappers/messageModel";
export { createMessageEventRouter } from "./domain/event-handlers/messageEventRouter";
