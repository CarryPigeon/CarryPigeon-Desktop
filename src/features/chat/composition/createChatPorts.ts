/**
 * @fileoverview chat ports registry
 * @description
 * 定义 chat feature 的底层 ports 装配结果。
 * 该文件只描述如何创建 ports，不持有模块级单例；
 * 生命周期统一收敛到 application/runtime 装配根（`createChatRuntime.ts`）。
 */

import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ChatEventsPort } from "@/features/chat/domain/ports/chatEventsPort";
import { httpChatApiPort } from "@/features/chat/data/chat-api/httpChatApiPort";
import { wsChatEventsPort } from "@/features/chat/data/chat-events/wsChatEventsPort";

/**
 * chat data/adapters 端口集合。
 */
export type ChatPorts = {
  /**
   * 请求-响应类端口。
   *
   * 职责：
   * - 承接 HTTP / mock / protocol mock 这一类“拉取或提交一次结果”的能力。
   */
  api: ChatApiPort;
  /**
   * 事件流端口。
   *
   * 职责：
   * - 承接 WS / mock event stream 一类“建立连接并持续接收事件”的能力。
   */
  events: ChatEventsPort;
};

/**
 * 创建 chat 底层 ports 集合。
 *
 * 读取建议：
 * - 想知道 chat 最底层依赖了哪些 adapter，先看这里；
 * - 想知道这些 adapter 如何被提升为 application service，再看 `createChatApplicationServices.ts`。
 */
export function createChatPorts(): ChatPorts {
  return {
    api: httpChatApiPort,
    events: wsChatEventsPort,
  };
}
