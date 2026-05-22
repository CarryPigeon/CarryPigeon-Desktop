import { computed } from "vue";
import type { VoiceCallState } from "../runtime/voiceCallState";

let voiceCallState: VoiceCallState | null = null;

export function setVoiceCallState(state: VoiceCallState): void {
  voiceCallState = state;
}

export function resolveState(): VoiceCallState {
  if (!voiceCallState) {
    throw new Error("[voice-call] voiceCallState not initialized");
  }
  return voiceCallState;
}

export const currentState = computed(() => resolveState().currentState.value);
export const activeSession = computed(() => resolveState().activeSession.value);
export const participants = computed(() => resolveState().participants.value);
export const inputDevices = computed(() => resolveState().inputDevices.value);
export const outputDevices = computed(() => resolveState().outputDevices.value);
export const activeSummary = computed(() => resolveState().activeSummary.value);
