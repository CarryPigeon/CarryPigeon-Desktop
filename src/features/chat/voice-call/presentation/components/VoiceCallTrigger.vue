<template>
  <VoiceCallButton
    :call-state="callState"
    :disabled="isBusy"
    :title="buttonTitle"
    @start="handleStartCall"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CallState } from "../../domain/contracts";
import VoiceCallButton from "./VoiceCallButton.vue";

const props = defineProps<{
  roomId: string;
  roomName: string;
  callState: CallState;
}>();

const emit = defineEmits<{
  start: [];
}>();

const isBusy = computed(() =>
  props.callState === "dialing" || props.callState === "ringing" || props.callState === "connecting"
);

const buttonTitle = computed(() => {
  if (props.callState === "active") return "通话中";
  return "发起语音通话";
});

function handleStartCall() {
  emit("start");
}
</script>
