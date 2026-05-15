<template>
  <VoiceCallBanner
    :caller-name="callerName"
    :visible="callState === 'ringing'"
    @accept="handleAccept"
    @reject="handleReject"
  />
  <VoiceCallPanel
    :state="callState"
    :duration="duration"
    :participants="participants"
    :is-muted="isMuted"
    :is-noise-suppression-on="isNoiseSuppressionOn"
    :input-devices="inputDevices"
    :current-input-device-id="currentInputDeviceId"
    @toggle-mute="toggleMute"
    @toggle-noise-suppression="toggleNoiseSuppression"
    @select-input-device="selectInputDevice"
    @hangup="hangup"
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useVoiceCall } from "../composables/useVoiceCall";
import VoiceCallBanner from "./VoiceCallBanner.vue";
import VoiceCallPanel from "./VoiceCallPanel.vue";
import { createMockVoiceCallStatePort } from "../../mock";
import { createTauriVoiceCallApi } from "../../data/tauri/tauriVoiceCallApi";
import type { CallParticipant } from "../../domain/contracts";

const props = defineProps<{
  roomId: string;
  roomName: string;
}>();

const statePort = import.meta.env.PROD
  ? createTauriVoiceCallApi()
  : createMockVoiceCallStatePort();

const {
  callState,
  activeSession,
  participants,
  duration,
  isMuted,
  isNoiseSuppressionOn,
  inputDevices,
  startDirectCall,
  startConference,
  acceptCall,
  rejectCall,
  hangup,
  toggleMute,
  toggleNoiseSuppression,
  selectInputDevice,
  initDevices,
} = useVoiceCall({
  statePort,
  roomId: () => props.roomId,
});

const callerName = computed(() => {
  const session = activeSession.value;
  if (!session) return "";
  return session.participants.find((p: CallParticipant) => p.userId !== "current-user")?.displayName ?? "未知用户";
});

const currentInputDeviceId = computed(() => {
  return activeSession.value?.mediaSettings.inputDeviceId ?? null;
});

function handleAccept() {
  acceptCall();
}

function handleReject() {
  rejectCall("declined");
}

onMounted(() => {
  initDevices();
});

defineExpose({
  callState,
  startDirectCall,
  startConference,
});
</script>
