/**
 * @fileoverview chat root services factory
 * @description
 * 统一描述 chat 根层服务的构造方式。
 *
 * 设计原因：
 * - 根层不再先创建大量单方法 usecase 对象，再包一层 service；
 * - composition 侧直接消费少量按语义聚合的 root service，避免装配参数膨胀；
 * - 该文件只负责“如何创建 root service”，不负责“何时缓存/复用”；
 * - 生命周期统一由 `createChatRuntime.ts` 的 composition 装配根决定。
 */

import {
  ChatCoreApplicationService,
  ChatEventStreamApplicationService,
  ChatGovernanceApplicationService,
  type ChatRootServices,
} from "@/features/chat/composition/chatRootServices";
import type { ChatPorts } from "./createChatPorts";

/**
 * 基于 ports 创建 chat 根层服务。
 *
 * 说明：
 * - 根层不再逐个创建细粒度 usecase 对象；
 * - runtime/gateway 装配只依赖 `core / governance / events` 三组聚合业务对象。
 */
export function createChatRootServices(ports: ChatPorts): ChatRootServices {
  return {
    core: new ChatCoreApplicationService({
      api: ports.api,
    }),
    governance: new ChatGovernanceApplicationService({
      api: ports.api,
    }),
    events: new ChatEventStreamApplicationService({
      events: ports.events,
    }),
  };
}
