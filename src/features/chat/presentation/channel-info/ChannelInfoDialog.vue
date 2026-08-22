<script setup lang="ts">
/**
 * @fileoverview ChannelInfoDialog.vue
 * @description chat｜组件：频道信息应用内弹窗（频道列表 ⓘ 入口，替代全屏页跳转）。
 *
 * 复用 `useChannelInfoPage` 编排（展示/加入/资料编辑），通过 `channelOverride`
 * 注入频道来源，不再依赖 route query。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";
import { useChannelInfoPage } from "./useChannelInfoPage";

const props = defineProps<{
  /** 弹窗可见性。 */
  visible: boolean;
  /** 目标频道 id。 */
  channelId: string;
  /** 频道显示名（可选，缺省时回落到目录数据）。 */
  channelName?: string;
  /** 频道简介（可选）。 */
  channelBrief?: string;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
}>();

const { t } = useI18n();

// 仅在弹窗打开时提供频道来源；关闭后置空，让内部编排自行复位编辑态。
const sourceOverride = computed(() => {
  if (!props.visible || !props.channelId) return null;
  return { id: props.channelId, name: props.channelName, brief: props.channelBrief };
});

const {
  channelId,
  channelName,
  channelBrief,
  channelAnnouncement,
  membershipStatus,
  isEditing,
  isEditingAnnouncement,
  isRequestingJoin,
  isSavingMeta,
  isSavingAnnouncement,
  actionError,
  draftChannelName,
  draftChannelBrief,
  draftChannelAnnouncement,
  hasChannel,
  joinRequested,
  canRequestJoin,
  mayEditChannelMeta,
  beginEdit,
  cancelEdit,
  saveEdit,
  changeAnnouncement,
  cancelAnnouncementEdit,
  saveAnnouncement,
  handleJoin,
  openInPatchbay,
} = useChannelInfoPage({ channelOverride: sourceOverride });

const membershipStatusText = computed(() =>
  membershipStatus.value === "joined" ? t("membership_joined") : t("membership_not_joined"),
);

function handleClose(): void {
  emit("update:visible", false);
}

/** 进入频道会话并关闭弹窗（弹窗场景下无需保留停留）。 */
async function handleOpenInChat(): Promise<void> {
  await openInPatchbay();
  handleClose();
}
</script>

