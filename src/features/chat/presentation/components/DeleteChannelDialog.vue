<script setup lang="ts">
/**
 * @fileoverview DeleteChannelDialog.vue
 * @description chat｜组件：DeleteChannelDialog。
 */

import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { deleteChannel } from "@/features/chat/presentation/store/chatStore";

const props = defineProps<{
  visible: boolean;
  channelId: string;
  channelName: string;
}>();

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "deleted"): void;
}>();

const { t } = useI18n();

const confirmName = ref("");
const loading = ref(false);
const error = ref("");

const canDelete = computed(() => confirmName.value.trim() === props.channelName.trim());

/**
 * 关闭弹窗并清理临时状态。
 *
 * @returns 无返回值。
 */
function handleClose(): void {
  emit("update:visible", false);
  confirmName.value = "";
  error.value = "";
}

/**
 * 当确认文本匹配时执行删除操作。
 *
 * @returns 无返回值。
 */
async function handleDelete(): Promise<void> {
  if (!canDelete.value) return;

  loading.value = true;
  error.value = "";
  try {
    await deleteChannel(props.channelId);
    emit("deleted");
    handleClose();
  } catch (e) {
    error.value = t("channel_delete_failed") + ": " + String(e);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.visible,
  (v) => {
    if (!v) {
      confirmName.value = "";
      error.value = "";
    }
  },
);
</script>

<template>
  <!-- 组件：DeleteChannelDialog｜职责：删除频道确认弹窗 -->
  <t-dialog :visible="props.visible" :header="t('delete_channel')" :footer="false" @close="handleClose">
    <div class="cp-deleteChannel">
      <div class="cp-deleteChannel__warn">
        {{ t("delete_channel_confirm", { name: props.channelName }) }}
      </div>
      <div v-if="error" class="cp-deleteChannel__error">{{ error }}</div>
      <div class="cp-deleteChannel__field">
        <label class="cp-deleteChannel__label">{{ t("type_channel_name_to_confirm") }}</label>
        <t-input v-model="confirmName" :placeholder="props.channelName" clearable />
      </div>
      <div class="cp-deleteChannel__actions">
        <button class="cp-deleteChannel__btn" type="button" @click="handleClose">{{ t("cancel") }}</button>
        <button class="cp-deleteChannel__btn danger" type="button" :disabled="loading || !canDelete" @click="handleDelete">
          {{ loading ? t("loading") : t("delete_channel") }}
        </button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped lang="scss">
/* DeleteChannelDialog styles */
.cp-deleteChannel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cp-deleteChannel__warn {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in oklab, var(--cp-warn) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-warn) 10%, var(--cp-panel));
  font-size: 13px;
  color: var(--cp-text);
  line-height: 1.5;
}

.cp-deleteChannel__error {
  padding: 10px;
  border-radius: 12px;
  border: 1px dashed color-mix(in oklab, var(--cp-danger) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
  font-size: 12px;
  color: var(--cp-danger);
}

.cp-deleteChannel__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-deleteChannel__label {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-deleteChannel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cp-deleteChannel__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-deleteChannel__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-deleteChannel__btn.danger {
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 14%, var(--cp-panel-muted));
}

.cp-deleteChannel__btn.danger:hover {
  background: color-mix(in oklab, var(--cp-danger) 22%, var(--cp-hover-bg));
}

.cp-deleteChannel__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
