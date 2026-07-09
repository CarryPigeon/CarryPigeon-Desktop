<script setup lang="ts">
/**
 * @fileoverview ChannelRail.vue
 * @description Patchbay 左侧频道栏：服务器上下文、必需插件 gate、频道筛选与列表。
 */

import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import CategoryGroupHeader from "@/features/chat/presentation/patchbay/components/rails/CategoryGroupHeader.vue";
import type { ChannelRailModel } from "@/features/chat/presentation/patchbay/view-models/useChannelRailModel";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";

const props = defineProps<{
  model: ChannelRailModel;
}>();

const emit = defineEmits<{
  "channel-context-menu": [e: MouseEvent, channelId: string];
}>();

const { t } = useI18n();

const serverMenuOpen = ref(false);
const serverMenuAnchor = ref<HTMLElement | null>(null);

const serverMenuX = computed(() => {
  const el = serverMenuAnchor.value;
  if (!el) return 0;
  return el.getBoundingClientRect().right;
});
const serverMenuY = computed(() => {
  const el = serverMenuAnchor.value;
  if (!el) return 0;
  return el.getBoundingClientRect().bottom + 4;
});

function openServerMenu(): void {
  serverMenuOpen.value = true;
}

function handleMenu(action: () => void): void {
  serverMenuOpen.value = false;
  action();
}

/**
 * 频道分类分组。
 */
type ChannelGroup = {
  id: string;
  name: string;
  channels: ChannelSummary[];
};

/**
 * 按 categoryId 对频道列表分组。空 categoryId 归入 "uncategorized"。
 * 组内按 order 排序，组间按首个频道的 order 排序。
 */
const channelGroups = computed(() => {
  const groups = new Map<string, ChannelGroup>();
  const uncategorizedId = "__uncategorized__";

  for (const c of props.model.channels) {
    const gid = c.categoryId || uncategorizedId;
    let group = groups.get(gid);
    if (!group) {
      group = {
        id: gid,
        name: c.categoryName || (gid === uncategorizedId ? t("channels_uncategorized") : gid),
        channels: [],
      };
      groups.set(gid, group);
    }
    group.channels.push(c);
  }

  // 组内按 order 排序
  for (const group of groups.values()) {
    group.channels.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });
  }

  // 转为数组，组间按首个频道的 order 排序
  return Array.from(groups.values()).sort((a, b) => {
    const firstA = a.channels[0]?.order ?? Number.MAX_SAFE_INTEGER;
    const firstB = b.channels[0]?.order ?? Number.MAX_SAFE_INTEGER;
    return firstA - firstB;
  });
});

const collapsedGroups = reactive(new Set<string>());

function toggleGroup(groupId: string): void {
  if (collapsedGroups.has(groupId)) {
    collapsedGroups.delete(groupId);
  } else {
    collapsedGroups.add(groupId);
  }
}

function onChannelContextMenu(e: MouseEvent, channelId: string): void {
  emit("channel-context-menu", e, channelId);
}
</script>

