<script setup lang="ts">
import { Button } from 'tdesign-vue-next';

enum SettingButtonTheme {
  DEFAULT = 'default',
  PRIMARY = 'primary',
  WARNING = 'warning',
  DANGER = 'danger',
  SUCCESS = 'success',
}

const props = defineProps<{
  text: string;
  theme: SettingButtonTheme;
  placeholder: string;
}>();

</script>

<template>
  <div class="setting-item-content">
    <div class="setting-item-content-item-title">{{ $t(props.text) }}</div>
    <Button class="setting-item-content-item-value" :theme="props.theme">
      {{ $t(props.placeholder) }}
    </Button>
  </div>
</template>

<style scoped lang="scss">
.setting-item-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
}

.setting-item-content-item-title {
  width: 70%;
  display: flex;
  align-items: center;
}

.setting-item-content-item-value {
    width: 20%;
    left: 5%;
    top: 10px;
    text-align: left;
}
</style>