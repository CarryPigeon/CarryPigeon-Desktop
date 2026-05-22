/**
 * @fileoverview voice-call 应用层输出端口。
 * @description
 * chat/voice-call｜application：面向通话编排的最小依赖契约。
 */

import type { CallSession, CallKind, MediaSettings, AudioDeviceInfo, CallParticipant } from "./contracts";

export type VoiceCallStatePort = {
  /** 建立信令 WebSocket 连接 */
  connectSignaling(wsUrl: string, accessToken: string, userId: string, displayName: string): Promise<void>;
  /** 发起通话 */
  startCall(kind: CallKind, roomId: string, targetUserId?: string): Promise<CallSession>;
  /** 接受来电 */
  acceptCall(sessionId: string): Promise<void>;
  /** 拒接 / 挂断 */
  rejectCall(sessionId: string, reason?: string): Promise<void>;
  /** 取消拨出 */
  cancelCall(sessionId: string): Promise<void>;
  /** 切换静音 */
  toggleMute(sessionId: string): Promise<boolean>;
  /** 切换降噪 */
  toggleNoiseSuppression(sessionId: string): Promise<boolean>;
  /** 更新媒体设置 */
  updateMediaSettings(sessionId: string, settings: Partial<MediaSettings>): Promise<void>;
  /** 获取当前活跃的会话 */
  getActiveSession(): CallSession | null;
  /** 获取通话参与者列表 */
  getParticipants(sessionId: string): readonly CallParticipant[];
  /** 枚举音频设备 */
  enumerateDevices(): Promise<{ input: AudioDeviceInfo[]; output: AudioDeviceInfo[] }>;
  /** 加入会议 */
  joinConference(sessionId: string, initiatorId?: string): Promise<CallSession>;
  /** 离开会议 */
  leaveConference(sessionId: string): Promise<void>;
};
