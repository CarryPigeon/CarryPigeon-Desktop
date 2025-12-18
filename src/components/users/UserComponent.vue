<script setup lang="ts">
import setting from "/settings.svg?url";
import add from "/add.svg?url";
import { computed } from "vue";
import { useRouter } from "vue-router";

const props = defineProps<{
  avatar?: string;
  name?: string;
  description?: string;
  id?: number;
}>();

const emit = defineEmits<{
  (e: "avatar-click", payload: { screenX: number; screenY: number }): void;
}>();

function limitToChars(input: string, maxChars: number) {
  const chars = Array.from(input);
  if (chars.length <= maxChars) return input;
  return chars.slice(0, maxChars).join("");
}

const avatar = computed(() => props.avatar ?? "");
const name = computed(() => props.name ?? "");
const description = computed(() => limitToChars(props.description ?? "", 25));
const id = computed(() => props.id ?? 0);

const router = useRouter();

function click_setting() {
  router.push("/settings");
}

function click_add(): void {
  router.push("/channels/new");
}

function click_avatar(event: MouseEvent) {
  emit("avatar-click", { screenX: event.screenX, screenY: event.screenY });
}
</script>

<template>
  <div class="container">
    <img class="image" :src="avatar" alt="avatar" @click="click_avatar" />

    <div class="info">
      <p class="username">{{ name }} - {{ id }}</p>
      <p class="description">{{ description }}</p>
    </div>

    <div class="actions">
      <img class="setting-icon" :src="setting" @click="click_setting" alt="" />
      <img class="add-icon" :src="add" alt="" @click="click_add" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.container {
  position: fixed;
  left: 63px;
  bottom: 0;
  width: 257px;
  min-height: 60px;
  box-sizing: border-box;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  opacity: 1;
  background: rgba(229, 231, 235, 1);
}

.image {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  opacity: 1;
  background: rgba(204, 204, 204, 1);
  cursor: pointer;
}

.info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.username {
  margin: 0;
  opacity: 1;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 17.38px;
  color: rgba(0, 0, 0, 1);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.description {
  margin: 0;
  opacity: 1;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 17.38px;
  color: rgba(35, 66, 87, 1);
  text-align: left;
  vertical-align: middle;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-icon {
  cursor: pointer;
  &:hover {
    background-color: #f0f0f0;
  }
}

.add-icon {
  cursor: pointer;
  &:hover {
    background-color: #f0f0f0;
  }
}
</style>
