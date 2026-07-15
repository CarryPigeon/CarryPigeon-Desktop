<script setup lang="ts">
import SelfPreviewTile from "./SelfPreviewTile.vue";
import RemoteVideoTile from "./RemoteVideoTile.vue";

defineProps<{
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
}>();
</script>
<template>
  <div class="cp-video-grid">
    <RemoteVideoTile :stream="remoteStream" />
    <SelfPreviewTile :stream="localStream" :muted="true" />
  </div>
</template>
<style scoped lang="scss">
.cp-video-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: #0f0f1a;
  border-radius: 8px;
}
</style>
