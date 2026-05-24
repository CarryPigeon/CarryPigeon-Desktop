/**
 * @fileoverview audit-logs api types
 * @description 审计日志｜wire types。
 */

export const AUDIT_ACTIONS = [
  "channel.create",
  "channel.delete",
  "channel.update",
  "channel.member.kick",
  "channel.admin.grant",
  "channel.admin.revoke",
  "channel.ban.create",
  "channel.ban.delete",
  "message.delete",
  "message.edit",
  "message.pin",
  "message.unpin",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditLogItemWire = {
  audit_id: string;
  cid: string;
  actor_uid: string;
  action: AuditAction | string;
  details?: unknown;
  created_at: number;
};

export type AuditLogPageWire = {
  items: AuditLogItemWire[];
  next_cursor?: string;
  has_more?: boolean;
};

export type AuditLogQueryWire = {
  cursor?: string;
  limit?: number;
  cid?: string;
  actor_uid?: string;
  action?: string;
  from_time?: number;
  to_time?: number;
};
