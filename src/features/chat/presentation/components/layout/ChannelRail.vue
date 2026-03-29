<script setup lang="ts">
/**
 * @fileoverview ChannelRail.vue
 * @description Patchbay 左侧频道栏：服务器上下文、必需插件 gate、频道筛选与列表。
 */

import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import type { ChannelRailModel } from "@/features/chat/presentation/composables/useChannelRailModel";

const props = defineProps<{
  model: ChannelRailModel;
}>();

const { t } = useI18n();
</script>

<template>
  <!-- 组件：ChannelRail｜职责：频道栏（Patch Panel + 频道筛选 + 列表） -->
  <!-- 区块：<aside> .cp-rail--channels -->
  <aside class="cp-rail cp-rail--channels">
    <!-- 区块：Patch Panel 头（服务器上下文 + gate 状态） -->
    <div class="cp-panelHead">
      <!-- 区块：标题 + 状态徽章 -->
      <div class="cp-panelHead__top">
        <div class="cp-panelHead__name">Channels</div>
        <div class="cp-panelHead__badges">
          <LabelBadge v-if="props.model.missingRequiredCount > 0" variant="required" label="SETUP REQUIRED" />
          <LabelBadge v-else variant="info" label="READY" />
        </div>
      </div>
      <!-- 区块：服务器标识信息 -->
      <div class="cp-panelHead__socket">
        <MonoTag :value="props.model.socket || 'no-server'" title="server socket" :copyable="true" />
        <MonoTag :value="props.model.serverId || 'missing-server_id'" title="server_id" :copyable="true" />
      </div>
      <!-- 区块：主要动作按钮 -->
      <div class="cp-panelHead__actions">
        <button class="cp-panelHead__btn" type="button" @click="props.model.openPlugins()">Plugins</button>
        <button v-if="props.model.missingRequiredCount > 0" class="cp-panelHead__btn danger" type="button" @click="props.model.openRequiredSetup()">
          Required Setup
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
        <button class="cp-channelTabs__btn add" type="button" @click="props.model.openCreateChannel()" :title="t('create_channel')">+</button>
      </div>
      <!-- 区块：搜索输入框 -->
      <t-input :model-value="props.model.channelSearch" :placeholder="t('channel_search_placeholder')" clearable @update:model-value="props.model.setChannelSearch" />
    </div>

    <!-- 区块：频道列表（joined/discover） -->
    <div class="cp-channelList" role="listbox" aria-label="channels">
      <!-- 区块：空状态 -->
      <div v-if="props.model.channels.length === 0" class="cp-channelEmpty">
        {{ props.model.channelTab === "joined" ? t("channels_joined_empty") : t("channels_discover_empty") }}
      </div>
      <!-- 区块：频道行列表 -->
      <article v-for="c in props.model.channels" v-else :key="c.id" class="cp-channelRow" :data-active="c.id === props.model.currentChannelId">
        <!-- 区块：频道主入口（未加入时禁用） -->
        <button
          class="cp-channelRow__main"
          type="button"
          :disabled="!c.joined"
          @click="props.model.selectChannel(c.id)"
        >
          <span class="cp-channel__port" aria-hidden="true"></span>
          <span class="cp-channelRow__meta">
            <span class="cp-channel__name">{{ c.name }}</span>
            <span class="cp-channelRow__brief">{{ c.brief }}</span>
          </span>
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
    </div>
  </aside>
</template>
