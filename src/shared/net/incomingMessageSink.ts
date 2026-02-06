/**
 * @fileoverview 入站消息 sink（依赖倒置）。
 * @description
 * 背景：
 * - TCP/WS 传输层可能收到“业务消息”载荷；
 * - 传输层不应直接依赖 chat 的展示层组件（避免 data → presentation 的反向依赖）；
 * - 通过 sink 注入，将“消息如何落地”交给上层（例如 chat store）决定。
 */

import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("incomingMessageSink");

/**
 * 入站消息上下文（最小必要信息）。
 */
export type IncomingMessageContext = {
  serverSocket: string;
};

/**
 * 入站消息 sink 接口。
 */
export type IncomingMessageSink = {
  showNewMessage(payload: unknown, ctx: IncomingMessageContext): void;
};

let sink: IncomingMessageSink | null = null;

/**
 * 注册入站消息 sink（由 chat 等宿主模块调用）。
 *
 * @param next - sink 实例；传入 `null` 表示清空。
 */
export function setIncomingMessageSink(next: IncomingMessageSink | null): void {
  sink = next;
}

/**
 * 发布入站消息。
 *
 * 若未注册 sink，则仅记录 debug 日志，避免把未知 payload 扩散到 UI。
 *
 * @param payload - 原始消息载荷。
 * @param ctx - 上下文（至少包含 serverSocket）。
 */
export function publishIncomingMessage(payload: unknown, ctx: IncomingMessageContext): void {
  const socket = String(ctx?.serverSocket ?? "").trim();
  if (!sink) {
    logger.debug("Action: incoming_message_unwired", { serverSocket: socket, payload });
    return;
  }
  try {
    sink.showNewMessage(payload, { serverSocket: socket });
  } catch (e) {
    logger.warn("Action: incoming_message_sink_failed", { serverSocket: socket, error: String(e) });
  }
}

