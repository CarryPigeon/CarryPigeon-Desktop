/**
 * @fileoverview voice-call 领域契约。
 * @description
 * 由 voice-call 子域持有的通话生命周期类型。
 */

import type { SemanticErrorInfo } from "@/shared/types/semantics";

// ── 通话类型
export type CallKind = "direct" | "conference";

// ── 通话状态
export type CallState = "idle" | "dialing" | "ringing" | "connecting" | "active" | "ended";

// ── 参与者信息
export type CallParticipant = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  isMuted: boolean;
  isSpeaking: boolean;
  audioLevel: number; // 0-1, VAD 提供
  joinedAt: number | null; // ms timestamp
};

// ── 媒体设置
export type MediaSettings = {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  noiseSuppression: boolean;
  echoCancellation: boolean;
};

// ── 通话会话（领域聚合根）
export type CallSession = {
  sessionId: string;
  kind: CallKind;
  state: CallState;
  initiator: string; // userId
  participants: readonly CallParticipant[];
  roomId: string;
  startedAt: number | null;
  endedAt: number | null;
  mediaSettings: MediaSettings;
};

// ── 通话摘要
export type CallSummary = {
  sessionId: string;
  kind: CallKind;
  duration: number; // ms
  disconnectReason: string;
};

// ── 音频设备信息
export type AudioDeviceInfo = {
  deviceId: string;
  name: string;
  isDefault: boolean;
};

// ── 错误码
export type VoiceCallErrorCode =
  | "call_not_found"
  | "call_state_invalid"
  | "audio_device_unavailable"
  | "audio_stream_failed"
  | "webrtc_connection_failed"
  | "signaling_connection_failed"
  | "sfu_connection_failed"
  | "call_timeout"
  | "microphone_permission_denied";

export type VoiceCallErrorInfo = SemanticErrorInfo<VoiceCallErrorCode>;
