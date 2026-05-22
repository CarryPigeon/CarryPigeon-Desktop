import { ref } from "vue";
import type { CallSession, CallKind, CallParticipant, AudioDeviceInfo, MediaSettings } from "../domain/contracts";
import type { VoiceCallStatePort } from "../domain/ports";

export function createMockVoiceCallStatePort(): VoiceCallStatePort {
  const activeSession = ref<CallSession | null>(null);

  const mockDevices: AudioDeviceInfo[] = [
    { deviceId: "default-mic", name: "Default Microphone", isDefault: true },
    { deviceId: "virtual-mic", name: "Virtual Microphone", isDefault: false },
  ];

  const mockParticipants: CallParticipant[] = [
    { userId: "user-1", displayName: "张三", isMuted: false, isSpeaking: true, audioLevel: 0.8, joinedAt: Date.now() },
    { userId: "user-2", displayName: "李四", isMuted: true, isSpeaking: false, audioLevel: 0.0, joinedAt: Date.now() },
  ];

  return {
    async connectSignaling(_wsUrl: string, _accessToken: string, _userId: string, _displayName: string) {
      // no-op in mock
    },

    async startCall(kind: CallKind, roomId: string, _targetUserId?: string) {
      const session: CallSession = {
        sessionId: `mock-call-${Date.now()}`,
        kind,
        state: "dialing",
        initiator: "current-user",
        participants: [{ userId: "current-user", displayName: "我", isMuted: false, isSpeaking: false, audioLevel: 0, joinedAt: Date.now() }],
        roomId,
        startedAt: null,
        endedAt: null,
        mediaSettings: { inputDeviceId: "default-mic", outputDeviceId: null, noiseSuppression: true, echoCancellation: true },
      };
      activeSession.value = session;
      return session;
    },

    async acceptCall(sessionId: string) {
      if (!activeSession.value || activeSession.value.sessionId !== sessionId) throw new Error("call_not_found");
      activeSession.value = { ...activeSession.value, state: "connecting", participants: mockParticipants };
      setTimeout(() => {
        if (activeSession.value) {
          activeSession.value = { ...activeSession.value, state: "active", startedAt: Date.now() };
        }
      }, 1000);
    },

    async rejectCall(sessionId: string, _reason?: string) {
      if (!activeSession.value || activeSession.value.sessionId !== sessionId) return;
      activeSession.value = { ...activeSession.value, state: "ended", endedAt: Date.now() };
      setTimeout(() => { activeSession.value = null; }, 500);
    },

    async cancelCall(_sessionId: string) {
      activeSession.value = null;
    },

    async toggleMute(_sessionId: string) {
      if (!activeSession.value) throw new Error("call_not_found");
      const muted = !activeSession.value.participants[0]?.isMuted;
      return muted;
    },

    async toggleNoiseSuppression(_sessionId: string) {
      if (!activeSession.value) throw new Error("call_not_found");
      const ns = !activeSession.value.mediaSettings.noiseSuppression;
      activeSession.value = { ...activeSession.value, mediaSettings: { ...activeSession.value.mediaSettings, noiseSuppression: ns } };
      return ns;
    },

    async updateMediaSettings(sessionId: string, settings: Partial<MediaSettings>) {
      if (!activeSession.value || activeSession.value.sessionId !== sessionId) throw new Error("call_not_found");
      activeSession.value = { ...activeSession.value, mediaSettings: { ...activeSession.value.mediaSettings, ...settings } };
    },

    getActiveSession() { return activeSession.value; },
    getParticipants(_sessionId: string) { return mockParticipants; },

    async enumerateDevices() {
      return { input: mockDevices, output: mockDevices };
    },

    async joinConference(sessionId: string, initiatorId?: string) {
      const session: CallSession = {
        sessionId,
        kind: "conference",
        state: "connecting",
        initiator: initiatorId || "host-user",
        participants: [
          { userId: "host-user", displayName: "主持人", isMuted: false, isSpeaking: true, audioLevel: 0.7, joinedAt: Date.now() },
          { userId: "current-user", displayName: "我", isMuted: false, isSpeaking: false, audioLevel: 0, joinedAt: Date.now() },
        ],
        roomId: "conference-room",
        startedAt: Date.now(),
        endedAt: null,
        mediaSettings: { inputDeviceId: "default-mic", outputDeviceId: null, noiseSuppression: true, echoCancellation: true },
      };
      activeSession.value = session;
      setTimeout(() => {
        if (activeSession.value) {
          activeSession.value = {
            ...activeSession.value,
            state: "active",
            participants: [
              ...activeSession.value.participants,
              { userId: "user-3", displayName: "王五", isMuted: false, isSpeaking: false, audioLevel: 0.0, joinedAt: Date.now() },
            ],
          };
        }
      }, 2000);
      return session;
    },

    async leaveConference(_sessionId: string) {
      activeSession.value = null;
    },
  };
}
