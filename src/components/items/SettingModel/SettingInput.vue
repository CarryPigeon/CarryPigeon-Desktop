<script setup lang="ts">
import { Input, InputProps } from 'tdesign-vue-next';

const props = defineProps<{
  text: string;
  placeholder: string;
  onChange?: InputProps['onChange'];
}>();

</script>

<template>
  <div class="setting-item-content">
    <div class="setting-item-content-item-title">{{ $t(props.text) }}
      <Input class="setting-item-content-item-value" :placeholder="props.placeholder" @change="props.onChange" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.setting-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.setting-item-content-item-title {
  flex: 1;
  display: flex;
  align-items: center;
}
.setting-item-content-item-value {
  width: 30%;
  margin-left: auto;
  text-align: right;
}
</style>