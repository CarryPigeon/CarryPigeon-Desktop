/**
 * @fileoverview audit-logs wire → 领域映射。
 */

import { asOptionalString, asSafeBoolean, asSafeNumber, asTrimmedString } from "@/shared/data/wireMapperUtils";
import type { AuditLogItem, AuditLogPage } from "../domain/contracts";
import type { AuditLogItemWire, AuditLogPageWire } from "./auditLogWire";

/**
 * 将审计日志项 wire 映射为领域模型。
 */
export function mapAuditLogItemWire(wire: AuditLogItemWire | null | undefined): AuditLogItem | null {
  if (!wire) return null;
  const auditId = asTrimmedString(wire.audit_id);
  const channelId = asTrimmedString(wire.cid);
  if (!auditId || !channelId) return null;
  return {
    auditId,
    channelId,
    actorUserId: asTrimmedString(wire.actor_uid),
    action: asTrimmedString(wire.action) || "unknown",
    details: wire.details,
    createdAt: asSafeNumber(wire.created_at),
  };
}

/**
 * 将审计日志分页 wire 映射为领域分页。
 */
export function mapAuditLogPageWire(wire: AuditLogPageWire | null | undefined): AuditLogPage {
  const items: AuditLogItem[] = [];
  for (const row of wire?.items ?? []) {
    const item = mapAuditLogItemWire(row);
    if (item) items.push(item);
  }
  return {
    items,
    nextCursor: asOptionalString(wire?.next_cursor),
    hasMore: asSafeBoolean(wire?.has_more),
  };
}
