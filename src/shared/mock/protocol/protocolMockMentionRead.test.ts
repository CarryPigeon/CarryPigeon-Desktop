import { expect, it } from "vitest";
import { handleProtocolMockApiRequest } from "./protocolMockTransport";

async function authedMock(serverSocket: string) {
  const login = await handleProtocolMockApiRequest({ serverSocket, method: "POST", path: "/auth/login/pwd", headers: {}, body: { username: "Operator", password: "password" } });
  if (!login.ok) throw new Error("Mock login failed");
  const loginBody = unwrap(login.body) as { access_token: string };
  return async (method: string, path: string, body?: unknown) => {
    const response = await handleProtocolMockApiRequest({ serverSocket, method, path, headers: { Authorization: `Bearer ${loginBody.access_token}` }, body });
    if (!response.ok) throw new Error(`Mock request failed for ${path}`);
    return unwrap(response.body);
  };
}

function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && "code" in body && body.code === 0 && "data" in body) return body.data;
  return body;
}

it("keeps mention reads independent of channel message reads", async () => {
  const call = await authedMock("protocol-mention-read.local");
  const page = await call("GET", "/channels/cid-prod/mentions?unread_only=true") as { items: Array<{ mention_id: string; read: boolean }> };
  expect(page.items).toHaveLength(1);
  const id = page.items[0].mention_id;
  expect(await call("GET", `/mentions/${id}`)).toMatchObject({ read: false });
  expect(await call("POST", "/mentions/ids", { mention_ids: [id, id, "9999"] })).toMatchObject({ items: [expect.objectContaining({ mention_id: id })] });
  expect(await call("PUT", "/channels/cid-prod/mentions/read", { through_mention_id: id })).toBeNull();
  expect(await call("GET", "/channels/cid-prod/mentions?unread_only=true")).toEqual({ items: [], next_cursor: null, has_more: false });
  expect(await call("GET", "/channels/cid-prod/read_state")).toMatchObject({ last_read_mid: null, unread_count: 1 });
});

it("counts only effective unread messages and preserves the server MID", async () => {
  const call = await authedMock("protocol-channel-read.local");
  const page = await call("GET", "/mentions") as { items: Array<{ mid: string }> };
  const mid = page.items[0].mid;
  expect(await call("GET", "/unreads")).toMatchObject({ total: 1, items: [{ cid: "cid-prod", unread_count: 1 }] });
  expect(await call("PUT", "/channels/cid-prod/read_state", { last_read_mid: mid })).toEqual({ cid: "cid-prod", uid: "1", last_read_mid: mid });
  expect(await call("PUT", "/channels/cid-ann/read_state", { last_read_mid: mid })).toMatchObject({ code: 30001 });
  expect(await call("GET", "/unreads")).toEqual({ total: 0, items: [] });
  expect(await call("GET", "/mentions?unread_only=true")).toMatchObject({ items: [expect.objectContaining({ mid, read: false })] });
});
