<script setup lang="ts">
/**
 * @fileoverview ServerRail.vue
 * @description Patchbay 左侧服务器栏（Rack 列表 + 快捷入口 + 服务端免打扰）。
 */

import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  MUTE_DURATION_1H,
  MUTE_DURATION_8H,
  MUTE_DURATION_24H,
  MUTE_DURATION_FOREVER,
} from "@/features/chat/presentation/patchbay/view-models/useChannelMuteStore";

const { t } = useI18n();

type ServerRackItem = {
  /**
   * 服务器展示名称。
   */
  name: string;
  /**
   * 服务器 socket（host:port 或 ws/http 地址等）。
   */
  serverSocket: string;
};

const props = defineProps<{
  /**
   * 服务器机架列表。
   */
  racks: readonly Readonly<ServerRackItem>[];
  /**
   * 当前激活的 server socket。
   */
  activeSocket: string;
  /**
   * 服务端级免打扰是否开启。
   */
  serverMuted: boolean;
  /**
   * 服务端级免打扰到期时间（epoch ms，`null` 表示永久或未设置）。
   */
  serverMutedUntil: number | null;
}>();

const emit = defineEmits<{
  /**
   * 用户切换服务器。
   */
  (e: "switch", serverSocket: string): void;
  /**
   * 打开服务器管理器。
   */
  (e: "open-server-manager"): void;
  /**
   * 打开插件中心页。
   */
  (e: "open-plugins"): void;
  /**
   * 打开设置页。
   */
  (e: "open-settings"): void;
  (e: "toggle-server-mute"): [];
  (e: "mute-server-for-duration", durationMs: number | undefined): void;
  (e: "unmute-server"): void;
}>();

const dndMenuOpen = ref(false);
const dndMenuAnchor = ref<HTMLElement | null>(null);

const dndMenuX = computed(() => {
  const el = dndMenuAnchor.value;
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  return rect.right;
});
const dndMenuY = computed(() => {
  const el = dndMenuAnchor.value;
  if (!el) return 0;
  return el.getBoundingClientRect().bottom + 4;
});

function openDndMenu(): void {
  dndMenuOpen.value = true;
}

function closeDndMenu(): void {
  dndMenuOpen.value = false;
}

function onDndToggle(): void {
  closeDndMenu();
  if (props.serverMuted) {
    emit("unmute-server");
  } else {
    emit("toggle-server-mute");
  }
}

function onDndMuteForDuration(durationMs: number | undefined): void {
  closeDndMenu();
  emit("mute-server-for-duration", durationMs);
}

const dndTitle = computed(() => {
  if (!props.serverMuted) return t("server_dnd_off");
  if (props.serverMutedUntil && props.serverMutedUntil > 0) {
    return t("server_dnd_muted_until", { time: formatTime(props.serverMutedUntil) });
  }
  return t("server_dnd_on");
});

