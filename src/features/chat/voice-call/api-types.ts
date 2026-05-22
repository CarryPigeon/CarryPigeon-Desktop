/**
 * @fileoverview chat/voice-call 公共类型入口。
 * @description
 * 统一承载 voice-call 子域的稳定公共契约，避免页面层和聚合层深依赖领域路径。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type { CallState, CallSession, CallSummary, AudioDeviceInfo, CallParticipant } from "./domain/contracts";

export type { CallKind, CallState, CallParticipant, MediaSettings, CallSession, CallSummary, AudioDeviceInfo, VoiceCallErrorCode, VoiceCallErrorInfo } from "./domain/contracts";

// ── 快照类型
export type VoiceCallSnapshot = {
  currentState: CallState;
  activeSession: CallSession | null;
  participants: readonly CallParticipant[];
  devices: { input: readonly AudioDeviceInfo[]; output: readonly AudioDeviceInfo[] };
  activeSummary: CallSummary | null;
};

// ── 能力接口
export type VoiceCallCapabilities = ReadableCapability<VoiceCallSnapshot> & {
  /** 发起 1v1 通话 */
  startDirectCall(targetUserId: string): Promise<CallSession>;
  /** 发起多人会议 */
  startConference(): Promise<CallSession>;
  /** 接听来电 */
  acceptCall(): Promise<void>;
  /** 拒接来电 */
  rejectCall(reason?: string): Promise<void>;
  /** 挂断通话 */
  hangup(): Promise<void>;
  /** 切换静音 */
  toggleMute(): Promise<boolean>;
  /** 切换降噪 */
  toggleNoiseSuppression(): Promise<boolean>;
  /** 选择输入设备 */
  selectInputDevice(deviceId: string): Promise<void>;
  /** 选择输出设备 */
  selectOutputDevice(deviceId: string): Promise<void>;
  /** 监听来电事件（Rust emit → frontend） */
  listenForIncomingCalls(): Promise<() => void>;
  /** 连接信令服务器（在登录后调用，用于接收来电和发起通话） */
  connectSignaling(wsUrl: string, accessToken: string): Promise<void>;
  /** 加入已有会议 */
  joinConference(sessionId: string): Promise<CallSession>;
  /** 离开会议 */
  leaveConference(sessionId: string): Promise<void>;
};
