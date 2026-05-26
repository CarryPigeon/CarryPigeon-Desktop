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
import { currentServerSocket } from "@/features/server-connection/api";
import { readAuthToken } from "@/shared/utils/localState";
import { currentChatUserId, currentChatUsername } from "../../../composition/chatAccountSession";
import type { CallParticipant } from "../../domain/contracts";

const props = defineProps<{
  roomId: string;
  roomName: string;
  targetUserId?: string;
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
  userId: () => currentChatUserId.value,
});

const isConference = computed(() => activeSession.value?.kind === "conference");

const callerName = computed(() => {
  const session = activeSession.value;
  if (!session) return "";
  const selfId = currentChatUserId.value;
  return session.participants.find((p: CallParticipant) => p.userId !== selfId)?.displayName ?? "未知用户";
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

const wsUrl = computed(() => {
  const socket = currentServerSocket.value;
  if (!socket) return "";
  const host = socket.startsWith("http") ? socket.replace(/^https?:\/\//, "") : socket;
  return `wss://${host}/signaling`;
});

const accessToken = computed(() => readAuthToken(currentServerSocket.value ?? ""));

onMounted(() => {
  initDevices();
  const url = wsUrl.value;
  const token = accessToken.value;
  const uid = currentChatUserId.value;
  const name = currentChatUsername.value;
  if (url && token && uid && name) {
    connectSignaling(url, token, uid, name);
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
