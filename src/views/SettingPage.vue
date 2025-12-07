<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Config } from '../script/config/Config';
import SettingInput from '../components/items/SettingModel/SettingInput.vue';
import SettingSwitch from '../components/items/SettingModel/SettingSwitch.vue';

const router = useRouter();
const config = Config;

</script>

<template>
    <div class="setting-page">
        <div class="back-button" @click="router.back()">{{ $t('back') }}</div>
        <ul class="side-bar">
            <li class="account">{{ $t('account') }}</li>
            <li class="security">{{ $t('security') }}</li>
            <li class="privacy">{{ $t('privacy') }}</li>
            <li class="notifications">{{ $t('notifications') }}</li>
            <li class="edit-file">{{ $t('edit_in_file') }}</li>
        </ul>
        <div class="content">
            <h1 class="setting-item-title">{{ $t('account') }}</h1>
            <hr />
                <SettingInput text='username' :placeholder="config.username" />
                <hr />
                <SettingInput text='email' :placeholder="config.email" />
                <hr />
                <SettingSwitch text='auto_login' :value="config.auto_login" />
                <hr />
                <SettingSwitch text='close_to_tray' :value="config.close_to_tray" />
                <hr />
                <SettingSwitch text='check_for_updates' :value="config.check_for_updates" />
                <hr />
            </div>
    </div>
</template>

<style scoped lang="scss">
.side-bar {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  list-style-type: none;
}

.side-bar li {
  padding: 15px 30px;
  font-size: 18px;
  cursor: pointer;
  &:hover {
    background-color: #f0f0f0;
  }
}
.back-button {
  position: fixed;
  top: 20px;
  left: 20px;
  font-size: 16px;
  color: #007BFF;
  cursor: pointer;
}
.content {
  position: fixed;
  left: 20%;
  top: 10%;
  width: 60%;
  height: 80%;
  background-color: transparent;
  overflow-y: auto;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.setting-item-content-item-value {
  position: fixed;
  left: 59%;
  width: 20%;
}
</style>