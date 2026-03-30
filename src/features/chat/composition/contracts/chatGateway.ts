/**
 * @fileoverview chat runtime 网关类型别名。
 * @description
 * 该文件保留给 presentation/store/live 使用，实际类型定义已下沉到 chat/application/ports。
 *
 * 目的：
 * - 保持 presentation/store/live 不直接指向 application/ports 的路径细节；
 * - 让“gateway”一词在 runtime 装配语义上保持一致。
 */

export type {
  ChatApiPort as ChatApiGateway,
  ChatCoreApiPort as ChatCoreApiGateway,
  ChatEventsPort as ChatEventsGateway,
  ChatGovernanceApiPort as ChatGovernanceApiGateway,
} from "@/features/chat/domain/ports/runtimePorts";
