import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceCall, type UseVoiceCallOptions } from "./useVoiceCall";
import type { CallSession } from "../domain/contracts";

const session: CallSession = {
  sessionId: "call-1", kind: "direct", state: "dialing", initiator: "me", participants: [], roomId: "room",
  startedAt: null, endedAt: null,
  mediaSettings: { inputDeviceId: null, outputDeviceId: null, noiseSuppression: false, echoCancellation: false },
};

function setupCall() {
  const port = {
    connectSignaling: vi.fn(), startCall: vi.fn<UseVoiceCallOptions["statePort"]["startCall"]>(), acceptCall: vi.fn(),
    rejectCall: vi.fn(), cancelCall: vi.fn(), toggleMute: vi.fn(), toggleNoiseSuppression: vi.fn(),
    updateMediaSettings: vi.fn(), getActiveSession: vi.fn(() => null), getParticipants: vi.fn(), enumerateDevices: vi.fn(),
  };
  let call!: ReturnType<typeof useVoiceCall>;
  const component = mount({ setup() { call = useVoiceCall({ statePort: port, roomId: () => "room", userId: () => "me" }); return () => null; } });
  return { call, port, component };
}

let component: ReturnType<typeof setupCall>["component"];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { component.unmount(); vi.useRealTimers(); });

describe("通话状态恢复", () => {
  it("跨入口快速重复拨号只发一次；失败后可手动重试", async () => {
    const { call, port, component: wrapper } = setupCall();
    component = wrapper;
    let fail!: (error: Error) => void;
    port.startCall.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    const first = call.startDirectCall("peer");
    expect(call.callState.value).toBe("dialing");
    await expect(call.startConference()).resolves.toBeUndefined();
    expect(port.startCall).toHaveBeenCalledTimes(1);
    const assertion = expect(first).rejects.toThrow("offline");
    fail(new Error("offline"));
    await assertion;
    expect(call.callState.value).toBe("idle");
    port.startCall.mockResolvedValueOnce({ ...session, state: "active", kind: "conference" });
    await call.startConference();
    expect(call.callState.value).toBe("active");
    await call.startDirectCall("peer");
    expect(port.startCall).toHaveBeenCalledTimes(2);
  });

  it("接听失败恢复响铃，挂断失败保留当前通话", async () => {
    const { call, port, component: wrapper } = setupCall();
    component = wrapper;
    call.onIncomingCall({ ...session, state: "ringing" });
    port.acceptCall.mockRejectedValueOnce(new Error("device"));
    await expect(call.acceptCall()).rejects.toThrow("device");
    expect(call.callState.value).toBe("ringing");
    port.rejectCall.mockRejectedValueOnce(new Error("offline"));
    await expect(call.rejectCall()).rejects.toThrow("offline");
    expect(call.callState.value).toBe("ringing");
    await call.rejectCall();
    vi.advanceTimersByTime(500);
    expect(call.callState.value).toBe("idle");
  });

  it("前一通的延时清理不清除后来来电", () => {
    const { call, component: wrapper } = setupCall();
    component = wrapper;
    call.syncState("ended", { ...session, state: "ended" });
    call.onIncomingCall({ ...session, sessionId: "call-2", state: "ringing" });
    vi.advanceTimersByTime(500);
    expect(call.activeSession.value?.sessionId).toBe("call-2");
    expect(call.callState.value).toBe("ringing");
  });
});
