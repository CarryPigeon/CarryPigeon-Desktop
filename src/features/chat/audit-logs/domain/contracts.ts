/**
 * @fileoverview audit-logs 领域契约。
 * @description
 * 审计日志子域的领域模型，与传输层无关。
 */

export const AuditActions = [
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

export type AuditAction = (typeof AuditActions)[number];

export type AuditLogItem = {
  auditId: string;
  channelId: string;
  actorUserId: string;
  action: AuditAction | string;
  details?: unknown;
  createdAt: number;
};

export type AuditLogPage = {
  items: AuditLogItem[];
  nextCursor?: string;
  hasMore?: boolean;
};

export type AuditLogQuery = {
  cursor?: string;
  limit?: number;
  channelId?: string;
  actorUserId?: string;
  action?: string;
  fromTime?: number;
  toTime?: number;
};
