<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

export type MemberMenuAction =
  | "sendMessage"
  | "mention"
  | "viewProfile"
  | "report"
  | "toggleMute";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  muted?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "action", action: MemberMenuAction): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const position = ref({ x: 0, y: 0 });

function close() {
  emit("update:open", false);
}

function emitAction(action: MemberMenuAction) {
  emit("action", action);
  close();
}

async function updatePosition() {
  position.value = { x: props.x, y: props.y };
  await nextTick();

  const el = menuRef.value;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const padding = 8;

  let x = props.x;
  let y = props.y;

  if (x + rect.width + padding > window.innerWidth) {
    x = Math.max(padding, window.innerWidth - rect.width - padding);
  }

  if (y + rect.height + padding > window.innerHeight) {
    y = Math.max(padding, window.innerHeight - rect.height - padding);
  }

  position.value = { x, y };
}

const onDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target as Node | null;
  if (target && menuRef.value?.contains(target)) return;
  close();
};

const onDocumentKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") close();
};

const onWindowResize = () => {
  close();
};

watch(
  () => props.open,
  (open) => {
    if (!open) {
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
      window.removeEventListener("resize", onWindowResize);
      return;
    }

    void updatePosition();

    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    window.addEventListener("resize", onWindowResize);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeyDown);
  window.removeEventListener("resize", onWindowResize);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      ref="menuRef"
      class="member-context-menu"
      role="menu"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @contextmenu.prevent
    >
      <button class="member-context-menu-item" type="button" @click="emitAction('sendMessage')">
        {{ $t("member_send_message") }}
      </button>
      <button class="member-context-menu-item" type="button" @click="emitAction('mention')">
        {{ $t("member_mention") }}
      </button>
      <button class="member-context-menu-item" type="button" @click="emitAction('viewProfile')">
        {{ $t("member_view_profile") }}
      </button>
      <button class="member-context-menu-item warn" type="button" @click="emitAction('report')">
        {{ $t("member_report_user") }}
      </button>
      <button class="member-context-menu-item" type="button" @click="emitAction('toggleMute')">
        {{ props.muted ? $t("member_unmute") : $t("member_mute") }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.member-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 160px;
  padding: 6px;
  background: rgba(255, 255, 255, 1);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}

.member-context-menu-item {
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background-color 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  &.warn {
    color: #d97706;
    &:hover {
      background: rgba(217, 119, 6, 0.12);
    }
  }
}
</style>

