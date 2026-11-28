import type { PluginChatContext } from "@/features/plugins/api-types";

export type CallEntryKind = "video" | "audio" | "conference";

export function getCallEntry(kind: CallEntryKind, context?: PluginChatContext) {
  const roomId = context?.channelId;
  if (!roomId?.trim()) return { error: "voice_call_no_channel" } as const;
  // 缺少对象只意味着无法安全直拨，不代表当前会话一定是群聊。
  const target = context?.targetUserId;
  const targetUserId = target?.trim() ? target : undefined;
  if (kind === "conference" && targetUserId) return { error: "voice_call_use_direct" } as const;
  if (kind !== "conference" && !targetUserId) return { error: "voice_call_no_target" } as const;
  return { roomId, targetUserId } as const;
}

export function callFailureKey(error: unknown, medium: "audio" | "camera" | "screen" = "audio"): string {
  const name = error && typeof error === "object" && "name" in error ? error.name : undefined;
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
  if (name === "NotAllowedError" || name === "SecurityError" || /microphone_permission_denied|permission denied/i.test(message)) {
    return `voice_call_${medium}_permission`;
  }
  if (medium === "camera" && ["NotFoundError", "NotReadableError", "OverconstrainedError", "AbortError"].includes(String(name))) {
    return "voice_call_camera_device";
  }
  if (/VOICE_CALL_AUDIO_PLAYBACK_FAILED/i.test(message)) return "voice_call_output_device_error";
  if (/VOICE_CALL_AUDIO_CAPTURE_FAILED|VOICE_CALL_AUDIO_DEVICE_FAILED|audio_device_unavailable/i.test(message)) return "voice_call_audio_device_error";
  if (medium === "camera" && /signaling|VOICE_CALL_PEER_CONNECTION_FAILED|VOICE_CALL_ICE_FAILED/i.test(message)) return "voice_call_video_failed";
  if (/signaling|VOICE_CALL_PEER_CONNECTION_FAILED|VOICE_CALL_ICE_FAILED|WebRTC not initialized|sfu_connection_failed/i.test(message)) return "voice_call_connection_error";
  return medium === "camera" ? "voice_call_video_failed" : medium === "screen" ? "voice_call_screen_failed" : "voice_call_operation_failed";
}
