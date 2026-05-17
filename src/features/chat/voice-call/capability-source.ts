import { invoke } from "@tauri-apps/api/core";
import { clonePlainData } from "@/shared/utils/clonePlainData";
import { createWatchedSnapshotObserver } from "@/shared/utils/createWatchedSnapshotObserver";
import type { VoiceCallCapabilities, VoiceCallSnapshot } from "./api-types";
import type { CallSession } from "./domain/contracts";
import {
  currentState,
  activeSession,
  participants,
  inputDevices,
  outputDevices,
  activeSummary,
} from "./presentation/store-access/voiceCallStoreAccess";

interface CallSessionWire {
  session_id: string;
  call_kind: string;
  state: string;
  initiator: string;
  participants: Array<{
    user_id: string;
    display_name: string;
    is_muted: boolean;
    is_speaking: boolean;
    audio_level: number;
    joined_at: number | null;
  }>;
  room_id: string;
  started_at: number | null;
  ended_at: number | null;
  media_settings: {
    input_device_id: string | null;
    output_device_id: string | null;
    noise_suppression: boolean;
    echo_cancellation: boolean;
  };
}

function getSnapshot(): VoiceCallSnapshot {
  return {
    currentState: currentState.value,
    activeSession: activeSession.value ? clonePlainData(activeSession.value) : null,
    participants: clonePlainData(participants.value),
    devices: {
      input: clonePlainData(inputDevices.value),
      output: clonePlainData(outputDevices.value),
    },
    activeSummary: activeSummary.value ? clonePlainData(activeSummary.value) : null,
  };
}

const observeSnapshot = createWatchedSnapshotObserver(getSnapshot);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mapCallSessionWire(wire: CallSessionWire): CallSession {
  return {
    sessionId: wire.session_id,
    kind: wire.call_kind as CallSession["kind"],
    state: wire.state as CallSession["state"],
    initiator: wire.initiator,
    participants: wire.participants.map((p) => ({
      userId: p.user_id,
      displayName: p.display_name,
      isMuted: p.is_muted,
      isSpeaking: p.is_speaking,
      audioLevel: p.audio_level,
      joinedAt: p.joined_at,
    })),
    roomId: wire.room_id,
    startedAt: wire.started_at,
    endedAt: wire.ended_at,
    mediaSettings: {
      inputDeviceId: wire.media_settings.input_device_id,
      outputDeviceId: wire.media_settings.output_device_id,
      noiseSuppression: wire.media_settings.noise_suppression,
      echoCancellation: wire.media_settings.echo_cancellation,
    },
  };
}

export function createVoiceCallCapabilitySource(): VoiceCallCapabilities {
  return {
    getSnapshot,
    observeSnapshot,

    async startDirectCall(targetUserId: string): Promise<CallSession> {
      const sessionId = generateId();
      const wire = await invoke<CallSessionWire>("start_direct_call", {
        session_id: sessionId,
        target_user_id: targetUserId,
        room_id: generateId(),
      });
      return mapCallSessionWire(wire);
    },

    async startConference(): Promise<CallSession> {
      const sessionId = generateId();
      const wire = await invoke<CallSessionWire>("start_conference", {
        session_id: sessionId,
        room_id: generateId(),
      });
      return mapCallSessionWire(wire);
    },

    async acceptCall(): Promise<void> {
      const session = activeSession.value;
      if (!session) throw new Error("No active call session");
      await invoke("accept_call", { session_id: session.sessionId });
    },

    async rejectCall(reason?: string): Promise<void> {
      const session = activeSession.value;
      if (!session) throw new Error("No active call session");
      await invoke("reject_call", { session_id: session.sessionId, reason: reason ?? null });
    },

    async hangup(): Promise<void> {
      const session = activeSession.value;
      if (!session) throw new Error("No active call session");
      await invoke("hangup_call", { session_id: session.sessionId });
    },

    async toggleMute(): Promise<boolean> {
      const session = activeSession.value;
      if (!session) throw new Error("No active call session");
      return invoke<boolean>("toggle_mute", { session_id: session.sessionId });
    },

    async toggleNoiseSuppression(): Promise<boolean> {
      const session = activeSession.value;
      if (!session) throw new Error("No active call session");
      return invoke<boolean>("toggle_noise_suppression", { session_id: session.sessionId });
    },

    async selectInputDevice(deviceId: string): Promise<void> {
      const session = activeSession.value;
      if (!session) throw new Error("No active call session");
      await invoke("select_input_device", { session_id: session.sessionId, device_id: deviceId });
    },

    async selectOutputDevice(deviceId: string): Promise<void> {
      const session = activeSession.value;
      if (!session) throw new Error("No active call session");
      await invoke("select_output_device", { session_id: session.sessionId, device_id: deviceId });
    },
  };
}
