/**
 * @fileoverview chat/message-flow 对外 API。
 * @description
 * 暴露消息流能力（时间线、composer、发送、回复、删除）。
 */

import type {
  MessageFlowCapabilities,
} from "./api-types";
import { createMessageFlowCapabilitySource } from "./capability-source";

/**
 * 创建 message-flow 子域能力对象。
 */
export function createMessageFlowCapabilities(): MessageFlowCapabilities {
  return createMessageFlowCapabilitySource();
}

let messageFlowCapabilitiesSingleton: MessageFlowCapabilities | null = null;

/**
 * 获取 message-flow 子域共享能力对象。
 */
export function getMessageFlowCapabilities(): MessageFlowCapabilities {
  messageFlowCapabilitiesSingleton ??= createMessageFlowCapabilities();
  return messageFlowCapabilitiesSingleton;
}
