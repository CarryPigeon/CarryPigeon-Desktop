import { invoke } from "@tauri-apps/api/core";
import type { CallSession, CallKind, AudioDeviceInfo } from "../../domain/contracts";
import type { VoiceCallStatePort } from "../../domain/ports";
import { activeSession, participants } from "../../presentation/store-access/voiceCallStoreAccess";

export function createTauriVoiceCallApi(): VoiceCallStatePort {
  return {
    async connectSignaling(wsUrl: string, accessToken: string, userId: string, displayName: string) {
      await invoke<void>("connect_signaling", {
        wsUrl,
        accessToken,
        userId,
        displayName,
      });
    },

    async startCall(kind: CallKind, roomId: string, targetUserId?: string) {
      if (kind === "direct" && targetUserId) {
        const sessionId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return invoke<CallSession>("start_direct_call", { sessionId, targetUserId, roomId });
      }
      const sessionId = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return invoke<CallSession>("start_conference", { sessionId, roomId });
    },

    async acceptCall(sessionId: string) {
      await invoke<void>("accept_call", { sessionId });
    },

    async rejectCall(sessionId: string, reason?: string) {
      await invoke<void>("reject_call", { sessionId, reason: reason ?? null });
    },

    async cancelCall(sessionId: string) {
      await invoke<void>("hangup_call", { sessionId });
    },

    async toggleMute(sessionId: string) {
      return invoke<boolean>("toggle_mute", { sessionId });
    },

    async toggleNoiseSuppression(sessionId: string) {
      return invoke<boolean>("toggle_noise_suppression", { sessionId });
    },

    async updateMediaSettings(sessionId: string, settings) {
      if (settings.inputDeviceId) {
        await invoke<void>("select_input_device", { sessionId, deviceId: settings.inputDeviceId });
      }
      if (settings.outputDeviceId) {
        await invoke<void>("select_output_device", { sessionId, deviceId: settings.outputDeviceId });
      }
    },

    getActiveSession(): CallSession | null {
      return activeSession.value;
    },

    getParticipants(_sessionId: string) {
      return participants.value;
    },

    async enumerateDevices() {
      const input = await invoke<AudioDeviceInfo[]>("enumerate_input_devices");
      const output = await invoke<AudioDeviceInfo[]>("enumerate_output_devices");
      return { input, output };
    },

    async joinConference(sessionId: string, initiatorId?: string) {
      return invoke<CallSession>("join_conference", { sessionId, initiatorId: initiatorId ?? null });
    },

    async leaveConference(sessionId: string) {
      await invoke<void>("leave_conference", { sessionId });
    },
  };
}
