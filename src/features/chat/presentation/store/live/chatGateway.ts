/**
 * @fileoverview chat runtime 网关类型别名。
 * @description
 * 该文件保留给 presentation/store/live 使用，实际类型定义已下沉到 chat/application/ports。
 */

export type {
  ChatApiPort as ChatApiGateway,
  ChatCoreApiPort as ChatCoreApiGateway,
  ChatEventsPort as ChatEventsGateway,
  ChatGovernanceApiPort as ChatGovernanceApiGateway,
} from "@/features/chat/application/ports/runtimePorts";
