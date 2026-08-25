<script setup lang="ts">
/**
 * @fileoverview CreateFriendPrivateChatDialog.vue
 * @description chat｜按好友 UID 查找公开资料，再 POST /api/channels 创建私有频道。
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { getAccountCapabilities } from "@/features/account/api";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { isSnowflakeId } from "@/shared/utils/snowflakeId";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "created", channel: { id: string; name: string }): void;
}>();

const { t } = useI18n();
const friendUid = ref("");
const privateMessage = ref("");
const error = ref("");
const loading = ref(false);

function handleClose(): void {
  emit("update:visible", false);
  friendUid.value = "";
  privateMessage.value = "";
  error.value = "";
}

async function handleCreate(): Promise<void> {
  const uid = friendUid.value.trim();
  if (!isSnowflakeId(uid)) {
    error.value = t("friend_uid_required");
    return;
  }

  loading.value = true;
  error.value = "";
  try {
    const socket = getActiveChatServerSocket().trim();
    const token = socket ? (await ensureValidAccessToken(socket)).trim() : "";
    if (!socket || !token) {
      error.value = t("channel_create_failed");
      return;
    }
    const profile = await getAccountCapabilities().forServer(socket).getUser(token, uid);
    const channelName = String(profile.nickname ?? "").trim() || uid;
    const brief = privateMessage.value.trim() || `Direct chat with ${channelName}`;
    const outcome = await getRoomGovernanceCapabilities().createChannel(channelName, brief);
    if (!outcome.ok) {
      error.value = outcome.error.message;
      return;
    }
    emit("created", { id: outcome.channel.id, name: outcome.channel.name });
    handleClose();
  } catch (e) {
    error.value = t("friend_lookup_failed") + ": " + String(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <!-- 组件：CreateFriendPrivateChatDialog｜职责：按 UID 查找用户并创建私有频道 -->
  <t-dialog :visible="props.visible" :header="t('create_friend_private_chat')" :footer="false" @close="handleClose">
    <div class="cp-createChannel">
      <div v-if="error" class="cp-createChannel__error">{{ error }}</div>
      <p class="cp-createChannel__hint">{{ t("private_chat_create_hint") }}</p>
      <div class="cp-createChannel__field">
        <label class="cp-createChannel__label">{{ t("friend_uid") }} *</label>
        <t-input v-model="friendUid" :placeholder="t('friend_uid_placeholder')" clearable />
      </div>
      <div class="cp-createChannel__field">
        <label class="cp-createChannel__label">{{ t("private_chat_message") }}</label>
        <t-textarea v-model="privateMessage" :placeholder="t('private_chat_message_placeholder')" :autosize="{ minRows: 2, maxRows: 4 }" />
      </div>
      <div class="cp-createChannel__actions">
        <button class="cp-createChannel__btn" type="button" @click="handleClose">{{ t("cancel") }}</button>
        <button class="cp-createChannel__btn primary" type="button" :disabled="loading || !friendUid.trim()" @click="handleCreate">
          {{ loading ? t("loading") : t("confirm") }}
        </button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped lang="scss">
@use "./create-channel-form";

.cp-createChannel__hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.5;
}
</style>
