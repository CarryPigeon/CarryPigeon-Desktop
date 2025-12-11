<script setup lang="ts">
import { useRouter } from 'vue-router';
import { changeConfig, Config } from '../script/config/Config';
import SettingInput from '../components/items/SettingModel/SettingInput.vue';
import SettingSwitch from '../components/items/SettingModel/SettingSwitch.vue';
import { ref, onMounted, onUnmounted } from 'vue';

const router = useRouter();
let config = Config;

// 响应式变量跟踪当前激活的侧边栏项
const activeTab = ref('account');
const contentRef = ref<HTMLElement | null>(null);

// 切换激活的侧边栏项并滚动到对应区域
const switchTab = (tab: string) => {
    console.log(`Switching to tab: ${tab}`);
    activeTab.value = tab;

    // 滚动到对应区域
    const section = document.getElementById(tab);
    if (section) {
        console.log(`Scrolling to section: ${tab}`);
        section.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn(`Section with id '${tab}' not found`);
    }
};

// 监听内容区域滚动，更新激活的侧边栏项
const handleScroll = () => {
    if (!contentRef.value) return;

    // 获取所有section元素
    const sections = ['account', 'general', 'security', 'privacy', 'notifications', 'edit-file'];
    let currentActiveSection = 'account';
    let maxVisibleArea = 0;

    // 获取content容器的可见区域
    const contentRect = contentRef.value.getBoundingClientRect();
    const contentTop = contentRect.top;
    const contentBottom = contentRect.bottom;

    // 计算每个section的可见区域大小，找出可见区域最大的section作为当前激活项
    for (const sectionId of sections) {
        const section = document.getElementById(sectionId);
        if (section) {
            const rect = section.getBoundingClientRect();

            // 计算section与content容器的重叠区域
            const overlapTop = Math.max(contentTop, rect.top);
            const overlapBottom = Math.min(contentBottom, rect.bottom);
            const overlapHeight = Math.max(0, overlapBottom - overlapTop);

            // 如果该section的可见区域更大，则更新当前激活项
            if (overlapHeight > maxVisibleArea) {
                maxVisibleArea = overlapHeight;
                currentActiveSection = sectionId;
            }
        }
    }

    // 更新激活状态
    if (currentActiveSection !== activeTab.value) {
        activeTab.value = currentActiveSection;
    }
};
/*
const handleChannelSettingInputChange = (server_socket:string, key:string ,value: string) => {
    // 处理channel设置输入变化的逻辑
    config[server_socket][key] = value;
};
*/

/*
const handleChannelSettingSwitchChange = (server_socket:string, key:string,value: boolean) => {
    // 处理channel socket设置输入变化的逻辑
    config[server_socket][key] = value;
};
*/

const handleApplicationSettingInputChange = (key:string,value: string) => {
    // 处理application设置输入变化的逻辑
    changeConfig(key, value);
};

const handleApplicationSettingSwitchChange = (key:string,value: boolean) => {
    // 处理application socket设置输入变化的逻辑
    changeConfig(key, value);
};

// 组件挂载时添加滚动事件监听
onMounted(() => {
    if (contentRef.value) {
        contentRef.value.addEventListener('scroll', handleScroll);
        // 初始加载时检查一次
        handleScroll();
    }
});

// 组件卸载时移除滚动事件监听
onUnmounted(() => {
    if (contentRef.value) {
        contentRef.value.removeEventListener('scroll', handleScroll);
    }
});
</script>

<template>
    <div class="setting-page">
        <div class="back-button" @click="router.back()">{{ $t('back') }}</div>
        <div class="main-container">
            <ul class="side-bar">
                <li class="account" :class="activeTab === 'account' ? 'active' : ''" @click="switchTab('account')">{{ $t('account') }}</li>
                <li class="general" :class="activeTab === 'general' ? 'active' : ''" @click="switchTab('general')">{{ $t('general') }}</li>
                <li class="security" :class="activeTab === 'security' ? 'active' : ''" @click="switchTab('security')">{{ $t('security') }}</li>
                <li class="privacy" :class="activeTab === 'privacy' ? 'active' : ''" @click="switchTab('privacy')">{{ $t('privacy') }}</li>
                <li class="notifications" :class="activeTab === 'notifications' ? 'active' : ''" @click="switchTab('notifications')">{{ $t('notifications') }}</li>
                <li class="edit-file" :class="activeTab === 'edit-file' ? 'active' : ''" @click="switchTab('edit-file')">{{ $t('edit_in_file') }}</li>
            </ul>
            <div class="content" ref="contentRef">
                <h1 id="account" class="setting-item-title">{{ $t('account') }}</h1>

                <div class="setting-section">
                    <div class="setting-item">
                        <SettingInput text='username' :placeholder="config.username" :onChange="handleApplicationSettingInputChange"/>
                    </div>
                    <div class="setting-item">
                        <SettingInput text='email' :placeholder="config.email" :onChange="handleApplicationSettingInputChange"/>
                    </div>
                </div>

                <h1 id="general" class="setting-item-title">{{ $t('general') }}</h1>
                <div class="setting-section">
                    <div class="setting-item">
                        <SettingSwitch text='auto_login' :value="config.auto_login" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <div class="setting-item">
                        <SettingSwitch text='close_to_tray' :value="config.close_to_tray" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <div class="setting-item">
                        <SettingSwitch text='check_for_updates' :value="config.check_for_updates" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>

                <h1 id="security" class="setting-item-title">{{ $t('security') }}</h1>
                <div class="setting-section">
                    <div class="setting-item">
                        <SettingSwitch text='two_factor_auth' :value="config.two_factor_auth" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <div class="setting-item">
                        <SettingSwitch text='password_reset' :value="config.password_reset" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>

                <h1 id="privacy" class="setting-item-title">{{ $t('privacy') }}</h1>
                <div class="setting-section">
                    <div class="setting-item">
                        <SettingSwitch text='private_messages' :value="config.private_messages" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <div class="setting-item">
                        <SettingSwitch text='profile_visibility' :value="config.profile_visibility" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>

                <h1 id="notifications" class="setting-item-title">{{ $t('notifications') }}</h1>
                <div class="setting-section">
                    <div class="setting-item">
                        <SettingSwitch text='email_notifications' :value="config.email_notifications" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <div class="setting-item">
                        <SettingSwitch text='desktop_notifications' :value="config.desktop_notifications" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>

                <h1 id="edit-file" class="setting-item-title">{{ $t('edit_in_file') }}</h1>
                <div class="setting-section">
                    <div class="setting-item">
                        <SettingSwitch text='show_file_extensions' :value="config.show_file_extensions" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <div class="setting-item">
                        <SettingSwitch text='auto_save_files' :value="config.auto_save_files" :onChange="handleApplicationSettingSwitchChange"/>
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