<template>
  <!-- 组件：ChannelRail｜职责：频道栏（Patch Panel + 频道筛选 + 列表） -->
  <!-- 区块：<aside> .cp-rail--channels -->
  <aside class="cp-rail cp-rail--channels">
    <!-- 区块：服务器信息卡 -->
    <div class="cp-serverCard" @click="props.model.openServerInfo">
      <AvatarBadge
        class="cp-serverCard__avatar"
        :name="props.model.serverInfo?.name ?? '—'"
        :avatar-url="props.model.serverInfo?.avatar"
        :size="40"
      />
      <div class="cp-serverCard__meta">
        <div class="cp-serverCard__name">{{ props.model.serverInfo?.name ?? '—' }}</div>
        <div class="cp-serverCard__brief">{{ props.model.serverInfo?.brief || t('server_info_no_brief') }}</div>
        <div class="cp-serverCard__socket">
          <MonoTag :value="props.model.socket || 'no-server'" title="server socket" :copyable="true" />
        </div>
      </div>
      <button
        ref="serverMenuAnchor"
        class="cp-serverCard__menuBtn"
        type="button"
        :aria-label="t('more_actions')"
        @click.stop="openServerMenu"
      >
        <t-icon name="more" />
      </button>
    </div>

    <!-- 服务器菜单 -->
    <Teleport to="body">
      <div
        v-if="serverMenuOpen"
        class="cp-contextMenu cp-serverMenu"
        :style="{ position: 'fixed', left: `${serverMenuX}px`, top: `${serverMenuY}px`, zIndex: 9999 }"
        @click.stop
      >
        <button class="cp-contextMenu__item" type="button" @click="handleMenu(props.model.openPlugins)">
          {{ t('server_info_menu_plugins') }}
        </button>
        <button
          v-if="props.model.missingRequiredCount > 0"
          class="cp-contextMenu__item danger"
          type="button"
          @click="handleMenu(props.model.openRequiredSetup)"
        >
          {{ t('server_info_menu_required_setup') }}
        </button>
        <button class="cp-contextMenu__item" type="button" @click="handleMenu(props.model.openServerManager)">
          {{ t('server_info_menu_server_manager') }}
        </button>
        <button class="cp-contextMenu__item" type="button" @click="handleMenu(props.model.openFileManager)">
          {{ t('server_info_menu_file_manager') }}
        </button>
        <button class="cp-contextMenu__item" type="button" @click="handleMenu(props.model.openSettings)">
          {{ t('server_info_menu_settings') }}
        </button>
      </div>
      <div v-if="serverMenuOpen" class="cp-contextMenu__backdrop" @click="serverMenuOpen = false" />
    </Teleport>

    <!-- 区块：频道搜索 + 已加入/发现 Tab -->
    <div class="cp-channelSearch">
      <!-- 区块：Tabs（joined/discover） -->
      <div class="cp-channelTabs">
        <button class="cp-channelTabs__btn" type="button" :data-active="props.model.channelTab === 'joined'" @click="props.model.setChannelTab('joined')">
          {{ t("channels_joined") }}
        </button>
        <button class="cp-channelTabs__btn" type="button" :data-active="props.model.channelTab === 'discover'" @click="props.model.setChannelTab('discover')">
          {{ t("channels_discover") }}
        </button>
        <button class="cp-channelTabs__btn add" type="button" @click="props.model.openCreateMenu($event)" :title="t('create_chat')">+</button>
      </div>
      <!-- 区块：搜索输入框 -->
      <t-input :model-value="props.model.channelSearch" :placeholder="t('channel_search_placeholder')" :aria-label="t('channel_search_placeholder')" clearable @update:model-value="props.model.setChannelSearch" />
    </div>

    <!-- 区块：频道列表（joined/discover） -->
    <div class="cp-channelList" role="listbox" aria-label="channels">
      <!-- 区块：空状态 -->
      <div v-if="props.model.channels.length === 0" class="cp-channelEmpty">
        {{ props.model.channelTab === "joined" ? t("channels_joined_empty") : t("channels_discover_empty") }}
      </div>

      <!-- 区块：分类分组列表 -->
      <template v-else>
        <template v-for="group in channelGroups" :key="group.id">
          <!-- 区块：分组标题（仅 joined 视图显示分组） -->
          <CategoryGroupHeader
            v-if="group.id !== '__uncategorized__' || group.channels.length > 0"
            :group-id="group.id"
            :name="group.name"
            :count="group.channels.length"
            :collapsed="collapsedGroups.has(group.id)"
            :is-uncategorized="group.id === '__uncategorized__'"
            @toggle="toggleGroup"
          />

          <!-- 区块：组内频道行列表 -->
          <template v-for="c in group.channels" :key="c.id">
            <article
              v-if="!collapsedGroups.has(group.id)"
              class="cp-channelRow"
              :data-active="c.id === props.model.currentChannelId"
              @contextmenu.prevent="onChannelContextMenu($event, c.id)"
            >
              <!-- 区块：频道主入口（未加入时禁用） -->
              <button
                class="cp-channelRow__main"
                type="button"
                :disabled="!c.joined"
                :aria-label="`${c.name}${c.joined && c.unread > 0 ? `, ${c.unread} ${t('unread')}` : ''}${!c.joined ? `, ${t('channels_not_joined')}` : ''}`"
                @click="props.model.selectChannel(c.id)"
              >
                <span class="cp-channel__port" aria-hidden="true"></span>
                <span class="cp-channelRow__meta">
                  <span class="cp-channel__name">
                    {{ c.name }}
                    <span v-if="props.model.isChannelMuted(c.id)" class="cp-channel__muted-icon" title="muted">🔇</span>
                  </span>
                  <span class="cp-channelRow__brief">{{ c.brief }}</span>
                </span>
                <span v-if="props.model.hasDraft(c.id)" class="cp-channel__draft-indicator" :title="t('draft')">&#x270E;</span>
              </button>

              <!-- 区块：右侧动作（未读/加入/信息） -->
              <div class="cp-channelRow__right">
                <span v-if="c.joined && c.unread > 0" class="cp-channel__unread">{{ c.unread }}</span>
                <button
                  v-else-if="!c.joined"
                  class="cp-channelRow__join"
                  type="button"
                  :disabled="c.joinRequested"
                  @click="props.model.applyJoin(c.id)"
                >
                  {{ c.joinRequested ? t("channel_join_request_sent") : t("apply_join") }}
                </button>
                <button class="cp-channelRow__info" type="button" @click="props.model.openChannelInfo(c.id)">{{ t("channel_info") }}</button>
              </div>
            </article>
          </template>
        </template>
      </template>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.cp-serverCard {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-bottom: 1px solid var(--cp-border-light);
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);
}
.cp-serverCard:hover {
  background: var(--cp-hover-bg);
}
.cp-serverCard__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cp-serverCard__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cp-serverCard__brief {
  font-size: 12px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cp-serverCard__socket {
  margin-top: 2px;
}
.cp-serverCard__menuBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  color: var(--cp-text-muted);
  border-radius: 10px;
  width: 28px;
  height: 28px;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease), color var(--cp-fast) var(--cp-ease);
}
.cp-serverCard__menuBtn:hover {
  background: var(--cp-hover-bg);
  color: var(--cp-text);
}
.cp-serverMenu {
  min-width: 180px;
}
</style>

