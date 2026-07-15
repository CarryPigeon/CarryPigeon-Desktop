import type { CallSession, CallKind, AudioDeviceInfo } from "../domain/contracts";
import type { VoiceCallStatePort } from "../domain/ports";
import { invokeVoiceCall } from "../host/bridge";
import { activeSession, participants } from "../runtime/voiceCallStoreAccess";

export function createVoiceCallStatePort(): VoiceCallStatePort {
  return {
    async connectSignaling(wsUrl: string, accessToken: string, userId: string, displayName: string) {
      await invokeVoiceCall("voice_call:connect_signaling", {
        wsUrl,
        accessToken,
        userId,
        displayName,
      });
    },

    async startCall(kind: CallKind, roomId: string, targetUserId?: string) {
      if (kind === "direct" && targetUserId) {
        const sessionId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return invokeVoiceCall("voice_call:start_direct_call", { sessionId, targetUserId, roomId }) as Promise<CallSession>;
      }
      const sessionId = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return invokeVoiceCall("voice_call:start_conference", { sessionId, roomId }) as Promise<CallSession>;
    },

    async acceptCall(sessionId: string) {
      await invokeVoiceCall("voice_call:accept_call", { sessionId });
    },

    async rejectCall(sessionId: string, reason?: string) {
      await invokeVoiceCall("voice_call:reject_call", { sessionId, reason: reason ?? null });
    },

    async cancelCall(sessionId: string) {
      await invokeVoiceCall("voice_call:hangup_call", { sessionId });
    },

    async toggleMute(sessionId: string) {
      return invokeVoiceCall("voice_call:toggle_mute", { sessionId }) as Promise<boolean>;
    },

    async toggleNoiseSuppression(sessionId: string) {
      return invokeVoiceCall("voice_call:toggle_noise_suppression", { sessionId }) as Promise<boolean>;
    },

    async updateMediaSettings(sessionId: string, settings: { inputDeviceId?: string | null; outputDeviceId?: string | null }) {
      if (settings.inputDeviceId) {
        await invokeVoiceCall("voice_call:select_input_device", { sessionId, deviceId: settings.inputDeviceId });
      }
      if (settings.outputDeviceId) {
        await invokeVoiceCall("voice_call:select_output_device", { sessionId, deviceId: settings.outputDeviceId });
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
        return await invokeVoiceCall("voice_call:enumerate_audio_devices") as Promise<{
          input: AudioDeviceInfo[];
          output: AudioDeviceInfo[];
        }>;
      } catch {
        // Fallback: use individual commands (backward compatible)
        const input = await invokeVoiceCall("voice_call:enumerate_input_devices") as Promise<AudioDeviceInfo[]>;
        const output = await invokeVoiceCall("voice_call:enumerate_output_devices") as Promise<AudioDeviceInfo[]>;
        return { input, output };
      }
    },

    async joinConference(sessionId: string, initiatorId?: string) {
      return invokeVoiceCall("voice_call:join_conference", { sessionId, initiatorId: initiatorId ?? null }) as Promise<CallSession>;
    },

    async leaveConference(sessionId: string) {
      await invokeVoiceCall("voice_call:leave_conference", { sessionId });
    },
  };
}
