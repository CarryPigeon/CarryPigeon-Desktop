import { ref, watch, readonly, computed, onUnmounted } from "vue";
import type { CallState, CallSession, AudioDeviceInfo, CallParticipant, CallSummary } from "../domain/contracts";
import { useRingtone } from "./useRingtone";

export interface UseVoiceCallOptions {
  statePort: {
    connectSignaling: (wsUrl: string, accessToken: string, userId: string, displayName: string) => Promise<void>;
    startCall: (kind: "direct" | "conference", roomId: string, targetUserId?: string) => Promise<CallSession>;
    acceptCall: (sessionId: string) => Promise<void>;
    rejectCall: (sessionId: string, reason?: string) => Promise<void>;
    cancelCall: (sessionId: string) => Promise<void>;
    toggleMute: (sessionId: string) => Promise<boolean>;
    toggleNoiseSuppression: (sessionId: string) => Promise<boolean>;
    updateMediaSettings: (sessionId: string, settings: Record<string, unknown>) => Promise<void>;
    getActiveSession: () => CallSession | null;
    getParticipants: (sessionId: string) => readonly CallParticipant[];
    enumerateDevices: () => Promise<{ input: AudioDeviceInfo[]; output: AudioDeviceInfo[] }>;
    joinConference?: (sessionId: string, initiatorId?: string) => Promise<CallSession>;
    leaveConference?: (sessionId: string) => Promise<void>;
  };
  roomId: () => string;
  userId: () => string;
}

