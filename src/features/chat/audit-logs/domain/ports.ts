/**
 * @fileoverview audit-logs 领域端口。
 */

import type { AuditLogPage, AuditLogQuery } from "./contracts";

export type AuditLogApiPort = {
  listAuditLogs(serverSocket: string, accessToken: string, query: AuditLogQuery): Promise<AuditLogPage>;
};

export type AuditLogScopePort = {
  getSocketAndValidToken(): Promise<[string | null, string | null]>;
};