function formatTime(epoch: number): string {
  const d = new Date(epoch);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
</script>

<template>
  <!-- 组件：ServerRail｜职责：服务器栏（Rack 列表 + 快捷入口 + 服务端 DND） -->
  <!-- 区块：<aside> .cp-rail--servers -->
  <aside class="cp-rail cp-rail--servers">
    <div class="cp-rail__head">
      <span class="cp-rail__title">{{ t("servers") }}</span>
      <button
        ref="dndMenuAnchor"
        class="cp-dndBtn"
        :class="{ 'cp-dndBtn--active': props.serverMuted }"
        type="button"
        :title="dndTitle"
        :aria-label="dndTitle"
        :aria-pressed="props.serverMuted"
        aria-haspopup="menu"
        @click.stop="openDndMenu"
        @contextmenu.prevent="openDndMenu"
      >
        <span class="cp-dndBtn__icon" aria-hidden="true">{{ props.serverMuted ? "🔕" : "🔔" }}</span>
      </button>
    </div>
    <div class="cp-rail__top-actions">
      <button class="cp-rail__btn" type="button" @click="emit('open-server-manager')">
        {{ t("manage") }}
      </button>
    </div>
    <div v-if="props.racks.length === 0" class="cp-rail__empty">{{ t("no_servers") }}</div>
    <div v-else class="cp-rackList" role="listbox" aria-label="servers">
      <button
        v-for="s in props.racks"
        :key="s.serverSocket"
        class="cp-rack"
        type="button"
        :data-active="s.serverSocket === props.activeSocket"
        @click="emit('switch', s.serverSocket)"
      >
        <span class="cp-rack__led" aria-hidden="true"></span>
        <span class="cp-rack__name">{{ s.name }}</span>
      </button>
    </div>
    <div class="cp-rail__foot">
      <button class="cp-rail__btn" type="button" @click="emit('open-plugins')">{{ t("plugins") }}</button>
      <button class="cp-rail__btn" type="button" @click="emit('open-settings')">{{ t("settings_title") }}</button>
    </div>
    <Teleport to="body">
      <div
        v-if="dndMenuOpen"
        class="cp-contextMenu cp-dndMenu"
        :style="{ position: 'fixed', left: `${dndMenuX}px`, top: `${dndMenuY}px`, zIndex: 9999 }"
        @click.stop
      >
        <div class="cp-contextMenu__label">{{ t("server_dnd_toggle") }}</div>
        <button class="cp-contextMenu__item" type="button" :class="{ 'cp-contextMenu__item--active': !props.serverMuted }" @click="onDndToggle">
          {{ props.serverMuted ? t("server_dnd_off") : t("server_dnd_on") }}
        </button>
        <div class="cp-contextMenu__sep" />
        <div class="cp-contextMenu__label">{{ t("mute_for") }}</div>
        <button class="cp-contextMenu__item" type="button" @click="onDndMuteForDuration(MUTE_DURATION_1H)">
          {{ t("mute_for_1h") }}
        </button>
        <button class="cp-contextMenu__item" type="button" @click="onDndMuteForDuration(MUTE_DURATION_8H)">
          {{ t("mute_for_8h") }}
        </button>
        <button class="cp-contextMenu__item" type="button" @click="onDndMuteForDuration(MUTE_DURATION_24H)">
          {{ t("mute_for_24h") }}
        </button>
        <button class="cp-contextMenu__item" type="button" @click="onDndMuteForDuration(MUTE_DURATION_FOREVER)">
          {{ t("mute_for_manual") }}
        </button>
      </div>
      <div v-if="dndMenuOpen" class="cp-contextMenu__backdrop" @click="closeDndMenu" />
    </Teleport>
  </aside>
</template>

<style scoped lang="scss">
.cp-rail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 0 4px;
}

.cp-dndBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  color: var(--cp-text-secondary);
  border-radius: 8px;
  padding: 2px 6px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    background: var(--cp-hover-bg);
  }

  &--active {
    background: var(--cp-accent-soft, rgba(64, 192, 192, 0.18));
    border-color: var(--cp-accent);
    color: var(--cp-accent);
  }
}

.cp-dndBtn__icon {
  font-size: 14px;
  line-height: 1;
}

.cp-dndMenu {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  box-shadow: var(--cp-shadow-float);
  padding: 6px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-contextMenu__item {
  border: none;
  background: transparent;
  color: var(--cp-text);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: var(--cp-hover-bg);
  }

  &--active {
    background: var(--cp-hover-bg);
  }
}

.cp-contextMenu__label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--cp-text-tertiary);
  padding: 6px 12px 2px;
  letter-spacing: 0.5px;
}

.cp-contextMenu__sep {
  height: 1px;
  background: var(--cp-border);
  margin: 4px 8px;
}

.cp-contextMenu__backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.cp-rail__top-actions {
  padding: 12px;
  border-bottom: 1px solid var(--cp-border-light);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
