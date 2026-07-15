<template>
  <div class="voice-call-trigger">
    <VideoCallButton
      :call-state="callState"
      @start="handleVideoCall"
    />
    <VoiceCallButton
      :call-state="callState"
      @start="handleDirectCall"
    />
    <VoiceCallButton
      :call-state="callState"
      conference
      @start="handleConferenceCall"
    />
  </div>
</template>

<script setup lang="ts">
import type { CallState } from "../domain/contracts";
import VoiceCallButton from "./VoiceCallButton.vue";
import VideoCallButton from "./VideoCallButton.vue";

const props = defineProps<{
  roomId: string;
  roomName: string;
  callState: CallState;
  targetUserId?: string;
}>();

const emit = defineEmits<{
  startDirect: [targetUserId: string];
  startConference: [];
  startVideo: [targetUserId: string];
}>();

function handleDirectCall() {
  emit("startDirect", props.targetUserId ?? "");
}

function handleConferenceCall() {
  emit("startConference");
}

function handleVideoCall() {
  emit("startVideo", props.targetUserId ?? "");
}
</script>

<style scoped lang="scss">
.voice-call-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
