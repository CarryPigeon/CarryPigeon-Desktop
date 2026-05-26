<template>
  <Transition name="voice-banner-slide">
    <div v-if="visible" class="voice-call-banner">
      <div class="voice-call-banner__content">
        <t-icon name="call" class="voice-call-banner__icon" />
        <div class="voice-call-banner__info">
          <span class="voice-call-banner__title">{{ t("voice_call_caller_invite", { name: callerName }) }}</span>
        </div>
        <div class="voice-call-banner__actions">
          <button class="voice-call-banner__btn voice-call-banner__btn--accept" @click="$emit('accept')">
            {{ t("voice_call_answer") }}
          </button>
          <button class="voice-call-banner__btn voice-call-banner__btn--reject" @click="$emit('reject')">
            {{ t("voice_call_reject") }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps<{
  callerName: string;
  visible: boolean;
}>();

defineEmits<{
  accept: [];
  reject: [];
}>();
</script>

<style scoped lang="scss">
.voice-call-banner {
  height: 56px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  overflow: hidden;

  &__content {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 16px;
    gap: 12px;
  }

  &__icon {
    font-size: 24px;
    animation: pulse-ring 1.5s ease-in-out infinite;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  &__btn {
    padding: 6px 16px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;

    &:hover { opacity: 0.9; }

    &--accept {
      background: #fff;
      color: #667eea;
    }

    &--reject {
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
    }
  }
}

.voice-banner-slide-enter-active,
.voice-banner-slide-leave-active {
  transition: all 0.3s ease;
}

.voice-banner-slide-enter-from,
.voice-banner-slide-leave-to {
  height: 0;
  opacity: 0;
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
</style>
