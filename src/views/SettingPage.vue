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
        <div class="main-container">
            <ul class="side-bar">
                <li class="account active">{{ $t('account') }}</li>
                <li class="security">{{ $t('security') }}</li>
                <li class="privacy">{{ $t('privacy') }}</li>
                <li class="notifications">{{ $t('notifications') }}</li>
                <li class="edit-file">{{ $t('edit_in_file') }}</li>
            </ul>
            <div class="content">
                <h1 class="setting-item-title">{{ $t('account') }}</h1>
                
                <div class="setting-section">
                    <div class="setting-item">
                        <SettingInput text='username' :placeholder="config.username" />
                    </div>
                    <div class="setting-item">
                        <SettingInput text='email' :placeholder="config.email" />
                    </div>
                </div>
                
                <div class="setting-section">
                    <h2 class="setting-section-title">{{ $t('general') }}</h2>
                    <div class="setting-item">
                        <SettingSwitch text='auto_login' :value="config.auto_login" />
                    </div>
                    <div class="setting-item">
                        <SettingSwitch text='close_to_tray' :value="config.close_to_tray" />
                    </div>
                    <div class="setting-item">
                        <SettingSwitch text='check_for_updates' :value="config.check_for_updates" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.setting-page {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.back-button {
  position: absolute;
  top: 92%;
  left: 35px;
  font-size: 16px;
  color: #3B82F6;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s ease;
  
  &:hover {
    color: #2563EB;
  }
}

.main-container {
  display: flex;
  width: 100%;
  max-width: 1200px;
  height: 100%;
  max-height: 800px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.side-bar {
  width: 250px;
  background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
  border-right: 1px solid #e5e7eb;
  list-style-type: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
}

.side-bar li {
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
  
  &:hover {
    background-color: #e5e7eb;
    color: #374151;
  }
  
  &.active {
    background-color: white;
    color: #3B82F6;
    border-left-color: #3B82F6;
    box-shadow: inset 4px 0 0 #3B82F6;
  }
}

.content {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  background: white;
}

.setting-item-title {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 32px;
}

hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 16px 0;
}

/* 设置项容器 */
.setting-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.setting-section-title {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #f3f4f6;
  
  &:last-child {
    border-bottom: none;
  }
}

.setting-item-label {
  font-size: 16px;
  font-weight: 500;
  color: #374151;
}

.setting-item-content {
  display: flex;
  align-items: center;
}
</style>