<script setup lang="ts">
/**
 * @fileoverview CreateFriendPrivateChatDialog.vue
 * @description chat｜组件：创建好友私聊弹窗。
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "created", friend: { name: string; message: string }): void;
}>();

const { t } = useI18n();
const friendName = ref("");
const privateMessage = ref("");
const error = ref("");

function handleClose(): void {
  emit("update:visible", false);
  friendName.value = "";
  privateMessage.value = "";
  error.value = "";
}

function handleCreate(): void {
  const name = friendName.value.trim();
  if (!name) {
    error.value = t("friend_name_required");
    return;
  }

  emit("created", { name, message: privateMessage.value.trim() });
  handleClose();
}
</script>

<template>
  <!-- 组件：CreateFriendPrivateChatDialog｜职责：创建好友私聊弹窗 -->
  <t-dialog :visible="props.visible" :header="t('create_friend_private_chat')" :footer="false" @close="handleClose">
    <div class="cp-createChannel">
      <div v-if="error" class="cp-createChannel__error">{{ error }}</div>
      <div class="cp-createChannel__field">
        <label class="cp-createChannel__label">{{ t("friend_name") }} *</label>
        <t-input v-model="friendName" :placeholder="t('friend_name_placeholder')" clearable />
      </div>
      <div class="cp-createChannel__field">
        <label class="cp-createChannel__label">{{ t("private_chat_message") }}</label>
        <t-textarea v-model="privateMessage" :placeholder="t('private_chat_message_placeholder')" :autosize="{ minRows: 2, maxRows: 4 }" />
      </div>
      <div class="cp-createChannel__actions">
        <button class="cp-createChannel__btn" type="button" @click="handleClose">{{ t("cancel") }}</button>
        <button class="cp-createChannel__btn primary" type="button" :disabled="!friendName.trim()" @click="handleCreate">
          {{ t("confirm") }}
        </button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped lang="scss">
@use "./create-channel-form";
</style>
