<script setup lang="ts">
import { Switch, SwitchProps } from 'tdesign-vue-next';
import { ref } from 'vue';

const props = defineProps<{
  text: string;
  value: boolean;
  onChange?: SwitchProps['onChange'];
}>();

const value = ref(props.value);


</script>

<template>
  <div class="setting-item-content">
    <div class="setting-item-content-item-title">{{ $t(props.text) }}
      <Switch class="setting-item-content-item-switch" v-model="value" @change="props.onChange" />
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
.setting-item-content-item-switch {
  margin-left: auto;
  text-align: right;
}
</style>