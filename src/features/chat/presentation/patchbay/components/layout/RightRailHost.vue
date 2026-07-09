<script setup lang="ts">
/**
 * @fileoverview RightRailHost.vue
 * @description 右侧边栏容器，默认渲染成员列表，未来支持插件注册自定义边栏。
 */

import type { MembersRailModel } from "@/features/chat/presentation/patchbay/view-models/useMembersRailModel";
import MembersRail from "./MembersRail.vue";

const props = defineProps<{
  model: MembersRailModel;
}>();
</script>

<template>
  <div class="cp-rightRailHost">
    <MembersRail :model="props.model" />
  </div>
</template>

<style scoped lang="scss">
.cp-rightRailHost {
  display: contents;
}
</style>
