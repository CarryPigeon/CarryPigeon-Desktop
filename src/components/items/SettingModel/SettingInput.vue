<script setup lang="ts">
import { Input, InputProps } from 'tdesign-vue-next';

const props = defineProps<{
  text: string;
  placeholder: string;
  channel_socket?: string;
  onChange?: (key:string,value:string) => void;
}>();

const onChange: InputProps['onChange'] = (value) => {
  props.onChange?.(props.text, value.toString());
};

</script>

<template>
  <div class="setting-item-content">
    <div class="setting-item-content-item-title">{{ $t(props.text) }}</div>
    <Input class="setting-item-content-item-value" :placeholder="props.placeholder" @change="onChange" />
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
  width: 30%;
  text-align: left;
}
</style>