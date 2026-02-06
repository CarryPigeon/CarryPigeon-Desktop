<script setup lang="ts">
/**
 * @fileoverview CreateChannelDialog.vue
 * @description chat｜组件：CreateChannelDialog。
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { createChannel } from "@/features/chat/presentation/store/chatStore";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "created", channel: { id: string; name: string }): void;
}>();

const { t } = useI18n();

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
    const channel = await createChannel(name, channelBrief.value.trim());
    emit("created", { id: channel.id, name: channel.name });
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
/* CreateChannelDialog styles */
.cp-createChannel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cp-createChannel__error {
  padding: 10px;
  border-radius: 12px;
  border: 1px dashed color-mix(in oklab, var(--cp-danger) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
  font-size: 12px;
  color: var(--cp-danger);
}

.cp-createChannel__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-createChannel__label {
  font-size: 12px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-createChannel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cp-createChannel__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-createChannel__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-createChannel__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
}

.cp-createChannel__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
