import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpJsonClient, probeServerReadiness } from "./httpJsonClient";

const transport = vi.hoisted(() => ({ native: false, invoke: vi.fn() }));
vi.mock("@/shared/config/runtime", () => ({ USE_MOCK_TRANSPORT: false }));
vi.mock("@/shared/mock/protocol/protocolMockTransport", () => ({ handleProtocolMockApiRequest: vi.fn() }));
vi.mock("@/shared/tauri", () => ({
  isTauriRuntimeAvailable: () => transport.native,
  invokeTauri: transport.invoke,
  tauriLog: { warn: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) },
  TAURI_COMMANDS: { apiRequestJson: "api_request_json" },
}));

const origin = "http://localhost:19080";
const makeClient = () => new HttpJsonClient({ serverSocket: origin, apiVersion: 1 });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  transport.native = false;
  transport.invoke.mockReset();
  vi.unstubAllGlobals();
});

describe("Server HTTP contract", () => {
  it("returns data from browser transport", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ code: 0, message: "OK", data: { items: ["1"] } })));
    await expect(makeClient().requestJson("GET", "/channels?page=1&page_size=20")).resolves.toEqual({ items: ["1"] });
  });

  it("rejects HTTP 200 business errors from browser transport", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ code: 20002, message: "channel membership is required" })));
    await expect(makeClient().requestJson("POST", "/channels/1/messages", {})).rejects.toMatchObject({ code: 20002, status: 200 });
  });

  it.each([200, 403])("does not repeat a native write after receiving a business error on HTTP %s", async status => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    transport.native = true;
    const error = { code: 20006, message: "owner required" };
    transport.invoke.mockResolvedValue(status === 200 ? { ok: true, status, body: error } : { ok: false, status, error });
    await expect(makeClient().requestJson("DELETE", "/channels/1")).rejects.toMatchObject({ code: 20006, status });
    expect(transport.invoke).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([[204, "ready"], [503, "unavailable"], [403, "forbidden"]] as const)("reads %s from the status-only probe", async (status, state) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(probeServerReadiness(origin)).resolves.toBe(state);
    expect(fetchMock).toHaveBeenCalledWith(`${origin}/internal/readiness`, { cache: "no-store", redirect: "error" });
  });
});
