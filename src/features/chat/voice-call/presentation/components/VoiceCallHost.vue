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
    :output-devices="outputDevices"
    :current-output-device-id="currentOutputDeviceId"
    :is-conference="isConference"
    @toggle-mute="toggleMute"
    @toggle-noise-suppression="toggleNoiseSuppression"
    @select-input-device="selectInputDevice"
    @select-output-device="selectOutputDevice"
    @hangup="handleHangup"
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
  targetUserId?: string;
  wsUrl?: string;
  accessToken?: string;
  userId?: string;
  displayName?: string;
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
  outputDevices,
  connectSignaling,
  startDirectCall,
  startConference,
  acceptCall,
  rejectCall,
  hangup,
  cancelCall,
  toggleMute,
  toggleNoiseSuppression,
  selectInputDevice,
  selectOutputDevice,
  initDevices,
  joinConference,
  leaveConference,
} = useVoiceCall({
  statePort,
  roomId: () => props.roomId,
});

const isConference = computed(() => activeSession.value?.kind === "conference");

const callerName = computed(() => {
  const session = activeSession.value;
  if (!session) return "";
  return session.participants.find((p: CallParticipant) => p.userId !== "current-user")?.displayName ?? "未知用户";
});

const currentInputDeviceId = computed(() => {
  return activeSession.value?.mediaSettings.inputDeviceId ?? null;
});

const currentOutputDeviceId = computed(() => {
  return activeSession.value?.mediaSettings.outputDeviceId ?? null;
});

function handleAccept() {
  acceptCall();
}

function handleReject() {
  rejectCall("declined");
}

function handleHangup() {
  if (callState.value === "dialing") {
    cancelCall();
  } else if (isConference.value) {
    void leaveConference();
  } else {
    hangup();
  }
}

onMounted(() => {
  initDevices();
  if (props.wsUrl && props.accessToken && props.userId && props.displayName) {
    connectSignaling(props.wsUrl, props.accessToken, props.userId, props.displayName);
  }
});

function startCall(targetUserId?: string) {
  const uid = targetUserId || props.targetUserId || "";
  return startDirectCall(uid);
}

defineExpose({
  callState,
  startDirectCall: startCall,
  startConference,
  joinConference,
  leaveConference,
});
</script>
