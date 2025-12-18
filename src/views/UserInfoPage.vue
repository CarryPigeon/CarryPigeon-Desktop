<script setup lang="ts">
import { useRouter } from 'vue-router';
import SettingInput from '../components/items/SettingModel/SettingInput.vue';
const router = useRouter();

</script>

<template>
    <div class="user-info-page">
        <div class="back-button" @click="router.back()">{{ $t('back') }}</div>
        <div class="main-container">
            <div class="content">
                <h1 class="setting-item-title">{{ $t('user_info') }}</h1>
                <div class="avatar-container">
                    <img class="user_avatar" src="" alt="User Info Image" />
                </div>
                <h2 class="setting-item-subtitle">{{ $t('user_info_description') }}</h2>

                <div class="setting-section">
                    <div class="setting-item">
                        <SettingInput text='username' placeholder="" />
                    </div>
                    <div class="setting-item">
                        <SettingInput text='email' placeholder="" />
                    </div>
                </div>
            </div>
        </div>
      </div>
</template>

<style scoped lang="scss">
.user-info-page {
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

.content {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.setting-item-title {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 32px;
}

.setting-item-subtitle {
  font-size: 18px;
  font-weight: 500;
  color: #6b7280;
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
  width: 100%;
  max-width: 650px;
}

.avatar-container {
  margin-bottom: 32px;
}

.user_avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background-color: #e5e7eb;
  margin-bottom: 16px;
  object-fit: cover;
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
