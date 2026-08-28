/**
 * @fileoverview audit-logs mapper 契约测试。
 */
import { describe, expect, it } from "vitest";
import { mapAuditLogPageWire } from "./auditLogMappers";

describe("mapAuditLogPageWire", () => {
  it("maps snake_case audit page to domain", () => {
    const page = mapAuditLogPageWire({
      items: [
        {
          audit_id: "a1",
          cid: "c1",
          actor_uid: "u1",
          action: "channel.update",
          details: "{\"name\":\"n\"}",
          created_at: 1700000000000,
        },
      ],
      next_cursor: "n1",
      has_more: true,
    });
    expect(page).toEqual({
      items: [
        {
          auditId: "a1",
          channelId: "c1",
          actorUserId: "u1",
          action: "channel.update",
          details: "{\"name\":\"n\"}",
          createdAt: 1700000000000,
        },
      ],
      nextCursor: "n1",
      hasMore: true,
    });
  });
});
