import { expect, it } from "vitest";
import { handleProtocolMockApiRequest } from "@/shared/mock/protocol/protocolMockTransport";

it("exercises registration, credentials, profile updates and rotation in protocol mock", async () => {
  let headers: Record<string, string> = {};
  const request = (method: string, path: string, body?: unknown) => handleProtocolMockApiRequest({
    serverSocket: "mock://account-lifecycle", method, path, headers, body,
  });
  const username = "alice";
  const email = "alice@example.test";
  const password = "mock-password";
  const code = "123456";
  expect(await request("POST", "/auth/email_codes", { email, purpose: "REGISTER" })).toMatchObject({ body: { code: 0, data: null } });
  const registration = await request("POST", "/auth/register", { username, email, password, code });
  expect(registration).toMatchObject({ body: { code: 0, data: { username, uid: expect.any(String) } } });
  const login = await request("POST", "/auth/login/pwd", { username, password });
  expect(login).toMatchObject({ body: { code: 0, data: { access_token: expect.any(String), refresh_token: expect.any(String) } } });
  if (!login.ok) throw new Error("Protocol login failed.");
  const token = (login.body as { data: { access_token: string; refresh_token: string; uid: string } }).data;
  headers = { Authorization: `Bearer ${token.access_token}` };
  expect(await request("PATCH", "/users/me", { sex: 2, birthday: 12345 })).toMatchObject({ body: { code: 0, data: null } });
  expect(await request("PATCH", "/users/me", { brief: "Updated" })).toMatchObject({ body: { code: 0, data: null } });
  expect(await request("GET", `/users/${token.uid}/detail`)).toMatchObject({ body: {
    code: 0, data: { username, uid: token.uid, email, sex: 2, birthday: 12345, bio: "Updated" },
  } });
  expect(await request("GET", `/users?ids=${token.uid}`)).toMatchObject({ body: {
    code: 0, data: { items: [{ username, uid: token.uid, avatar: null }] },
  } });
  expect(await request("PUT", "/auth/me/password", { password: "updated-password", code })).toMatchObject({ body: { code: 0 } });
  expect(await request("POST", "/auth/login/pwd", { username, password })).toMatchObject({ status: 200, body: { code: 11006 } });
  expect(await request("POST", "/auth/refresh", { refresh_token: token.refresh_token })).toMatchObject({ body: { code: 0 } });
  expect(await request("POST", "/auth/refresh", { refresh_token: token.refresh_token })).toMatchObject({ status: 200, body: { code: 11004 } });
});
