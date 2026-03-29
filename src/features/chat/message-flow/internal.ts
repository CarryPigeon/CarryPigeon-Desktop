/**
 * @fileoverview chat/message-flow 运行时装配出口。
 * @description
 * 为 chat application/runtime 装配根提供 message-flow 子域的内部装配能力。
 */

export { createComposerActions } from "./application/usecases/composerActions";
export { createMessageActions } from "./application/usecases/messageActions";
export { createMessagePaging } from "./application/usecases/messagePaging";
export { createAvailableDomains } from "./application/services/domains";
export { compareMessages, createMessageMapper, mergeMessages } from "./application/mappers/messageModel";
export { createMessageEventRouter } from "./application/event-handlers/messageEventRouter";
