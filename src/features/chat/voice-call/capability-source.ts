import { clonePlainData } from "@/shared/utils/clonePlainData";
import { createWatchedSnapshotObserver } from "@/shared/utils/createWatchedSnapshotObserver";
import type { VoiceCallCapabilities, VoiceCallSnapshot } from "./api-types";
import {
  currentState,
  activeSession,
  participants,
  inputDevices,
  outputDevices,
  activeSummary,
} from "./presentation/store-access/voiceCallStoreAccess";

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

export function createVoiceCallCapabilitySource(): VoiceCallCapabilities {
  return {
    getSnapshot,
    observeSnapshot,
    startDirectCall(_targetUserId: string): Promise<never> { throw new Error("not implemented"); },
    startConference(): Promise<never> { throw new Error("not implemented"); },
    acceptCall(): Promise<never> { throw new Error("not implemented"); },
    rejectCall(_reason?: string): Promise<never> { throw new Error("not implemented"); },
    hangup(): Promise<never> { throw new Error("not implemented"); },
    toggleMute(): Promise<never> { throw new Error("not implemented"); },
    toggleNoiseSuppression(): Promise<never> { throw new Error("not implemented"); },
    selectInputDevice(_deviceId: string): Promise<never> { throw new Error("not implemented"); },
    selectOutputDevice(_deviceId: string): Promise<never> { throw new Error("not implemented"); },
  };
}
