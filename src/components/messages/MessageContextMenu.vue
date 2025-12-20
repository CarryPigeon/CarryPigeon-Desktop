<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

type MenuAction = 'copy' | 'recall' | 'forward';

const props = withDefaults(
  defineProps<{
    open: boolean;
    x: number;
    y: number;
    showRecall?: boolean;
  }>(),
  {
    showRecall: false,
  },
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'action', action: MenuAction): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const position = ref({ x: 0, y: 0 });

function close() {
  emit('update:open', false);
}

function emitAction(action: MenuAction) {
  emit('action', action);
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
  if (event.key === 'Escape') close();
};

const onWindowResize = () => {
  close();
};

watch(
  () => props.open,
  (open) => {
    if (!open) {
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
      window.removeEventListener('resize', onWindowResize);
      return;
    }

    void updatePosition();

    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    window.addEventListener('resize', onWindowResize);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeyDown);
  window.removeEventListener('resize', onWindowResize);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      ref="menuRef"
      class="message-context-menu"
      role="menu"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @contextmenu.prevent
    >
      <button class="message-context-menu-item" type="button" @click="emitAction('copy')">
        {{ $t('copy_message') }}
      </button>
      <button
        v-if="props.showRecall"
        class="message-context-menu-item"
        type="button"
        @click="emitAction('recall')"
      >
        {{ $t('recall_message') }}
      </button>
      <button class="message-context-menu-item" type="button" @click="emitAction('forward')">
        {{ $t('forward_message') }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.message-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 120px;
  padding: 6px;
  background: rgba(255, 255, 255, 1);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.message-context-menu-item {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.message-context-menu-item:hover {
  background: rgba(0, 0, 0, 0.06);
}
</style>
