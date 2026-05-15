import { ref, watch, readonly } from "vue";
import type { CallState, CallSession, AudioDeviceInfo, CallParticipant, CallSummary } from "../../domain/contracts";

export interface UseVoiceCallOptions {
  statePort: {
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
  };
  roomId: () => string;
}

export function useVoiceCall(options: UseVoiceCallOptions) {
  const { statePort, roomId } = options;

  const callState = ref<CallState>("idle");
  const activeSession = ref<CallSession | null>(null);
  const participants = ref<readonly CallParticipant[]>([]);
  const inputDevices = ref<readonly AudioDeviceInfo[]>([]);
  const outputDevices = ref<readonly AudioDeviceInfo[]>([]);
  const activeSummary = ref<CallSummary | null>(null);
  const duration = ref(0);
  const isMuted = ref(false);
  const isNoiseSuppressionOn = ref(true);

  let timerHandle: ReturnType<typeof setInterval> | null = null;
  let pollHandle: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    timerHandle = setInterval(() => { duration.value += 1000; }, 1000);
  }

  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function startPoll() {
    pollHandle = setInterval(() => {
      const session = statePort.getActiveSession();
      if (session) {
        callState.value = session.state;
        activeSession.value = session;
        participants.value = session.participants;
        isMuted.value = session.participants.find(p => p.userId === "current-user")?.isMuted ?? false;
        isNoiseSuppressionOn.value = session.mediaSettings.noiseSuppression;
      }
    }, 500);
  }

  function stopPoll() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  }

  async function startDirectCall(targetUserId: string): Promise<CallSession> {
    const session = await statePort.startCall("direct", roomId(), targetUserId);
    callState.value = "dialing";
    activeSession.value = session;
    startPoll();
    return session;
  }

  async function startConference(): Promise<CallSession> {
    const session = await statePort.startCall("conference", roomId());
    callState.value = "dialing";
    activeSession.value = session;
    startPoll();
    return session;
  }

  async function acceptCall(): Promise<void> {
    const session = activeSession.value;
    if (!session) return;
    callState.value = "connecting";
    await statePort.acceptCall(session.sessionId);
  }

  async function rejectCall(reason?: string): Promise<void> {
    const session = activeSession.value;
    if (!session) return;
    callState.value = "ended";
    await statePort.rejectCall(session.sessionId, reason);
    stopPoll();
    stopTimer();
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

  async function toggleMute(): Promise<boolean> {
    const session = activeSession.value;
    if (!session) return false;
    const muted = await statePort.toggleMute(session.sessionId);
    isMuted.value = muted;
    return muted;
  }

  async function toggleNoiseSuppression(): Promise<boolean> {
    const session = activeSession.value;
    if (!session) return false;
    const ns = await statePort.toggleNoiseSuppression(session.sessionId);
    isNoiseSuppressionOn.value = ns;
    return ns;
  }

  async function selectInputDevice(deviceId: string): Promise<void> {
    const session = activeSession.value;
    if (!session) return;
    await statePort.updateMediaSettings(session.sessionId, { inputDeviceId: deviceId });
  }

  async function selectOutputDevice(deviceId: string): Promise<void> {
    const session = activeSession.value;
    if (!session) return;
    await statePort.updateMediaSettings(session.sessionId, { outputDeviceId: deviceId });
  }

  async function initDevices(): Promise<void> {
    const devices = await statePort.enumerateDevices();
    inputDevices.value = devices.input;
    outputDevices.value = devices.output;
  }

  watch(callState, (newVal) => {
    if (newVal === "active") {
      duration.value = 0;
      startTimer();
    }
    if (newVal === "ended") {
      stopTimer();
    }
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

    startDirectCall,
    startConference,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    toggleNoiseSuppression,
    selectInputDevice,
    selectOutputDevice,
    initDevices,
  };
}
