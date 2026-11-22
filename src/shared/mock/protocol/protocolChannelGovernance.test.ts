import { expect, it } from "vitest";
import { handleProtocolMockApiRequest } from "./protocolMockTransport";

it("serves paged channel summaries and persists bans in protocol mock mode", async () => {
  const serverSocket = "localhost:18081";
  let headers: Record<string, string> = {};
  async function request(method: string, path: string, body: unknown = null) {
    const result = await handleProtocolMockApiRequest({ serverSocket, method, path, headers, body });
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ code: 0, message: "OK" });
    return (result.body as { data: unknown }).data;
  }
  const login = await request("POST", "/auth/login/pwd", { username: "Operator", password: "mock-password" });
  headers = { Authorization: `Bearer ${(login as { access_token: string }).access_token}` };

  const first = await request("GET", "/channels?page=1&page_size=1");
  expect(first).toMatchObject({ page: 1, page_size: 1, total: 4, has_more: true });
  const { items } = first as { items: Array<{ cid: string }> };
  expect(items).toHaveLength(1);
  expect(items[0]).not.toHaveProperty("owner_uid");
  const { cid } = items[0];

  const members = await request("GET", `/channels/${cid}/members?page=1&page_size=1`);
  expect(members).toMatchObject({ items: [{ uid: "1", username: "Operator", role: "owner" }], has_more: true });
  await request("PUT", `/channels/${cid}/bans/2`, { until: 1893456000000, reason: "Spam" });
  expect(await request("GET", `/channels/${cid}/bans`)).toMatchObject({
    items: [{ cid, uid: "2", until: 1893456000000, reason: "Spam" }], total: 1, has_more: false,
  });
  expect(await request("DELETE", `/channels/${cid}/bans/2`)).toBeNull();
  expect(await request("GET", `/channels/${cid}/bans`)).toMatchObject({ items: [], has_more: false });

  const ownerHeaders = headers;
  headers = {};
  const memberLogin = await request("POST", "/auth/login/email", { email: "user2@example.com", code: "123456" });
  headers = { Authorization: `Bearer ${(memberLogin as { access_token: string }).access_token}` };
  await request("POST", `/channels/${cid}/quit`);
  const application = await request("POST", `/channels/${cid}/applications`, { reason: "Project" });
  expect(application).toMatchObject({ cid, uid: "2", status: "pending" });
  expect(await request("GET", "/channels/applications")).toMatchObject({ items: [application], total: 1 });
  headers = ownerHeaders;
  const { application_id } = application as { application_id: string };
  expect(await request("POST", `/channels/${cid}/applications/${application_id}/decisions`, { decision: "approve" }))
    .toMatchObject({ application_id, status: "accepted" });
  expect(await request("PUT", `/channels/${cid}/transfer`, { new_owner: "2" })).toBeNull();
  expect(await request("GET", `/channels/${cid}/members`)).toMatchObject({
    items: expect.arrayContaining([{ uid: "2", username: "Relay", role: "owner", join_time: expect.any(Number) }]),
  });
});
