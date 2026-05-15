import type { VoiceCallCapabilities } from "./api-types";
import { createVoiceCallCapabilitySource } from "./capability-source";

export function createVoiceCallCapabilities(): VoiceCallCapabilities {
  return createVoiceCallCapabilitySource();
}

let voiceCallCapabilitiesSingleton: VoiceCallCapabilities | null = null;

export function getVoiceCallCapabilities(): VoiceCallCapabilities {
  voiceCallCapabilitiesSingleton ??= createVoiceCallCapabilities();
  return voiceCallCapabilitiesSingleton;
}
