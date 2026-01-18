<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const avatar = computed(() => String(route.query.avatar ?? ""));
const name = computed(() => String(route.query.name ?? ""));
const email = computed(() => String(route.query.email ?? ""));
const bio = computed(() => String(route.query.bio ?? route.query.description ?? ""));
</script>

<template>
  <div class="card">
    <div class="header">
      <img v-if="avatar" class="avatar" :src="avatar" alt="avatar" />
      <div v-else class="avatar placeholder" aria-hidden="true"></div>

      <div class="meta">
        <div class="name" :title="name">{{ name }}</div>
        <div v-if="email" class="email" :title="email">{{ email }}</div>
        <div v-else class="email muted">&nbsp;</div>
      </div>
    </div>

    <div v-if="bio" class="bio" :title="bio">{{ bio }}</div>
    <div v-else class="bio-muted">&nbsp;</div>
  </div>
</template>

<style scoped lang="scss">
:global(html),
:global(body) {
  margin: 0;
  padding: 0;
  background: transparent;
}

.card {
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 1);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  background: #e5e7eb;
  flex: 0 0 auto;
}

.avatar.placeholder {
  background: #e5e7eb;
}

.meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email {
  font-size: 12px;
  color: #374151;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bio {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 3;
}

.muted {
  color: transparent;
}
</style>