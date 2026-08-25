/**
 * @fileoverview audit-logs 公共类型。
 */

import type { AuditLogPage, AuditLogQuery } from "./domain/contracts";

export type { AuditAction, AuditLogItem, AuditLogPage, AuditLogQuery } from "./domain/contracts";

/**
 * 审计日志 capability。
 */
export type ChatAuditLogCapabilities = {
  listAuditLogs(query: AuditLogQuery): Promise<AuditLogPage>;
};