<template>
  <!-- 组件：ChannelInfoDialog｜职责：频道信息小弹窗（展示/加入/编辑） -->
  <t-dialog
    :visible="props.visible"
    :header="hasChannel ? channelName : t('channel_info')"
    :footer="false"
    width="480px"
    attach="body"
    destroy-on-close
    :close-on-overlay-click="!isEditing && !isEditingAnnouncement"
    @update:visible="(value: boolean) => !value && handleClose()"
    @close="handleClose"
  >
    <ErrorBoundary>
      <div class="cp-infoDialog">
        <div class="cp-infoDialog__row">
          <span class="cp-infoDialog__k">{{ t("channel_id_label") }}</span>
          <MonoTag :value="channelId || '—'" :copyable="true" />
        </div>

        <div class="cp-infoDialog__section">
          <div class="cp-infoDialog__k">{{ t("membership_label") }}</div>
          <div class="cp-infoDialog__actions">
            <span class="cp-infoDialog__pill" :data-ok="membershipStatus === 'joined'">{{ membershipStatusText }}</span>
            <button
              v-if="canRequestJoin"
              class="cp-infoDialog__btn primary"
              type="button"
              :disabled="joinRequested || isRequestingJoin"
              @click="handleJoin"
            >
              {{ joinRequested ? t("channel_join_request_sent") : isRequestingJoin ? t("loading") : t("apply_join") }}
            </button>
            <button
              v-if="mayEditChannelMeta && !isEditing"
              class="cp-infoDialog__btn"
              type="button"
              @click="beginEdit"
            >
              {{ t("edit") }}
            </button>
          </div>
        </div>

        <div class="cp-infoDialog__section">
          <template v-if="!isEditing">
            <div class="cp-infoDialog__k">{{ t("channel_brief") }}</div>
            <div class="cp-infoDialog__text">{{ channelBrief || t("channel_brief_placeholder") }}</div>
          </template>
          <template v-else>
            <div class="cp-infoDialog__field">
              <div class="cp-infoDialog__k">{{ t("edit_name_label") }}</div>
              <t-input v-model="draftChannelName" clearable />
            </div>
            <div class="cp-infoDialog__field">
              <div class="cp-infoDialog__k">{{ t("edit_brief_label") }}</div>
              <t-textarea v-model="draftChannelBrief" :autosize="{ minRows: 2, maxRows: 5 }" />
            </div>
            <div class="cp-infoDialog__actions">
              <button class="cp-infoDialog__btn primary" type="button" :disabled="isSavingMeta" @click="saveEdit">
                {{ isSavingMeta ? t("loading") : t("save") }}
              </button>
              <button class="cp-infoDialog__btn" type="button" :disabled="isSavingMeta" @click="cancelEdit">
                {{ t("cancel") }}
              </button>
            </div>
          </template>
        </div>

        <div v-if="channelAnnouncement || mayEditChannelMeta" class="cp-infoDialog__section">
          <template v-if="!isEditingAnnouncement">
            <div class="cp-infoDialog__k">{{ t("channel_announcement") }}</div>
            <div class="cp-infoDialog__text">{{ channelAnnouncement || "—" }}</div>
            <div v-if="mayEditChannelMeta" class="cp-infoDialog__actions">
              <button class="cp-infoDialog__btn" type="button" @click="changeAnnouncement">
                {{ t("edit") }}
              </button>
            </div>
          </template>
          <template v-else>
            <div class="cp-infoDialog__field">
              <div class="cp-infoDialog__k">{{ t("channel_announcement") }}</div>
              <t-textarea v-model="draftChannelAnnouncement" :autosize="{ minRows: 2, maxRows: 5 }" />
            </div>
            <div class="cp-infoDialog__actions">
              <button
                class="cp-infoDialog__btn primary"
                type="button"
                :disabled="isSavingAnnouncement"
                @click="saveAnnouncement"
              >
                {{ isSavingAnnouncement ? t("loading") : t("save") }}
              </button>
              <button class="cp-infoDialog__btn" type="button" :disabled="isSavingAnnouncement" @click="cancelAnnouncementEdit">
                {{ t("cancel") }}
              </button>
            </div>
          </template>
        </div>

        <div v-if="actionError" class="cp-infoDialog__error" role="alert">{{ actionError }}</div>

        <div v-if="hasChannel && membershipStatus === 'joined'" class="cp-infoDialog__actions end">
          <button class="cp-infoDialog__btn primary" type="button" @click="handleOpenInChat">
            {{ t("open_channel_in_chat") }}
          </button>
        </div>
      </div>
    </ErrorBoundary>
  </t-dialog>
</template>

<style scoped lang="scss">
.cp-infoDialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cp-infoDialog__k {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cp-text-muted);
}

.cp-infoDialog__row {
  display: flex;
  align-items: center;
  gap: 10px;

  .cp-infoDialog__k {
    margin-right: 0;
  }
}

.cp-infoDialog__section {
  border-top: 1px solid var(--cp-border-light);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-infoDialog__text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--cp-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.cp-infoDialog__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  &.end {
    justify-content: flex-end;
  }
}

.cp-infoDialog__pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-family: var(--cp-font-mono);

  &[data-ok="true"] {
    border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
    background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel-muted));
    color: var(--cp-text);
  }
}

.cp-infoDialog__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    opacity var(--cp-fast) var(--cp-ease);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: var(--cp-highlight-border);
  }

  &.primary {
    border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
    background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
}

.cp-infoDialog__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-infoDialog__error {
  font-size: 12px;
  color: var(--cp-danger, #b3261e);
}
</style>
