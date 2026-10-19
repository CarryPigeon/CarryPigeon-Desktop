<script setup lang="ts">
/**
 * @fileoverview ServerRail.vue
 * @description Patchbay 左侧服务器栏（Rack 列表 + 快捷入口 + 服务端免打扰）。
 */

import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ContextMenuSurface from "@/shared/ui/contextMenu/ContextMenuSurface.vue";
import ContextMenuItem from "@/shared/ui/contextMenu/ContextMenuItem.vue";
import ContextMenuSeparator from "@/shared/ui/contextMenu/ContextMenuSeparator.vue";
import ContextMenuLabel from "@/shared/ui/contextMenu/ContextMenuLabel.vue";
import {
  MUTE_DURATION_1H,
  MUTE_DURATION_8H,
  MUTE_DURATION_24H,
  MUTE_DURATION_FOREVER,
} from "@/features/chat/presentation/patchbay/view-models/useChannelMuteStore";
import AppIcon from "@/shared/ui/AppIcon.vue";

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

/**
 * 打开服务器免打扰菜单（定位与视口钳制由 `ContextMenuSurface` 统一负责）。
 *
 * @returns 无返回值。
 */
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
        <span class="cp-dndBtn__icon" aria-hidden="true"><AppIcon :name="props.serverMuted ? 'bell-off' : 'notification'" /></span>
      </button>
    </div>
    <div class="cp-rail__top-actions">
      <button class="cp-rail__btn" type="button" @click="emit('open-server-manager')">
        <AppIcon name="usergroup" :size="14" />
        <span class="cp-rail__btnLabel">{{ t("manage") }}</span>
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
      <button class="cp-rail__btn" type="button" @click="emit('open-plugins')">
        <AppIcon name="plug" :size="14" />
        <span class="cp-rail__btnLabel">{{ t("plugins") }}</span>
      </button>
      <button class="cp-rail__btn" type="button" @click="emit('open-settings')">
        <AppIcon name="setting" :size="14" />
        <span class="cp-rail__btnLabel">{{ t("settings_title") }}</span>
      </button>
    </div>
    <ContextMenuSurface
      :open="dndMenuOpen"
      :x="dndMenuX"
      :y="dndMenuY"
      :min-width="200"
      @close="closeDndMenu"
    >
      <ContextMenuLabel>{{ t("server_dnd_toggle") }}</ContextMenuLabel>
      <ContextMenuItem :active="!props.serverMuted" @select="onDndToggle">
        {{ props.serverMuted ? t("server_dnd_off") : t("server_dnd_on") }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuLabel>{{ t("mute_for") }}</ContextMenuLabel>
      <ContextMenuItem @select="onDndMuteForDuration(MUTE_DURATION_1H)">
        {{ t("mute_for_1h") }}
      </ContextMenuItem>
      <ContextMenuItem @select="onDndMuteForDuration(MUTE_DURATION_8H)">
        {{ t("mute_for_8h") }}
      </ContextMenuItem>
      <ContextMenuItem @select="onDndMuteForDuration(MUTE_DURATION_24H)">
        {{ t("mute_for_24h") }}
      </ContextMenuItem>
      <ContextMenuItem @select="onDndMuteForDuration(MUTE_DURATION_FOREVER)">
        {{ t("mute_for_manual") }}
      </ContextMenuItem>
    </ContextMenuSurface>
  </aside>
</template>

<style scoped lang="scss">
/* 样式：ServerRail｜规格：栏头图标按钮 + 顶部操作区行（行列表见全局 patchbay.scss） */
.cp-dndBtn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text-muted);
  border-radius: var(--cp-radius-sm);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);

  &:hover {
    background: var(--cp-hover-bg);
    border-color: var(--cp-border);
    color: var(--cp-text);
  }

  /* 免打扰开启属于「状态」语义，用 accent 而非 highlight */
  &--active {
    background: var(--cp-accent-soft);
    border-color: color-mix(in oklab, var(--cp-accent) 34%, var(--cp-border));
    color: var(--cp-accent);
  }
}

.cp-dndBtn__icon {
  font-size: 14px;
  line-height: 1;
}

.cp-rail__top-actions {
  padding: 4px 6px 2px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* 导航行文案：单行省略，避免长翻译撑破栏宽 */
.cp-rail__btnLabel {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
