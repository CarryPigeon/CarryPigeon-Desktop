import { computed, ref } from "vue";
import type { VoiceCallState } from "../runtime/voiceCallState";

/**
 * 默认空状态，确保 resolveState() 在任何时候都可安全访问。
 * 当 setVoiceCallState() 被调用时，这些 ref 会被替换为真正运行时状态。
 */
function createDefaultState(): VoiceCallState {
  return {
    currentState: ref("idle" as const),
    activeSession: ref(null),
    participants: ref([]),
    inputDevices: ref([]),
    outputDevices: ref([]),
    activeSummary: ref(null),
  };
}

let voiceCallState: VoiceCallState = createDefaultState();

export function setVoiceCallState(state: VoiceCallState): void {
  voiceCallState = state;
}

export function resolveState(): VoiceCallState {
  return voiceCallState;
}

export const currentState = computed(() => resolveState().currentState.value);
export const activeSession = computed(() => resolveState().activeSession.value);
export const participants = computed(() => resolveState().participants.value);
export const inputDevices = computed(() => resolveState().inputDevices.value);
export const outputDevices = computed(() => resolveState().outputDevices.value);
export const activeSummary = computed(() => resolveState().activeSummary.value);
