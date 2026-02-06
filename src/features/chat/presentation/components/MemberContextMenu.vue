<script setup lang="ts">
/**
 * @fileoverview MemberContextMenu.vue
 * @description chat｜组件：MemberContextMenu。
 */

import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";

export type MemberMenuAction = "view_profile" | "kick" | "set_admin" | "remove_admin" | "ban";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  memberRole: "owner" | "admin" | "member" | string;
  currentUserRole: "owner" | "admin" | "member" | string;
  isSelf: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "action", action: MemberMenuAction): void;
}>();

const { t } = useI18n();

/**
 * 关闭菜单。
 *
 * @returns 无返回值。
 */
function handleClose(): void {
  emit("close");
}

/**
 * 触发动作事件并关闭菜单。
 *
 * @param action - 动作标识。
 * @returns 无返回值。
 */
function handleAction(action: MemberMenuAction): void {
  emit("action", action);
  emit("close");
}

/**
 * 处理全局点击/按键事件：点击任意位置或按下 Escape 时关闭菜单。
 *
 * @param e - 全局事件。
 * @returns 无返回值。
 */
function onGlobal(e: MouseEvent | KeyboardEvent): void {
  if (!props.open) return;
  if (e instanceof KeyboardEvent && e.key === "Escape") {
    e.preventDefault();
    handleClose();
    return;
  }
  if (e instanceof MouseEvent) handleClose();
}

/**
 * 组件挂载：注册全局事件监听。
 *
 * @returns 无返回值。
 */
function handleMounted(): void {
  window.addEventListener("mousedown", onGlobal);
  window.addEventListener("keydown", onGlobal);
}

onMounted(handleMounted);

/**
 * 组件卸载：移除全局事件监听。
 *
 * @returns 无返回值。
 */
function handleBeforeUnmount(): void {
  window.removeEventListener("mousedown", onGlobal);
  window.removeEventListener("keydown", onGlobal);
}

onBeforeUnmount(handleBeforeUnmount);
</script>

<template>
  <!-- 组件：MemberContextMenu｜职责：成员操作菜单（查看/踢出/设管理员/封禁） -->
  <teleport to="body">
    <div v-if="props.open" class="cp-membermenu" :style="{ left: `${props.x}px`, top: `${props.y}px` }" role="menu">
      <button class="cp-membermenu__item" type="button" role="menuitem" @click="handleAction('view_profile')">
        {{ t("member_view_profile") }}
      </button>

      <template v-if="!props.isSelf && props.memberRole !== 'owner'">
        <!-- Owner 可管理管理员 -->
        <template v-if="props.currentUserRole === 'owner'">
          <div class="cp-membermenu__sep" aria-hidden="true"></div>
          <button v-if="props.memberRole === 'member'" class="cp-membermenu__item" type="button" role="menuitem" @click="handleAction('set_admin')">
            {{ t("set_admin") }}
          </button>
          <button v-if="props.memberRole === 'admin'" class="cp-membermenu__item" type="button" role="menuitem" @click="handleAction('remove_admin')">
            {{ t("remove_admin") }}
          </button>
        </template>

        <!-- Admin+ 可踢人/封禁 -->
        <template v-if="props.currentUserRole === 'owner' || props.currentUserRole === 'admin'">
          <div v-if="props.currentUserRole !== 'owner'" class="cp-membermenu__sep" aria-hidden="true"></div>
          <button class="cp-membermenu__item" type="button" role="menuitem" @click="handleAction('ban')">
            {{ t("add_ban") }}
          </button>
          <button class="cp-membermenu__item danger" type="button" role="menuitem" @click="handleAction('kick')">
            {{ t("kick_member") }}
          </button>
        </template>
      </template>
    </div>
  </teleport>
</template>

<style scoped lang="scss">
/* MemberContextMenu styles */
.cp-membermenu {
  position: fixed;
  z-index: 60;
  min-width: 180px;
  border: 1px solid color-mix(in oklab, var(--cp-info) 18%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-panel) 92%, rgba(0, 0, 0, 0.05));
  border-radius: 16px;
  box-shadow: var(--cp-shadow);
  padding: 8px;
  backdrop-filter: blur(10px);
}

.cp-membermenu__item {
  width: 100%;
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-membermenu__item:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
}

.cp-membermenu__sep {
  margin: 6px 6px;
  height: 1px;
  background: var(--cp-border-light);
}

.cp-membermenu__item.danger {
  color: color-mix(in oklab, var(--cp-danger) 72%, var(--cp-text));
}

.cp-membermenu__item.danger:hover {
  border-color: color-mix(in oklab, var(--cp-danger) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-hover-bg));
}
</style>
