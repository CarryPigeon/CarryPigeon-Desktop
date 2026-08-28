/**
 * @fileoverview httpAuditLogApi.ts
 * @description 审计日志｜HTTP 实现。请求与响应在本层完成 wire ↔ 领域映射。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import { IS_STORE_MOCK } from "@/shared/config/runtime";
import { mapAuditLogPageWire } from "./auditLogMappers";
import type { AuditLogPageWire } from "./auditLogWire";
import type { AuditLogApiPort } from "../domain/ports";

/**
 * 创建审计日志远端适配器。
 */
export function createHttpAuditLogApi(): AuditLogApiPort {
  if (IS_STORE_MOCK) {
    return {
      async listAuditLogs() {
        return { items: [], hasMore: false };
      },
    };
  }
  return {
    async listAuditLogs(serverSocket, accessToken, query) {
      const client = createAuthedHttpJsonClient(serverSocket, accessToken);
      const q: string[] = [];
      if (query.cursor) q.push(`cursor=${encodeURIComponent(query.cursor)}`);
      if (query.limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.min(100, Math.trunc(query.limit)))))}`);
      if (query.channelId) q.push(`cid=${encodeURIComponent(query.channelId)}`);
      if (query.actorUserId) q.push(`actor_uid=${encodeURIComponent(query.actorUserId)}`);
      if (query.action) q.push(`action=${encodeURIComponent(query.action)}`);
      if (query.fromTime != null) q.push(`from_time=${encodeURIComponent(String(Math.trunc(query.fromTime)))}`);
      if (query.toTime != null) q.push(`to_time=${encodeURIComponent(String(Math.trunc(query.toTime)))}`);
      const path = `/audit_logs${q.length ? `?${q.join("&")}` : ""}`;
      const wire = await client.requestJson<AuditLogPageWire>("GET", path);
      return mapAuditLogPageWire(wire);
    },
  };
}
