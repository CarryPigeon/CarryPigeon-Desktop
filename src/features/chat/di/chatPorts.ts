/**
 * @fileoverview chat ports registry
 * @description
 * 定义 chat feature 的底层 ports 装配结果。
 * 该文件只描述如何创建 ports，不持有模块级单例；
 * 生命周期统一收敛到 composition root（`chatRuntime.ts`）。
 */

import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ChatEventsPort } from "@/features/chat/domain/ports/chatEventsPort";
import { httpChatApiPort } from "@/features/chat/data/httpChatApiPort";
import { wsChatEventsPort } from "@/features/chat/data/wsChatEventsPort";

export type ChatPorts = {
  api: ChatApiPort;
  events: ChatEventsPort;
};

export function createChatPorts(): ChatPorts {
  return {
    api: httpChatApiPort,
    events: wsChatEventsPort,
  };
}
