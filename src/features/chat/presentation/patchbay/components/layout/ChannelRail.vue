<script setup lang="ts">
/**
 * @fileoverview ChannelRail.vue
 * @description Patchbay 左侧频道栏：服务器上下文、必需插件 gate、频道筛选与列表。
 */

import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import ContextMenuSurface from "@/shared/ui/contextMenu/ContextMenuSurface.vue";
import ContextMenuItem from "@/shared/ui/contextMenu/ContextMenuItem.vue";
import CategoryGroupHeader from "@/features/chat/presentation/patchbay/components/rails/CategoryGroupHeader.vue";
import type { ChannelRailModel } from "@/features/chat/presentation/patchbay/view-models/useChannelRailModel";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";
import AppIcon from "@/shared/ui/AppIcon.vue";

const props = defineProps<{
  model: ChannelRailModel;
}>();

const emit = defineEmits<{
  "channel-context-menu": [e: MouseEvent, channelId: string];
}>();

const { t } = useI18n();

const serverMenuOpen = ref(false);
const serverMenuAnchor = ref<HTMLElement | null>(null);

/**
 * 服务器菜单锚点坐标：定位与视口钳制由 `ContextMenuSurface` 统一负责。
 */
const serverMenuX = computed(() => serverMenuAnchor.value?.getBoundingClientRect().right ?? 0);
const serverMenuY = computed(() => (serverMenuAnchor.value?.getBoundingClientRect().bottom ?? 0) + 4);

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

/** 置顶频道伪分组 ID。 */
const PINNED_GROUP_ID = "__pinned__";

/** 当前服务器下的置顶频道（按本机 JSON 中的顺序）。 */
const pinnedChannels = computed<ChannelSummary[]>(() => {
  if (props.model.channelTab !== "joined") return [];
  const byId = new Map(props.model.channels.map((c) => [c.id, c]));
  return props.model.pinnedChannelIds
    .map((id) => byId.get(id))
    .filter((c): c is ChannelSummary => c != null);
});

const pinnedIdSet = computed(() => new Set(pinnedChannels.value.map((c) => c.id)));

/**
 * 按 categoryId 对频道列表分组。空 categoryId 归入 "uncategorized"。
 * 置顶频道单独置顶展示，不再参与分类分组。
 */
