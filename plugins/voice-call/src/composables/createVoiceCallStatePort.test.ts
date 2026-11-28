import { describe, expect, it, vi } from "vitest";
import { invokeVoiceCall } from "../host/bridge";
import { createVoiceCallStatePort } from "./createVoiceCallStatePort";

vi.mock("../host/bridge", () => ({ invokeVoiceCall: vi.fn() }));

describe("通话 IPC 适配", () => {
  it("直拨缺少对象时不调用会议 IPC", async () => {
    await expect(createVoiceCallStatePort().startCall("direct", "room")).rejects.toThrow();
    expect(invokeVoiceCall).not.toHaveBeenCalled();
  });

  it("转换原生会话字段，不更改命令或参数", async () => {
    vi.mocked(invokeVoiceCall).mockResolvedValueOnce({
      session_id: "call-1", call_kind: "direct", state: "dialing", initiator: "self", room_id: "room",
      started_at: null, ended_at: null,
      participants: [{ user_id: "peer", display_name: "Peer", is_muted: false, is_speaking: false, audio_level: 0, joined_at: null }],
      media_settings: { input_device_id: null, output_device_id: null, noise_suppression: true, echo_cancellation: false },
    });
    const session = await createVoiceCallStatePort().startCall("direct", "room", "peer");
    expect(invokeVoiceCall).toHaveBeenCalledWith("voice_call:start_direct_call", { roomId: "room", targetUserId: "peer", sessionId: expect.any(String) });
    expect(session).toMatchObject({ sessionId: "call-1", kind: "direct", roomId: "room", participants: [{ userId: "peer" }], mediaSettings: { noiseSuppression: true } });
  });
});
