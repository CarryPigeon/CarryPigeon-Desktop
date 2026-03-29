/**
 * @fileoverview chat/message-flow 运行时装配出口。
 * @description
 * 为 chat composition root 提供 message-flow 子域的内部装配能力。
 */

export { createComposerActions } from "./application/composerActions";
export { createAvailableDomains } from "./application/domains";
export { compareMessages, createMessageMapper, mergeMessages } from "./application/messageModel";
export { createMessageActions } from "./application/messageActions";
export { createMessagePaging } from "./application/messagePaging";
export { createMessageEventRouter } from "./application/messageEventRouter";
