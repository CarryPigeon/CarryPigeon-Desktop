import { describe, expect, it } from "vitest";
import { callFailureKey, getCallEntry } from "./callFeedback";

describe("通话入口", () => {
  it("空会话不能拨号或发起会议", () => {
    expect(getCallEntry("conference", { channelId: " " })).toEqual({ error: "voice_call_no_channel" });
  });

  it("缺少对象不推断群聊，也不会将直拨静默转换为会议", () => {
    const context = { channelId: "room" };
    expect(getCallEntry("audio", context)).toEqual({ error: "voice_call_no_target" });
    expect(getCallEntry("video", context)).toEqual({ error: "voice_call_no_target" });
    expect(getCallEntry("conference", context)).toEqual({ roomId: "room", targetUserId: undefined });
  });

  it("有明确对象时使用直拨", () => {
    const context = { channelId: "room", targetUserId: "peer" };
    expect(getCallEntry("video", context)).toEqual({ roomId: "room", targetUserId: "peer" });
    expect(getCallEntry("conference", context)).toEqual({ error: "voice_call_use_direct" });
  });
});

describe("通话错误反馈", () => {
  it("区分权限、设备和连接错误", () => {
    expect(callFailureKey(new DOMException("", "NotAllowedError"), "camera")).toBe("voice_call_camera_permission");
    expect(callFailureKey(new DOMException("", "NotFoundError"), "camera")).toBe("voice_call_camera_device");
    expect(callFailureKey("[VOICE_CALL_AUDIO_CAPTURE_FAILED] device missing")).toBe("voice_call_audio_device_error");
    expect(callFailureKey("[VOICE_CALL_AUDIO_PLAYBACK_FAILED] device missing")).toBe("voice_call_output_device_error");
    expect(callFailureKey(new Error("[VOICE_CALL_FAILED] Signaling not connected"))).toBe("voice_call_connection_error");
    expect(callFailureKey(new Error("unknown"))).toBe("voice_call_operation_failed");
  });
});
