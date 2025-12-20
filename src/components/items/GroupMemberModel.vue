<script setup lang="ts">
const props = defineProps<{
  avatar: string;
  name: string;
}>();

const emit = defineEmits<{
  (e: "avatar-click", payload: { screenX: number; screenY: number }): void;
  (e: "avatar-contextmenu", payload: { screenX: number; screenY: number; clientX: number; clientY: number }): void;
}>();

function click_avatar(event: MouseEvent) {
  emit("avatar-click", { screenX: event.screenX, screenY: event.screenY });
}

function onAvatarContextMenu(event: MouseEvent) {
  emit("avatar-contextmenu", {
    screenX: event.screenX,
    screenY: event.screenY,
    clientX: event.clientX,
    clientY: event.clientY,
  });
}
</script>

<template>
  <div class="group-member-model">
    <img
      class="member-avatar"
      :src="props.avatar"
      alt=""
      @click="click_avatar"
      @contextmenu.prevent="onAvatarContextMenu"
    />
    <p class="member-name">{{ props.name }}</p>
  </div>
</template>

<style scoped lang="scss">
.group-member-model {
  align-items: center;
}

.member-avatar {
  width: 40px;
  height: 40px;
  margin-left: 15px;
  margin-right: 0;
  margin-top: 50px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
}

.member-name {
  margin-left: 100px;
  margin-top: -40px;
}
</style>
