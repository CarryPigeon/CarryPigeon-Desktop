/**
 * @fileoverview apiErrors 单元测试
 */

import { describe, expect, it } from "vitest";
import { ApiRequestError, parseApiErrorEnvelope } from "./apiErrors";

describe("parseApiErrorEnvelope", () => {
  it("keeps the CarryPigeon error envelope", () => {
    const parsed = parseApiErrorEnvelope(
      {
        error: {
          status: 503,
          reason: "mail_service_unavailable",
          message: "mail service is unavailable",
          request_id: "req-1",
        },
      },
      500,
    );
    expect(parsed.error.status).toBe(503);
    expect(parsed.error.reason).toBe("mail_service_unavailable");
    expect(parsed.error.request_id).toBe("req-1");
  });

  it("maps Spring Boot default 404 JSON to not_found", () => {
    const parsed = parseApiErrorEnvelope(
      {
        timestamp: 1786619345061,
        status: 404,
        error: "Not Found",
        path: "/api/files/list",
      },
      404,
    );
    expect(parsed.error.status).toBe(404);
    expect(parsed.error.reason).toBe("not_found");
    expect(parsed.error.message).toBe("Not Found");
  });
});

describe("ApiRequestError", () => {
  it("does not crash on Spring Boot default error bodies", () => {
    const err = new ApiRequestError(
      parseApiErrorEnvelope(
        { status: 404, error: "Not Found", path: "/api/files/list" },
        404,
      ),
    );
    expect(err.status).toBe(404);
    expect(err.reason).toBe("not_found");
  });
});
