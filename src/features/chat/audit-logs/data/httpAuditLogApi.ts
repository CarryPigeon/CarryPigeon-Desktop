/**
 * @fileoverview httpAuditLogApi.ts
 * @description 审计日志｜HTTP 实现。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import type { ChatAuditLogApi } from "../api";
import type { AuditLogPageWire } from "../api-types";

export function createHttpAuditLogApi(): ChatAuditLogApi {
  return {
    async listAuditLogs(serverSocket, accessToken, query) {
      const client = createAuthedHttpJsonClient(serverSocket, accessToken);
      const q: string[] = [];
      if (query.cursor) q.push(`cursor=${encodeURIComponent(query.cursor)}`);
      if (query.limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.min(100, Math.trunc(query.limit)))))}`);
      if (query.cid) q.push(`cid=${encodeURIComponent(query.cid)}`);
      if (query.actor_uid) q.push(`actor_uid=${encodeURIComponent(query.actor_uid)}`);
      if (query.action) q.push(`action=${encodeURIComponent(query.action)}`);
      if (query.from_time != null) q.push(`from_time=${encodeURIComponent(String(Math.trunc(query.from_time)))}`);
      if (query.to_time != null) q.push(`to_time=${encodeURIComponent(String(Math.trunc(query.to_time)))}`);
      const path = `/audit_logs${q.length ? `?${q.join("&")}` : ""}`;
      return client.requestJson<AuditLogPageWire>("GET", path);
    },
  };
}