export function useVoiceCall(options: UseVoiceCallOptions) {
  const { statePort, roomId, userId } = options;

  const callState = ref<CallState>("idle");
  const activeSession = ref<CallSession | null>(null);
  const participants = ref<readonly CallParticipant[]>([]);
  const inputDevices = ref<readonly AudioDeviceInfo[]>([]);
  const outputDevices = ref<readonly AudioDeviceInfo[]>([]);
  const activeSummary = ref<CallSummary | null>(null);
  const duration = ref(0);
  const isMuted = ref(false);
  const isNoiseSuppressionOn = ref(true);
  const ringtone = useRingtone();
  const ringStartedAt = ref<number>(0);
  const ringTimeoutMs = 60_000;
  const ringRemainingSecs = ref<number>(ringTimeoutMs / 1000);
  let ringCountdownTimer: ReturnType<typeof setInterval> | null = null;

  function startRingCountdown(): void {
    if (ringCountdownTimer) return;
    ringStartedAt.value = Date.now();
    ringRemainingSecs.value = ringTimeoutMs / 1000;
    ringCountdownTimer = setInterval(() => {
      const elapsed = Date.now() - ringStartedAt.value;
      const remaining = Math.max(0, Math.ceil((ringTimeoutMs - elapsed) / 1000));
      ringRemainingSecs.value = remaining;
      if (remaining <= 0 && ringCountdownTimer) {
        clearInterval(ringCountdownTimer);
        ringCountdownTimer = null;
      }
    }, 500);
  }

  function stopRingCountdown(): void {
    if (ringCountdownTimer) {
      clearInterval(ringCountdownTimer);
      ringCountdownTimer = null;
    }
    ringRemainingSecs.value = ringTimeoutMs / 1000;
    ringStartedAt.value = 0;
  }

  let timerHandle: ReturnType<typeof setInterval> | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    timerHandle = setInterval(() => { duration.value += 1000; }, 1000);
  }

  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function startPoll() {
    if (pollHandle) return;
    pollHandle = setInterval(() => {
      const session = statePort.getActiveSession();
      if (session) {
        callState.value = session.state;
        activeSession.value = session;
        participants.value = session.participants;
        // 不从 poll 覆盖 isMuted / isNoiseSuppressionOn：
        // toggleMute/toggleNoiseSuppression 已直接从命令返回值设置它们，
        // 而 poll 的 session 数据来自全局 store（可能因事件延迟而陈旧）。
      }
    }, 500);
  }

  function stopPoll() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  }

  function beginListening() {
    startPoll();
  }

  /** 处理来电：外部事件驱动更新本地状态 */
  function onIncomingCall(session: CallSession) {
    callState.value = "ringing";
    activeSession.value = session;
    participants.value = session.participants;
    startPoll();
    ringtone.play();
    startRingCountdown();
  }

  /** 外部状态变更同步（被动更新本地状态） */
  function syncState(state: CallState, session: CallSession | null) {
    if (state === "ringing" && session) {
      onIncomingCall(session);
    } else if (state === "ended" && session) {
      callState.value = "ended";
      activeSession.value = session;
      stopTimer();
      stopPoll();
      ringtone.stop();
      stopRingCountdown();
      activeSummary.value = {
        sessionId: session.sessionId,
        kind: session.kind,
        duration: duration.value,
        disconnectReason: "remotely_ended",
      };
      setTimeout(() => {
        callState.value = "idle";
        activeSession.value = null;
      }, 500);
    } else if (session) {
      callState.value = state;
      activeSession.value = session;
      participants.value = session.participants;
      isMuted.value = session.participants.find(p => p.userId === userId())?.isMuted ?? false;
      if (state === "active" || state === "idle" || state === "connecting") {
        ringtone.stop();
        stopRingCountdown();
      }
    }
  }

  async function startDirectCall(targetUserId: string, roomIdOverride?: string): Promise<CallSession> {
    callState.value = "dialing";
    const session = await statePort.startCall("direct", roomIdOverride ?? roomId(), targetUserId);
    activeSession.value = session;
    startPoll();
    ringtone.play();
    startRingCountdown();
    return session;
  }

  async function startConference(roomIdOverride?: string): Promise<CallSession> {
    callState.value = "dialing";
    const session = await statePort.startCall("conference", roomIdOverride ?? roomId());
    activeSession.value = session;
    startPoll();
    ringtone.play();
    startRingCountdown();
    return session;
  }

  async function acceptCall(): Promise<void> {
    const session = activeSession.value;
    if (!session) return;
    callState.value = "connecting";
    await statePort.acceptCall(session.sessionId);
    startPoll();
    ringtone.stop();
    stopRingCountdown();
  }

  async function rejectCall(reason?: string): Promise<void> {
    const session = activeSession.value;
    if (!session) return;
    callState.value = "ended";
    await statePort.rejectCall(session.sessionId, reason);
    stopTimer();
    stopPoll();
    ringtone.stop();
    stopRingCountdown();
    activeSummary.value = {
      sessionId: session.sessionId,
      kind: session.kind,
      duration: duration.value,
      disconnectReason: reason ?? "declined",
    };
    setTimeout(() => {
      callState.value = "idle";
      activeSession.value = null;
    }, 500);
  }

  async function hangup(): Promise<void> {
    await rejectCall("manual");
  }

  async function cancelCall(): Promise<void> {
    const session = activeSession.value;
    if (!session) return;
    callState.value = "ended";
    await statePort.cancelCall(session.sessionId);
    stopTimer();
    stopPoll();
    ringtone.stop();
    stopRingCountdown();
    activeSummary.value = {
      sessionId: session.sessionId,
      kind: session.kind,
      duration: duration.value,
      disconnectReason: "cancelled",
    };
    setTimeout(() => {
      callState.value = "idle";
      activeSession.value = null;
    }, 500);
  }

  async function toggleMute(): Promise<boolean> {
    const session = activeSession.value;
    if (!session) return false;
    const muted = await statePort.toggleMute(session.sessionId);
    isMuted.value = muted;
    // 同步更新本地会话中的参与者静音状态，避免 poll 的陈数据覆盖不一致
    if (activeSession.value) {
      activeSession.value = {
        ...activeSession.value,
        participants: activeSession.value.participants.map(p =>
          p.userId === userId() ? { ...p, isMuted: muted } : p
        ),
      };
    }
    return muted;
  }

  async function toggleNoiseSuppression(): Promise<boolean> {
    const session = activeSession.value;
    if (!session) return false;
    const ns = await statePort.toggleNoiseSuppression(session.sessionId);
    isNoiseSuppressionOn.value = ns;
    // 同步更新本地会话中的媒体设置，保持一致性
    if (activeSession.value) {
      activeSession.value = {
        ...activeSession.value,
        mediaSettings: { ...activeSession.value.mediaSettings, noiseSuppression: ns },
      };
    }
    return ns;
  }

  async function selectInputDevice(deviceId: string): Promise<void> {
    const sessionId = activeSession.value?.sessionId;
    if (!sessionId) return;
    await statePort.updateMediaSettings(sessionId, { inputDeviceId: deviceId });
    // 同步更新本地状态
    if (activeSession.value) {
      activeSession.value = {
        ...activeSession.value,
        mediaSettings: { ...activeSession.value.mediaSettings, inputDeviceId: deviceId },
      };
    }
  }

  async function selectOutputDevice(deviceId: string): Promise<void> {
    const sessionId = activeSession.value?.sessionId;
    if (!sessionId) return;
    await statePort.updateMediaSettings(sessionId, { outputDeviceId: deviceId });
    if (activeSession.value) {
      activeSession.value = {
        ...activeSession.value,
        mediaSettings: { ...activeSession.value.mediaSettings, outputDeviceId: deviceId },
      };
    }
  }

  async function connectSignaling(wsUrl: string, accessToken: string, userId: string, displayName: string): Promise<void> {
    await statePort.connectSignaling(wsUrl, accessToken, userId, displayName);
  }

  async function initDevices(): Promise<void> {
    try {
      const devices = await statePort.enumerateDevices();
      inputDevices.value = devices.input;
      outputDevices.value = devices.output;

      // 自动选中系统默认设备
      const defaultInput = devices.input.find((d) => d.isDefault);
      if (defaultInput) {
        await statePort.updateMediaSettings("", { inputDeviceId: defaultInput.deviceId });
      }
      const defaultOutput = devices.output.find((d) => d.isDefault);
      if (defaultOutput) {
        await statePort.updateMediaSettings("", { outputDeviceId: defaultOutput.deviceId });
      }
    } catch (_e) {
      // 设备枚举失败时保持空列表，不影响通话（pipeline 层自动使用系统默认设备）
    }
  }

  /**
   * 重新枚举音频设备并检测变化。
   * 当设备列表发生变化时（如热插拔 USB 设备），自动更新状态。
   * @returns 设备列表是否发生了变化。
   */
  async function refreshDevices(): Promise<boolean> {
    try {
      const devices = await statePort.enumerateDevices();
      const prevInputIds = inputDevices.value.map((d) => d.deviceId).sort().join(",");
      const prevOutputIds = outputDevices.value.map((d) => d.deviceId).sort().join(",");
      const newInputIds = devices.input.map((d) => d.deviceId).sort().join(",");
      const newOutputIds = devices.output.map((d) => d.deviceId).sort().join(",");

      const changed = prevInputIds !== newInputIds || prevOutputIds !== newOutputIds;
      if (changed) {
        inputDevices.value = devices.input;
        outputDevices.value = devices.output;
      }
      return changed;
    } catch {
      return false;
    }
  }

  async function joinConference(sessionId: string, initiatorId?: string): Promise<CallSession | undefined> {
    if (!statePort.joinConference) return;
    const session = await statePort.joinConference(sessionId, initiatorId);
    callState.value = session.state;
    activeSession.value = session;
    startPoll();
    ringtone.stop();
    stopRingCountdown();
    return session;
  }

  async function leaveConference(): Promise<void> {
    const session = activeSession.value;
    if (!session || !statePort.leaveConference) return;
    callState.value = "ended";
    await statePort.leaveConference(session.sessionId);
    stopTimer();
    stopPoll();
    ringtone.stop();
    stopRingCountdown();
    activeSummary.value = {
      sessionId: session.sessionId,
      kind: session.kind,
      duration: duration.value,
      disconnectReason: "left",
    };
    setTimeout(() => {
      callState.value = "idle";
      activeSession.value = null;
    }, 500);
  }

  const isConferenceHost = computed(() =>
    activeSession.value?.kind === "conference" && activeSession.value?.initiator !== ""
  );

  watch(callState, (newVal) => {
    if (newVal === "active") {
      duration.value = 0;
      startTimer();
    }
    if (newVal === "ended") {
      stopTimer();
    }
  });

  onUnmounted(() => {
    stopTimer();
    stopPoll();
    stopRingCountdown();
    ringtone.stop();
  });

  return {
    callState: readonly(callState),
    activeSession: readonly(activeSession),
    participants: readonly(participants),
    duration: readonly(duration),
    isMuted: readonly(isMuted),
    isNoiseSuppressionOn: readonly(isNoiseSuppressionOn),
    inputDevices: readonly(inputDevices),
    outputDevices: readonly(outputDevices),
    activeSummary: readonly(activeSummary),
    ringRemainingSecs: readonly(ringRemainingSecs),
    ringTimeoutMs,

    connectSignaling,
    startDirectCall,
    startConference,
    acceptCall,
    rejectCall,
    hangup,
    cancelCall,
    toggleMute,
    toggleNoiseSuppression,
    selectInputDevice,
    selectOutputDevice,
    initDevices,
    refreshDevices,
    joinConference,
    leaveConference,
    beginListening,
    isConferenceHost,
    onIncomingCall,
    syncState,
    setRingtoneAudio: ringtone.setAudioElement,
  };
}
