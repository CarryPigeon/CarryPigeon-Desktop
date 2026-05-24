/**
 * @fileoverview audit-logs api contract
 * @description 审计日志｜API 类型定义。
 */

import type { AuditLogPageWire, AuditLogQueryWire } from "./api-types";

export type ChatAuditLogApi = {
  listAuditLogs(serverSocket: string, accessToken: string, query: AuditLogQueryWire): Promise<AuditLogPageWire>;
};
