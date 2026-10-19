<script setup lang="ts">
/**
 * @fileoverview DeleteChannelDialog.vue
 * @description chat｜组件：DeleteChannelDialog。
 */

import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getRoomGovernanceCapabilities } from "@/features/chat/room-governance/api";

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
const roomGovernanceCapabilities = getRoomGovernanceCapabilities();

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
    const outcome = await roomGovernanceCapabilities.forChannel(props.channelId).deleteChannel();
    if (!outcome.ok) {
      error.value = outcome.error.message;
      return;
    }
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
/* 样式：DeleteChannelDialog｜规格：状态条 + 字段标签 + 胶囊按钮 */
.cp-deleteChannel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 确认警示：统一内联状态条（warn） */
.cp-deleteChannel__warn {
  @include cp-inline-status(warn);
}

/* 错误提示：统一内联状态条（danger） */
.cp-deleteChannel__error {
  @include cp-inline-status(danger);
}

.cp-deleteChannel__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cp-deleteChannel__label {
  font-size: 12px;
  line-height: 1.4;
  color: var(--cp-text-muted);
}

.cp-deleteChannel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 动作按钮：胶囊按钮；危险操作使用 danger tone */
.cp-deleteChannel__btn {
  @include cp-pill-button;

  &.danger {
    @include cp-pill-button(danger);
  }
}
</style>
