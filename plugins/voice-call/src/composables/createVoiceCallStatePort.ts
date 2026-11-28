import type { CallSession, CallKind, AudioDeviceInfo } from "../domain/contracts";
import type { VoiceCallStatePort } from "../domain/ports";
import { invokeVoiceCall } from "../host/bridge";
import { activeSession, participants } from "../runtime/voiceCallStoreAccess";

type NativeCallSession = {
  session_id: string;
  call_kind: CallKind;
  state: CallSession["state"];
  initiator: string;
  participants: Array<{ user_id: string; display_name: string; is_muted: boolean; is_speaking: boolean; audio_level: number; joined_at: number | null }>;
  room_id: string;
  started_at: number | null;
  ended_at: number | null;
  media_settings: { input_device_id: string | null; output_device_id: string | null; noise_suppression: boolean; echo_cancellation: boolean };
};

function fromNativeSession(session: NativeCallSession): CallSession {
  return {
    sessionId: session.session_id,
    kind: session.call_kind,
    state: session.state,
    initiator: session.initiator,
    participants: session.participants.map((p) => ({
      userId: p.user_id, displayName: p.display_name, isMuted: p.is_muted,
      isSpeaking: p.is_speaking, audioLevel: p.audio_level, joinedAt: p.joined_at,
    })),
    roomId: session.room_id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    mediaSettings: {
      inputDeviceId: session.media_settings.input_device_id,
      outputDeviceId: session.media_settings.output_device_id,
      noiseSuppression: session.media_settings.noise_suppression,
      echoCancellation: session.media_settings.echo_cancellation,
    },
  };
}

async function invokeSession(command: string, args: Record<string, unknown>): Promise<CallSession> {
  return fromNativeSession(await invokeVoiceCall(command, args) as NativeCallSession);
}

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
      if (kind === "direct") {
        if (!targetUserId?.trim()) throw new Error("Direct call requires a target user");
        const sessionId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        return invokeSession("voice_call:start_direct_call", { sessionId, targetUserId, roomId });
      }
      const sessionId = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return invokeSession("voice_call:start_conference", { sessionId, roomId });
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
        const input = await (invokeVoiceCall("voice_call:enumerate_input_devices") as Promise<AudioDeviceInfo[]>);
        const output = await (invokeVoiceCall("voice_call:enumerate_output_devices") as Promise<AudioDeviceInfo[]>);
        return { input, output };
      }
    },

    async joinConference(sessionId: string, initiatorId?: string) {
      return invokeSession("voice_call:join_conference", { sessionId, initiatorId: initiatorId ?? null });
    },

    async leaveConference(sessionId: string) {
      await invokeVoiceCall("voice_call:leave_conference", { sessionId });
    },
  };
}
