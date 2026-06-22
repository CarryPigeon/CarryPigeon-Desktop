<script setup lang="ts">
defineProps<{ stream?: MediaStream | null; muted?: boolean }>();
</script>
<template>
  <div class="cp-self-preview">
    <video
      v-if="stream"
      :srcObject="stream"
      autoplay
      muted
      playsinline
    />
    <div v-else class="cp-self-preview__placeholder">Camera off</div>
  </div>
</template>
<style scoped lang="scss">
.cp-self-preview {
  position: relative;
  width: 160px;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1a2e;

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
  }
}
</style>
