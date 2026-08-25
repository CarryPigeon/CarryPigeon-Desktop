/**
 * @fileoverview httpAuditLogApi 契约测试。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestJson = vi.fn();

vi.mock("@/shared/config/runtime", () => ({
  IS_STORE_MOCK: false,
}));

vi.mock("@/shared/net/http/authedHttpJsonClient", () => ({
  createAuthedHttpJsonClient: () => ({ requestJson }),
}));

import { createHttpAuditLogApi } from "./httpAuditLogApi";

describe("createHttpAuditLogApi", () => {
  beforeEach(() => {
    requestJson.mockReset();
  });

  it("maps domain query to snake_case querystring", async () => {
    requestJson.mockResolvedValueOnce({ items: [], has_more: false });
    const api = createHttpAuditLogApi();
    await api.listAuditLogs("127.0.0.1:8080", "tok", {
      channelId: "11",
      limit: 50,
      actorUserId: "22",
      action: "channel.update",
    });
    expect(requestJson).toHaveBeenCalledWith(
      "GET",
      "/audit_logs?limit=50&cid=11&actor_uid=22&action=channel.update",
    );
  });
});
