/**
 * @fileoverview chat runtime DI container
 * @description
 * 统一收敛 chat 根运行时所需的 ports、application services 和 gateways 装配，
 * 让上层 runtime 只消费容器结果，而不是逐步理解底层细节。
 */

import { createChatApiGateway, createChatEventsGateway } from "@/features/chat/composition/createChatGateways";
import { createChatPorts, type ChatPorts } from "@/features/chat/composition/createChatPorts";
import { createChatRootServices } from "@/features/chat/composition/createChatRootServices";
import type { ChatApiGateway, ChatEventsGateway } from "@/features/chat/composition/contracts/chatGateway";
import type { ChatRootServices } from "./chatRootServices";

/**
 * chat 根运行时容器。
 */
export type ChatRuntimeContainer = {
  /**
   * chat 根层底层端口。
   *
   * 这些端口通常对应 data adapter 或跨 feature adapter，
   * 应被视为装配细节，而不是上层 UI 的直接依赖。
   */
  ports: ChatPorts;
  /**
   * 基于端口构造出的 application service 分组。
   *
   * 这是 root runtime 和 gateway 之间的主要编排层。
   */
  rootServices: ChatRootServices;
  /**
   * presentation/runtime 真正消费的 gateway 组。
   */
  gateways: {
    api: ChatApiGateway;
    events: ChatEventsGateway;
  };
};

/**
 * 创建 chat 根运行时容器。
 *
 * 固定顺序：
 * 1. 创建端口
 * 2. 创建根层业务服务
 * 3. 把根层业务服务适配为 presentation gateway
 */
export function createChatRuntimeContainer(): ChatRuntimeContainer {
  const ports = createChatPorts();
  const rootServices = createChatRootServices(ports);
  const gateways = {
    api: createChatApiGateway({
      core: rootServices.core,
      governance: rootServices.governance,
    }),
    events: createChatEventsGateway(rootServices.events),
  };

  return {
    ports,
    rootServices,
    gateways,
  };
}
