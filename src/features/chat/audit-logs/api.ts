/**
 * @fileoverview chat/audit-logs 对外 API。
 * @description 暴露审计日志查询能力。不导出 wire DTO。
 */

import type { ChatAuditLogCapabilities } from "./api-types";
import { createAuditLogCapabilitySource } from "./capability-source";

export type { AuditAction, AuditLogItem, AuditLogPage, AuditLogQuery, ChatAuditLogCapabilities } from "./api-types";

export function createAuditLogCapabilities(): ChatAuditLogCapabilities {
  return createAuditLogCapabilitySource();
}

let auditLogCapabilitiesSingleton: ChatAuditLogCapabilities | null = null;

export function getAuditLogCapabilities(): ChatAuditLogCapabilities {
  auditLogCapabilitiesSingleton ??= createAuditLogCapabilities();
  return auditLogCapabilitiesSingleton;
}
