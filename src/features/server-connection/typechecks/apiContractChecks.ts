/**
 * @fileoverview server-connection API 编译期契约检查。
 * @description
 * 该文件只用于 TypeScript 编译期检查 server-connection 根 capability 入口的稳定契约。
 */

import { createServerConnectionCapabilities, getServerConnectionCapabilities } from "@/features/server-connection/api";
import type {
  ServerConnectionCapabilities,
  ServerWorkspaceSnapshot,
} from "@/features/server-connection/api-types";
import type { ReadableCapability } from "@/shared/types/capabilities";

export const serverConnectionCapabilityContractCheck: ServerConnectionCapabilities =
  createServerConnectionCapabilities();

export const serverConnectionCapabilityAccessorContractCheck: ServerConnectionCapabilities =
  getServerConnectionCapabilities();

export const serverWorkspaceReadableContractCheck: ReadableCapability<ServerWorkspaceSnapshot> =
  serverConnectionCapabilityContractCheck.workspace;
