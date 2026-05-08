<script setup lang="ts">
/**
 * @fileoverview CreateChannelDialog.vue
 * @description chat｜组件：CreateChannelDialog。
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "created", channel: { id: string; name: string }): void;
}>();

const { t } = useI18n();
const roomGovernanceCapabilities = getRoomGovernanceCapabilities();

const channelName = ref("");
const channelBrief = ref("");
const loading = ref(false);
const error = ref("");

/**
 * 关闭弹窗并清理临时状态。
 *
 * @returns 无返回值。
 */
function handleClose(): void {
  emit("update:visible", false);
  channelName.value = "";
  channelBrief.value = "";
  error.value = "";
}

/**
 * 创建频道并在成功后触发事件通知上层。
 *
 * @returns 无返回值。
 */
async function handleCreate(): Promise<void> {
  const name = channelName.value.trim();
  if (!name) {
    error.value = t("channel_name_required");
    return;
  }

  loading.value = true;
  error.value = "";
  try {
    const outcome = await roomGovernanceCapabilities.createChannel(name, channelBrief.value.trim());
    if (!outcome.ok) {
      error.value = outcome.error.message;
      return;
    }
    emit("created", { id: outcome.channel.id, name: outcome.channel.name });
    handleClose();
  } catch (e) {
    error.value = t("channel_create_failed") + ": " + String(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <!-- 组件：CreateChannelDialog｜职责：创建频道弹窗 -->
  <t-dialog :visible="props.visible" :header="t('create_channel')" :footer="false" @close="handleClose">
    <div class="cp-createChannel">
      <div v-if="error" class="cp-createChannel__error">{{ error }}</div>
      <div class="cp-createChannel__field">
        <label class="cp-createChannel__label">{{ t("channel_name") }} *</label>
        <t-input v-model="channelName" :placeholder="t('channel_name')" clearable />
      </div>
      <div class="cp-createChannel__field">
        <label class="cp-createChannel__label">{{ t("channel_brief") }}</label>
        <t-textarea v-model="channelBrief" :placeholder="t('channel_brief_placeholder')" :autosize="{ minRows: 2, maxRows: 4 }" />
      </div>
      <div class="cp-createChannel__actions">
        <button class="cp-createChannel__btn" type="button" @click="handleClose">{{ t("cancel") }}</button>
        <button class="cp-createChannel__btn primary" type="button" :disabled="loading || !channelName.trim()" @click="handleCreate">
          {{ loading ? t("loading") : t("confirm") }}
        </button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped lang="scss">
@use "./create-channel-form";
</style>
