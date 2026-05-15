import { ref } from "vue";
import type { CallState, CallSession, CallSummary, AudioDeviceInfo, CallParticipant } from "../../domain/contracts";

export function createVoiceCallState() {
  const currentState = ref<CallState>("idle");
  const activeSession = ref<CallSession | null>(null);
  const participants = ref<readonly CallParticipant[]>([]);
  const inputDevices = ref<readonly AudioDeviceInfo[]>([]);
  const outputDevices = ref<readonly AudioDeviceInfo[]>([]);
  const activeSummary = ref<CallSummary | null>(null);

  return {
    currentState,
    activeSession,
    participants,
    inputDevices,
    outputDevices,
    activeSummary,
  };
}

export type VoiceCallState = ReturnType<typeof createVoiceCallState>;
