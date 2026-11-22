import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAuthServicePort } from "./httpAuthServicePort";
import { createHttpEmailServicePort } from "./httpEmailServicePort";
import { httpGetCurrentUser, httpGetUser, httpListUsers, httpUpdateUserEmail, httpUpdateUserProfile } from "../../profile/data/httpUserApi";
import { mapUserMeWire } from "../../profile/data/userWireMappers";

vi.mock("@/shared/net/auth/api", () => ({ ensureValidAccessToken: async () => "access-token" }));
vi.mock("./requiredGatePort", () => ({ requiredGatePort: { check: async () => [] } }));

const server = "https://account.test";
const credential = { email: "alice@example.com", code: "000123" };
const tokens = { token_type: "Bearer", access_token: "access-token", refresh_token: "refresh-token", uid: "1001", expires_in: 1800 };

function spyFetch(data: unknown, code = 0) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(code === 0
    ? { code, message: "OK", data }
    : { code, message: "Request rejected" }), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("account HTTP contract", () => {
  it("sends the exact registration and verification fields", async () => {
    const fetch = spyFetch({ uid: "1001", username: "alice" });
    await createHttpEmailServicePort(server).sendCode(credential.email, "REGISTER");
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/email_codes`, expect.objectContaining({
      method: "POST", body: JSON.stringify({ email: credential.email, purpose: "REGISTER" }),
    }));
    await expect(createHttpAuthServicePort(server).registerWithPassword("alice", "pass word", credential.email, credential.code))
      .resolves.toEqual({ uid: "1001", username: "alice" });
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/register`, expect.objectContaining({
      body: JSON.stringify({ username: "alice", password: "pass word", ...credential }),
    }));
  });

  it("uses distinct login endpoints and rotates refresh tokens", async () => {
    const fetch = spyFetch(tokens);
    const auth = createHttpAuthServicePort(server);
    await expect(auth.loginWithPassword("alice", "pass word")).resolves.toMatchObject({ uid: "1001", isNewUser: false });
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/login/pwd`, expect.objectContaining({ body: JSON.stringify({ username: "alice", password: "pass word" }) }));
    await auth.loginWithEmailCode(credential.email, credential.code);
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/login/email`, expect.objectContaining({ body: JSON.stringify(credential) }));
    await expect(auth.refreshAccessToken("old-token")).resolves.toMatchObject({ refreshToken: "refresh-token" });
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/refresh`, expect.objectContaining({ body: JSON.stringify({ refresh_token: "old-token" }) }));
    await auth.revokeRefreshToken("refresh-token");
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/revoke`, expect.objectContaining({ body: JSON.stringify({ refresh_token: "refresh-token" }) }));
  });

  it("changes credentials with Bearer and propagates business errors", async () => {
    const fetch = spyFetch(null);
    await createHttpEmailServicePort(server).sendCode(credential.email, "password_change");
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/email_codes`, expect.objectContaining({ body: JSON.stringify({ email: credential.email, purpose: "password_change" }) }));
    await createHttpAuthServicePort(server).changePassword("pass word", credential.code);
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/me/password`, expect.objectContaining({
      method: "PUT", headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      body: JSON.stringify({ password: "pass word", code: credential.code }),
    }));
    spyFetch(undefined, 11011);
    await expect(httpUpdateUserEmail(server, "access-token", credential.email, credential.code))
      .rejects.toMatchObject({ cause: { code: 11011 } });
  });

  it("maps profile reads and omits unchanged profile fields", async () => {
    const profile = { uid: "1001", username: "alice", avatar: "avatars/u/1001.png", bio: "Hello", sex: 2, birthday: 12345 };
    spyFetch(profile);
    expect(mapUserMeWire(await httpGetCurrentUser(server, "access-token"))).toMatchObject({
      nickname: "alice", avatar: `${server}/avatars/u/1001.png`, brief: "Hello", sex: 2, birthday: 12345,
    });
    const detail = spyFetch(profile);
    await httpGetUser(server, "access-token", "1001");
    expect(detail).toHaveBeenLastCalledWith(`${server}/api/users/1001/detail`, expect.objectContaining({ method: "GET" }));
    spyFetch({ items: [{ uid: "1001", username: "alice", avatar: null }] });
    await expect(httpListUsers(server, "access-token", ["1001", "1001"])).resolves.toEqual([{ uid: "1001", username: "alice", avatar: null }]);
    const patch = spyFetch(null);
    await httpUpdateUserProfile(server, "access-token", { brief: "Updated" });
    expect(patch).toHaveBeenLastCalledWith(`${server}/api/users/me`, expect.objectContaining({ method: "PATCH", body: JSON.stringify({ brief: "Updated" }) }));
  });
});
