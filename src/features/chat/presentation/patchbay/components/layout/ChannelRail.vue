<script setup lang="ts">
/**
 * @fileoverview ChannelRail.vue
 * @description Patchbay 左侧频道栏：服务器上下文、必需插件 gate、频道筛选与列表。
 */

import { computed, reactive } from "vue";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
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
    <!-- 区块：Patch Panel 头（服务器上下文 + gate 状态） -->
    <div class="cp-panelHead">
      <!-- 区块：标题 + 状态徽章 -->
      <div class="cp-panelHead__top">
        <div class="cp-panelHead__name">{{ t("channels") }}</div>
        <div class="cp-panelHead__badges">
          <LabelBadge v-if="props.model.missingRequiredCount > 0" variant="required" :label="t('setup_required_label')" />
          <LabelBadge v-else variant="info" :label="t('ready_label')" />
        </div>
      </div>
      <!-- 区块：服务器标识信息 -->
      <div class="cp-panelHead__socket">
        <MonoTag :value="props.model.socket || 'no-server'" title="server socket" :copyable="true" />
        <MonoTag :value="props.model.serverId || 'missing-server_id'" title="server_id" :copyable="true" />
      </div>
      <!-- 区块：主要动作按钮 -->
      <div class="cp-panelHead__actions">
        <button class="cp-panelHead__btn" type="button" @click="props.model.openPlugins()">{{ t("plugins") }}</button>
        <button v-if="props.model.missingRequiredCount > 0" class="cp-panelHead__btn danger" type="button" @click="props.model.openRequiredSetup()">
          {{ t("required_setup") }}
        </button>
      </div>
    </div>

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

