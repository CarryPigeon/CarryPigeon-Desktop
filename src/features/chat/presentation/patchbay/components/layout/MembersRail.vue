<script setup lang="ts">
/**
 * @fileoverview MembersRail.vue
 * @description Patchbay 右侧成员栏（成员列表只读展示）。
 */

import type { MembersRailModel } from "@/features/chat/presentation/patchbay/view-models/useMembersRailModel";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import UserProfilePopover from "@/features/account/profile/presentation/components/UserProfilePopover.vue";

const props = defineProps<{
  model: MembersRailModel;
}>();
</script>

<template>
  <!-- 组件：MembersRail｜职责：成员栏（只读成员列表） -->
  <!-- 区块：<aside> .cp-rail--members -->
  <aside class="cp-rail cp-rail--members">
    <div class="cp-rail__title">Members</div>
    <div v-if="props.model.members.length === 0" class="cp-rail__empty">No members in this channel.</div>
    <div v-else class="cp-memberList">
      <div v-for="u in props.model.members" :key="u.id" class="cp-member">
        <UserProfilePopover
          :user-id="u.id"
          :username="u.name"
          trigger="hover"
        >
          <AvatarBadge :name="u.name" :size="28" />
        </UserProfilePopover>
        <div class="cp-member__meta">
          <div class="cp-member__name">{{ u.name }}</div>
          <div class="cp-member__role">{{ u.role }}</div>
        </div>
      </div>
    </div>
  </aside>
</template>
