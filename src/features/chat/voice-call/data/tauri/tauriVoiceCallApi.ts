import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import type { CallSession, CallKind, AudioDeviceInfo } from "../../domain/contracts";
import type { VoiceCallStatePort } from "../../domain/ports";
import { activeSession, participants } from "../../presentation/store-access/voiceCallStoreAccess";

export function createTauriVoiceCallApi(): VoiceCallStatePort {
  return {
    async connectSignaling(wsUrl: string, accessToken: string, userId: string, displayName: string) {
      await invoke<void>(TAURI_COMMANDS.connectSignaling, {
        wsUrl,
        accessToken,
        userId,
        displayName,
      });
    },

    async startCall(kind: CallKind, roomId: string, targetUserId?: string) {
      if (kind === "direct" && targetUserId) {
        const sessionId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return invoke<CallSession>(TAURI_COMMANDS.startDirectCall, { sessionId, targetUserId, roomId });
      }
      const sessionId = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return invoke<CallSession>(TAURI_COMMANDS.startConference, { sessionId, roomId });
    },

    async acceptCall(sessionId: string) {
      await invoke<void>(TAURI_COMMANDS.acceptCall, { sessionId });
    },

    async rejectCall(sessionId: string, reason?: string) {
      await invoke<void>(TAURI_COMMANDS.rejectCall, { sessionId, reason: reason ?? null });
    },

    async cancelCall(sessionId: string) {
      await invoke<void>(TAURI_COMMANDS.hangupCall, { sessionId });
    },

    async toggleMute(sessionId: string) {
      return invoke<boolean>(TAURI_COMMANDS.toggleMute, { sessionId });
    },

    async toggleNoiseSuppression(sessionId: string) {
      return invoke<boolean>(TAURI_COMMANDS.toggleNoiseSuppression, { sessionId });
    },

    async updateMediaSettings(sessionId: string, settings) {
      if (settings.inputDeviceId) {
        await invoke<void>(TAURI_COMMANDS.selectInputDevice, { sessionId, deviceId: settings.inputDeviceId });
      }
      if (settings.outputDeviceId) {
        await invoke<void>(TAURI_COMMANDS.selectOutputDevice, { sessionId, deviceId: settings.outputDeviceId });
      }
    },

    getActiveSession(): CallSession | null {
      return activeSession.value;
    },

    getParticipants(_sessionId: string) {
      return participants.value;
    },

    async enumerateDevices() {
      try {
        const result = await invoke<{ input: AudioDeviceInfo[]; output: AudioDeviceInfo[] }>(TAURI_COMMANDS.enumerateAudioDevices);
        return result;
      } catch {
        // Fallback: use individual commands (backward compatible)
        const input = await invoke<AudioDeviceInfo[]>(TAURI_COMMANDS.enumerateInputDevices);
        const output = await invoke<AudioDeviceInfo[]>(TAURI_COMMANDS.enumerateOutputDevices);
        return { input, output };
      }
    },

    async joinConference(sessionId: string, initiatorId?: string) {
      return invoke<CallSession>(TAURI_COMMANDS.joinConference, { sessionId, initiatorId: initiatorId ?? null });
    },

    async leaveConference(sessionId: string) {
      await invoke<void>(TAURI_COMMANDS.leaveConference, { sessionId });
    },
  };
}
