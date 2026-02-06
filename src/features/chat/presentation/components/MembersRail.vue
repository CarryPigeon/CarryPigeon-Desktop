<script setup lang="ts">
/**
 * @fileoverview MembersRail.vue
 * @description Patchbay 右侧成员栏（成员列表只读展示）。
 */

import { members } from "@/features/chat/presentation/store/chatStore";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
</script>

<template>
  <!-- 组件：MembersRail｜职责：成员栏（只读成员列表） -->
  <!-- 区块：<aside> .cp-rail--members -->
  <aside class="cp-rail cp-rail--members">
    <div class="cp-rail__title">PORTS</div>
    <div class="cp-memberList">
      <div v-for="u in members" :key="u.id" class="cp-member">
        <AvatarBadge :name="u.name" :size="28" />
        <div class="cp-member__meta">
          <div class="cp-member__name">{{ u.name }}</div>
          <div class="cp-member__role">{{ u.role }}</div>
        </div>
      </div>
    </div>
  </aside>
</template>
