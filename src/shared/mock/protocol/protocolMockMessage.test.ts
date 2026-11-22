import { expect, it, vi } from "vitest";
import { connectProtocolMockChatWs, handleProtocolMockApiRequest } from "./protocolMockTransport";

it("以新版响应和事件完成发送、翻页、转发和撤回", async () => {
  const serverSocket = "mock://message-lifecycle";
  let headers: Record<string, string> = {};
  const request = (method: string, path: string, body?: unknown) => handleProtocolMockApiRequest({ serverSocket, method, path, headers, body });
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const result = await request(method, path, body);
    expect(result).toMatchObject({ ok: true, status: 200, body: { code: 0, message: "OK", data: expect.anything() } });
    return (result as { body: { data: T } }).body.data;
  };
  const token = await call<{ access_token: string }>("POST", "/auth/login/pwd", { username: "Operator", password: "password" });
  headers = { Authorization: `Bearer ${token.access_token}` };
  const events = vi.fn();
  const ws = connectProtocolMockChatWs(serverSocket, token.access_token, events);
  const channel = "/channels/cid-prod/messages";
  try {
    const first = await call<{ mid: string }>("POST", channel, { domain: "Core:Text:V1", data: { content: "hello" }, mentions: [] });
    const forwardData = { source_channel_id: "cid-prod", message_ids: [first.mid] };
    const second = await call<{ mid: string }>("POST", channel, { domain: "Core:Forward:V1", data: forwardData, mentions: [] });
    expect(BigInt(second.mid)).toBeGreaterThan(BigInt(first.mid));
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ id: null, error: null, data: expect.objectContaining({
      event_type: "message.created", payload: { channel_id: "cid-prod", message_id: second.mid, event_sequence: expect.any(Number) },
    }) }));
    const latest = await call<{ items: { mid: string }[]; next_cursor: string }>("GET", `${channel}?limit=1`);
    expect(latest.items[0].mid).toBe(second.mid);
    const before = await call<{ items: { mid: string }[] }>("GET", `${channel}/before?cursor=${encodeURIComponent(latest.next_cursor)}&limit=1`);
    expect(before.items[0].mid).toBe(first.mid);
    const third = await call<{ mid: string }>("POST", channel, { domain: "Core:Text:V1", data: { content: "later" } });
    const around = `${channel}/around?anchor_mid=`;
    const mids = (data: { items: { mid: string }[] }) => data.items.map((item) => item.mid);
    expect(mids(await call("GET", `${around}${second.mid}&before=1&after=1`))).toEqual([third.mid, second.mid, first.mid]);
    expect(mids(await call("GET", `${around}${first.mid}&before=0&after=20`))).toEqual([third.mid, second.mid, first.mid]);
    expect(mids(await call("GET", `${around}${second.mid}&before=0&after=0`))).toEqual([second.mid]);
    expect(await request("GET", `${around}${second.mid}&before=51&after=0`)).toMatchObject({ body: { code: 10001 } });
    expect(await request("GET", `${around}1&before=0&after=0`)).toMatchObject({ body: { code: 30001 } });
    expect(await request("GET", `/channels/cid-ann/messages/around?anchor_mid=${second.mid}&before=0&after=0`))
      .toMatchObject({ body: { code: 30001 } });
    expect(await call("POST", "/channels/messages/ids", { message_ids: [second.mid, first.mid] })).toMatchObject({ items: [{ data: forwardData }, { preview: "hello" }] });
    expect(await request("POST", `${channel}/${first.mid}/recall`)).toMatchObject({ ok: true, body: { code: 0, data: null } });
    expect(await call("GET", `/channels/messages/${first.mid}`)).toMatchObject({ status: "recalled", data: null });
    expect(await request("POST", `/messages/${first.mid}/forward`)).toMatchObject({ ok: false, error: { error: { status: 404 } } });
    expect(await request("POST", `${channel}/attachments`)).toMatchObject({ ok: false, error: { error: { status: 404 } } });
  } finally {
    ws.close();
  }
});
