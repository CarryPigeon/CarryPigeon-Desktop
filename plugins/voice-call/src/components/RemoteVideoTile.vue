<script setup lang="ts">
defineProps<{ stream?: MediaStream | null }>();
</script>
<template>
  <div class="cp-remote-tile">
    <video
      v-if="stream"
      :srcObject="stream"
      autoplay
      playsinline
    />
    <div v-else class="cp-remote-tile__placeholder">Waiting for video...</div>
  </div>
</template>
<style scoped lang="scss">
.cp-remote-tile {
  flex: 1;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1a2e;
  min-height: 200px;

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }
}
</style>
