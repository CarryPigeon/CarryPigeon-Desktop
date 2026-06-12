import type { CallSession, CallKind, CallParticipant, AudioDeviceInfo, MediaSettings } from "../domain/contracts";
import type { VoiceCallStatePort } from "../domain/ports";

export function createMockVoiceCallStatePort(): VoiceCallStatePort {
  let _activeSession: CallSession | null = null;

  const mockDevices: AudioDeviceInfo[] = [
    { deviceId: "default-mic", name: "Default Microphone", isDefault: true },
    { deviceId: "virtual-mic", name: "Virtual Microphone", isDefault: false },
  ];

  const mockParticipants: CallParticipant[] = [
    { userId: "u-1", displayName: "Operator", isMuted: false, isSpeaking: true, audioLevel: 0.8, joinedAt: Date.now() },
    { userId: "u-2", displayName: "Relay", isMuted: true, isSpeaking: false, audioLevel: 0.0, joinedAt: Date.now() },
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
      _activeSession = session;

      // Simulate call progression: dialing → connecting → active
      setTimeout(() => {
        if (_activeSession?.sessionId === session.sessionId) {
          _activeSession = { ..._activeSession, state: "connecting", participants: mockParticipants };
        }
      }, 1500);
      setTimeout(() => {
        if (_activeSession?.sessionId === session.sessionId) {
          _activeSession = { ..._activeSession, state: "active", startedAt: Date.now() };
        }
      }, 3000);

      return session;
    },

    async acceptCall(sessionId: string) {
      if (!_activeSession || _activeSession.sessionId !== sessionId) throw new Error("call_not_found");
      const isConference = _activeSession.kind === "conference";
      const participants = isConference ? _activeSession.participants : mockParticipants;
      _activeSession = { ..._activeSession, state: "connecting", participants };
      setTimeout(() => {
        if (_activeSession) {
          const finalParticipants = isConference
            ? [..._activeSession.participants, { userId: "u-3", displayName: "PatchCable", isMuted: false, isSpeaking: false, audioLevel: 0.0, joinedAt: Date.now() }]
            : _activeSession.participants;
          _activeSession = { ..._activeSession, state: "active", startedAt: Date.now(), participants: finalParticipants };
        }
      }, 1000);
    },

    async rejectCall(sessionId: string, _reason?: string) {
      if (!_activeSession || _activeSession.sessionId !== sessionId) return;
      _activeSession = { ..._activeSession, state: "ended", endedAt: Date.now() };
      setTimeout(() => { _activeSession = null; }, 500);
    },

    async cancelCall(_sessionId: string) {
      _activeSession = null;
    },

    async toggleMute(_sessionId: string) {
      if (!_activeSession) throw new Error("call_not_found");
      const muted = !_activeSession.participants[0]?.isMuted;
      return muted;
    },

    async toggleNoiseSuppression(_sessionId: string) {
      if (!_activeSession) throw new Error("call_not_found");
      const ns = !_activeSession.mediaSettings.noiseSuppression;
      _activeSession = { ..._activeSession, mediaSettings: { ..._activeSession.mediaSettings, noiseSuppression: ns } };
      return ns;
    },

    async updateMediaSettings(sessionId: string, settings: Partial<MediaSettings>) {
      if (!_activeSession || _activeSession.sessionId !== sessionId) throw new Error("call_not_found");
      _activeSession = { ..._activeSession, mediaSettings: { ..._activeSession.mediaSettings, ...settings } };
    },

    getActiveSession() { return _activeSession; },
    getParticipants(_sessionId: string) { return mockParticipants; },

    async enumerateDevices() {
      return { input: mockDevices, output: mockDevices };
    },

    async joinConference(sessionId: string, initiatorId?: string) {
      const session: CallSession = {
        sessionId,
        kind: "conference",
        state: "ringing",
        initiator: initiatorId || "host-user",
        participants: [
          { userId: "u-1", displayName: "Operator", isMuted: false, isSpeaking: true, audioLevel: 0.7, joinedAt: Date.now() },
          { userId: "current-user", displayName: "我", isMuted: false, isSpeaking: false, audioLevel: 0, joinedAt: Date.now() },
        ],
        roomId: "conference-room",
        startedAt: null,
        endedAt: null,
        mediaSettings: { inputDeviceId: "default-mic", outputDeviceId: null, noiseSuppression: true, echoCancellation: true },
      };
      _activeSession = session;
      return session;
    },

    async leaveConference(_sessionId: string) {
      _activeSession = null;
    },
  };
}