const channelGroups = computed(() => {
  const groups = new Map<string, ChannelGroup>();
  const uncategorizedId = "__uncategorized__";
  const excluded = pinnedIdSet.value;

  for (const c of props.model.channels) {
    if (excluded.has(c.id)) continue;
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
  const sorted = Array.from(groups.values()).sort((a, b) => {
    const firstA = a.channels[0]?.order ?? Number.MAX_SAFE_INTEGER;
    const firstB = b.channels[0]?.order ?? Number.MAX_SAFE_INTEGER;
    return firstA - firstB;
  });

  // 置顶分组始终排在最前（组内保持本机 JSON 的置顶顺序）。
  if (pinnedChannels.value.length > 0) {
    sorted.unshift({
      id: PINNED_GROUP_ID,
      name: t("channel_pinned_group"),
      channels: pinnedChannels.value,
    });
  }
  return sorted;
});

/** 服务端频道摘要不含 category_*；无真实分类时扁平展示。 */
const hasServerCategories = computed(() =>
  props.model.channels.some((c) => Boolean(c.categoryId)),
);

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

onMounted(() => {
  props.model.setChannelTab("joined");
});
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
        :size="32"
      />
      <div class="cp-serverCard__meta">
        <div class="cp-serverCard__name">{{ props.model.serverInfo?.name ?? '—' }}</div>
        <div class="cp-serverCard__brief">{{ props.model.serverInfo?.brief || t('server_info_no_brief') }}</div>
      </div>
      <button
        ref="serverMenuAnchor"
        class="cp-serverCard__menuBtn"
        type="button"
        :aria-label="t('more_actions')"
        @click.stop="openServerMenu"
      >
        <AppIcon name="more" />
      </button>
    </div>

    <!-- 服务器菜单 -->
    <ContextMenuSurface
      :open="serverMenuOpen"
      :x="serverMenuX"
      :y="serverMenuY"
      :min-width="200"
      :aria-label="t('more_actions')"
      @close="serverMenuOpen = false"
    >
      <ContextMenuItem @select="handleMenu(props.model.openPlugins)">
        {{ t('server_info_menu_plugins') }}
      </ContextMenuItem>
      <ContextMenuItem
        v-if="props.model.missingRequiredCount > 0"
        danger
        @select="handleMenu(props.model.openRequiredSetup)"
      >
        {{ t('server_info_menu_required_setup') }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleMenu(props.model.openServerManager)">
        {{ t('server_info_menu_server_manager') }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleMenu(props.model.openFileManager)">
        {{ t('server_info_menu_file_manager') }}
      </ContextMenuItem>
      <ContextMenuItem @select="handleMenu(props.model.openSettings)">
        {{ t('server_info_menu_settings') }}
      </ContextMenuItem>
      <ContextMenuItem
        :disabled="!props.model.socket"
        @select="handleMenu(props.model.openPinnedChannelsEditor)"
      >
        {{ t('server_info_menu_edit_pinned_channels') }}
      </ContextMenuItem>
    </ContextMenuSurface>

    <!-- 区块：频道搜索 + 已加入/发现 Tab -->
    <div class="cp-channelSearch">
      <!-- 区块：Tabs（joined/discover） -->
      <div class="cp-channelTabs">
        <button
          class="cp-channelTabs__btn"
          type="button"
          :data-active="props.model.channelTab === 'joined'"
          @click="props.model.setChannelTab('joined')"
        >
          {{ t("channels_joined") }}
        </button>
        <button
          class="cp-channelTabs__btn"
          type="button"
          :data-active="props.model.channelTab === 'discover'"
          @click="props.model.setChannelTab('discover')"
        >
          {{ t("channels_discover") }}
        </button>
        <button
          class="cp-channelTabs__btn add"
          type="button"
          :title="t('create_channel')"
          :aria-label="t('create_channel')"
          @click="props.model.openCreateMenu()"
        >
          <AppIcon name="plus" :size="16" />
        </button>
      </div>
      <!-- 区块：搜索输入框 -->
      <t-input
        :model-value="props.model.channelSearch"
        :placeholder="props.model.channelTab === 'discover' ? t('channel_discover_search_placeholder') : t('channel_search_placeholder')"
        :aria-label="props.model.channelTab === 'discover' ? t('channel_discover_search_placeholder') : t('channel_search_placeholder')"
        clearable
        @update:model-value="props.model.setChannelSearch"
      />
      <select
        v-if="props.model.channelTab === 'discover'"
        class="cp-channelSearch__type"
        :value="props.model.discoverType"
        :aria-label="t('channel_discover_type')"
        @change="props.model.setDiscoverType(($event.target as HTMLSelectElement).value)"
      >
        <option value="">{{ t("channel_discover_type_all") }}</option>
        <option value="public">{{ t("channel_discover_type_public") }}</option>
        <option value="private">{{ t("channel_discover_type_private") }}</option>
        <option value="system">{{ t("channel_discover_type_system") }}</option>
      </select>
    </div>

    <!-- 区块：频道列表（joined/discover） -->
    <div class="cp-channelList" role="listbox" aria-label="channels">
      <!-- 区块：空状态 -->
      <div v-if="props.model.channelTab === 'discover' && props.model.discoverLoading && props.model.channels.length === 0" class="cp-channelEmpty">
        {{ t("loading") }}
      </div>
      <div v-else-if="props.model.channelTab === 'discover' && props.model.discoverError && props.model.channels.length === 0" class="cp-channelEmpty">
        {{ props.model.discoverError }}
      </div>
      <div v-else-if="props.model.channels.length === 0" class="cp-channelEmpty">
        {{ props.model.channelTab === "joined" ? t("channels_joined_empty") : t("channels_discover_empty") }}
      </div>

      <!-- 区块：分类分组列表 -->
      <template v-else>
        <template v-for="group in channelGroups" :key="group.id">
          <!-- 区块：分组标题（仅 joined 视图显示分组） -->
          <CategoryGroupHeader
            v-if="hasServerCategories || group.id === '__pinned__'"
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
              :data-pinned="group.id === '__pinned__'"
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
                <span
                  class="cp-channel__port"
                  aria-hidden="true"
                  :style="{ '--cp-channel-port': c.channelType === 'system' ? 'var(--cp-warn)' : 'var(--cp-highlight)' }"
                ></span>
                <span class="cp-channelRow__meta">
                  <span class="cp-channel__name">
                    {{ c.name }}
                    <span v-if="group.id === '__pinned__'" class="cp-channel__pin-icon" :title="t('channel_pinned')"><AppIcon name="pin" /></span>
                    <span v-if="props.model.isChannelMuted(c.id)" class="cp-channel__muted-icon" title="muted"><AppIcon name="bell-off" /></span>
                  </span>
                  <span class="cp-channelRow__brief">{{ c.brief }}</span>
                  <span v-if="c.memberCount != null" class="cp-channelRow__count">{{ t("channel_member_count", { n: c.memberCount }) }}</span>
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
                <button
                  class="cp-channelRow__info"
                  type="button"
                  :title="t('channel_info')"
                  :aria-label="t('channel_info')"
                  @click.stop="props.model.openChannelInfo(c.id)"
                >
                  <AppIcon name="info-circle" />
                </button>
              </div>
            </article>
          </template>
        </template>
      </template>
      <button
        v-if="props.model.channelTab === 'discover' && props.model.discoverHasMore"
        class="cp-channelList__more"
        type="button"
        :disabled="props.model.discoverLoading"
        @click="props.model.loadMoreDiscover()"
      >
        {{ props.model.discoverLoading ? t("loading") : t("load_more") }}
      </button>
    </div>
  </aside>
</template>

<style scoped lang="scss">
/* 样式：ChannelRail｜规格：服务器卡（紧凑页头语言）+ 搜索区 + 列表行（行列表见全局 patchbay.scss） */
.cp-serverCard {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
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
  gap: 2px;
}

.cp-serverCard__name {
  font-family: var(--cp-font-display);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: 0.02em;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-serverCard__brief {
  font-size: 12px;
  line-height: 1.4;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 服务器菜单：设置页图标按钮（静态透明，仅 hover 给反馈） */
.cp-serverCard__menuBtn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text-muted);
  border-radius: var(--cp-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-serverCard__menuBtn:hover {
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
  color: var(--cp-text);
}

.cp-channelRow__count {
  display: block;
  margin-top: 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--cp-text-light);
}

/* 加载更多：设置页胶囊按钮 */
.cp-channelList__more {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  font-size: 12.5px;
  line-height: 1.4;
  cursor: pointer;
  align-self: center;
  margin: 2px 0 4px;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-channelList__more:hover:not(:disabled) {
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-channelList__more:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 频道搜索框：栏内紧凑字段（全局 38px → 32px） */
.cp-channelSearch :deep(.t-input) {
  height: 32px;
  font-size: 12.5px;
}

/* 发现频道类型：原生下拉，对齐字段 token */
.cp-channelSearch__type {
  margin-top: 6px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--cp-field-border);
  background: var(--cp-field-bg);
  color: var(--cp-text);
  border-radius: var(--cp-radius-sm);
  font-size: 12px;
  line-height: 1.4;
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease);
}

.cp-channelSearch__type:focus {
  border-color: var(--cp-focus-border);
  box-shadow: var(--cp-focus-ring, var(--cp-ring));
  outline: none;
}
</style>

