<script setup lang="ts">
/**
 * @fileoverview SettingPage.vue 文件职责说明。
 */

import { useRouter } from 'vue-router';
import { changeConfig, configRef, ensureConfigLoaded } from '../configFacade';
import SettingInput from '../components/SettingModel/SettingInput.vue';
import SettingSwitch from '../components/SettingModel/SettingSwitch.vue';
import { ref, onMounted, onUnmounted } from 'vue';
import { createLogger } from '@/shared/utils/logger';

const router = useRouter();
const config = configRef;
const logger = createLogger("SettingPage");

// 响应式变量跟踪当前激活的侧边栏项
const activeTab = ref('account');
const contentRef = ref<HTMLElement | null>(null);

// 切换激活的侧边栏项并滚动到对应区域
/**
 * switchTab 方法说明。
 * @param tab - 参数说明。
 * @returns 返回值说明。
 */
const switchTab = (tab: string) => {
    logger.debug("Switch tab", { tab });
    activeTab.value = tab;

    // 滚动到对应区域
    const section = document.getElementById(tab);
    if (section) {
        logger.debug("Scroll to section", { tab });
        section.scrollIntoView({ behavior: 'smooth' });
    } else {
        logger.warn("Section not found", { tab });
    }
};

// 监听内容区域滚动，更新激活的侧边栏项
/**
 * handleScroll 方法说明。
 * @returns 返回值说明。
 */
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
// Channel-level settings are not wired yet (plugin/ext point planned).

/**
 * handleApplicationSettingInputChange 方法说明。
 * @param key - 参数说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
const handleApplicationSettingInputChange = (key:string,value: string) => {
    // 处理application设置输入变化的逻辑
    changeConfig(key, value);
};

/**
 * handleApplicationSettingSwitchChange 方法说明。
 * @param key - 参数说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
const handleApplicationSettingSwitchChange = (key:string,value: boolean) => {
    // 处理application socket设置输入变化的逻辑
    changeConfig(key, value);
};

// 组件挂载时添加滚动事件监听
onMounted(() => {
    void ensureConfigLoaded().catch((e) => {
        logger.error("Failed to load config", { error: String(e) });
    });
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
    <!-- 页面：设置｜职责：展示配置分组，支持侧边栏定位滚动与配置更新 -->
    <!-- 区块：<div> .setting-page -->
    <div class="setting-page">
        <!-- 区块：<div> .back-button -->
        <div class="back-button" @click="router.back()">{{ $t('back') }}</div>
        <!-- 区块：<div> .main-container -->
        <div class="main-container">
            <!-- 区块：<ul> -->
            <!-- 区块：<ul> .side-bar -->
            <ul class="side-bar">
                <!-- 区块：<li> -->
                <!-- 区块：<li> .account -->
                <li class="account" :class="activeTab === 'account' ? 'active' : ''" @click="switchTab('account')">{{ $t('account') }}</li>
                <!-- 区块：<li> -->
                <!-- 区块：<li> .general -->
                <li class="general" :class="activeTab === 'general' ? 'active' : ''" @click="switchTab('general')">{{ $t('general') }}</li>
                <!-- 区块：<li> -->
                <!-- 区块：<li> .security -->
                <li class="security" :class="activeTab === 'security' ? 'active' : ''" @click="switchTab('security')">{{ $t('security') }}</li>
                <!-- 区块：<li> -->
                <!-- 区块：<li> .privacy -->
                <li class="privacy" :class="activeTab === 'privacy' ? 'active' : ''" @click="switchTab('privacy')">{{ $t('privacy') }}</li>
                <!-- 区块：<li> -->
                <!-- 区块：<li> .notifications -->
                <li class="notifications" :class="activeTab === 'notifications' ? 'active' : ''" @click="switchTab('notifications')">{{ $t('notifications') }}</li>
                <!-- 区块：<li> -->
                <!-- 区块：<li> .edit-file -->
                <li class="edit-file" :class="activeTab === 'edit-file' ? 'active' : ''" @click="switchTab('edit-file')">{{ $t('edit_in_file') }}</li>
            </ul>
            <!-- 区块：<div> .content -->
            <div class="content" ref="contentRef">
                <h1 id="account" class="setting-item-title">{{ $t('account') }}</h1>

                <!-- 区块：<div> .setting-section -->
                <div class="setting-section">
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingInput text='username' :placeholder="config.username" :onChange="handleApplicationSettingInputChange"/>
                    </div>
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingInput text='email' :placeholder="config.email" :onChange="handleApplicationSettingInputChange"/>
                    </div>
                </div>

                <h1 id="general" class="setting-item-title">{{ $t('general') }}</h1>
                <!-- 区块：<div> .setting-section -->
                <div class="setting-section">
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='auto_login' :value="config.auto_login" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='close_to_tray' :value="config.close_to_tray" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='check_for_updates' :value="config.check_for_updates" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>

                <h1 id="security" class="setting-item-title">{{ $t('security') }}</h1>
                <!-- 区块：<div> .setting-section -->
                <div class="setting-section">
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='two_factor_auth' :value="config.two_factor_auth" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='password_reset' :value="config.password_reset" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>

                <h1 id="privacy" class="setting-item-title">{{ $t('privacy') }}</h1>
                <!-- 区块：<div> .setting-section -->
                <div class="setting-section">
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='private_messages' :value="config.private_messages" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='profile_visibility' :value="config.profile_visibility" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>

                <h1 id="notifications" class="setting-item-title">{{ $t('notifications') }}</h1>
                <!-- 区块：<div> .setting-section -->
                <div class="setting-section">
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='email_notifications' :value="config.email_notifications" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='desktop_notifications' :value="config.desktop_notifications" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>

                <h1 id="edit-file" class="setting-item-title">{{ $t('edit_in_file') }}</h1>
                <!-- 区块：<div> .setting-section -->
                <div class="setting-section">
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='show_file_extensions' :value="config.show_file_extensions" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                    <!-- 区块：<div> .setting-item -->
                    <div class="setting-item">
                        <SettingSwitch text='auto_save_files' :value="config.auto_save_files" :onChange="handleApplicationSettingSwitchChange"/>
                    </div>
                </div>
            </div>
        </div>
      </div>
</template>
<style scoped lang="scss">
/* 样式：设置页布局（玻璃卡片 + 目录侧栏） */
.setting-page {
  position: relative;
  width: 100%;
  height: 100vh;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  box-sizing: border-box;
}

/* 样式：.back-button */
.back-button {
  position: absolute;
  top: 22px;
  left: 22px;
  font-size: 14px;
  color: var(--cp-text-muted, #737373);
  cursor: pointer;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 253, 248, 0.62);
  border: 1px solid var(--cp-border-light);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition:
    color var(--cp-fast, 160ms) var(--cp-ease, ease),
    transform var(--cp-fast, 160ms) var(--cp-ease, ease),
    background-color var(--cp-fast, 160ms) var(--cp-ease, ease);

  /* 样式：&:hover */
  &:hover {
    color: var(--cp-text, #1a1a1a);
    transform: translateY(-1px);
    background: rgba(255, 253, 248, 0.74);
  }
}

/* 样式：.main-container */
.main-container {
  display: flex;
  width: 100%;
  max-width: 1000px;
  height: 100%;
  max-height: 700px;
  background: rgba(255, 253, 248, 0.58);
  border-radius: 26px;
  box-shadow: var(--cp-shadow);
  border: 1px solid var(--cp-border);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  overflow: hidden;
}

/* 样式：.side-bar */
.side-bar {
  width: 200px;
  background: rgba(20, 32, 29, 0.04);
  border-right: 1px solid var(--cp-border-light);
  list-style-type: none;
  padding: 16px 0;
  margin: 0;
  overflow-y: auto;
}

/* 样式：.side-bar li */
.side-bar li {
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--cp-text-muted, #737373);
  cursor: pointer;
  transition:
    background-color var(--cp-fast, 160ms) var(--cp-ease, ease),
    color var(--cp-fast, 160ms) var(--cp-ease, ease),
    transform var(--cp-fast, 160ms) var(--cp-ease, ease);
  border-left: 4px solid transparent;

  /* 样式：&:hover */
  &:hover {
    background-color: rgba(15, 118, 110, 0.10);
    color: var(--cp-text, #1a1a1a);
    transform: translateY(-1px);
  }

  /* 样式：&.active */
  &.active {
    background:
      linear-gradient(180deg, rgba(15, 118, 110, 0.16), rgba(15, 118, 110, 0.08));
    color: var(--cp-text, #1a1a1a);
    border-left-color: var(--cp-accent);
  }
}

/* 样式：.content */
.content {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
  background: transparent;
}

/* 样式：.setting-item-title */
.setting-item-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--cp-text, #1a1a1a);
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

/* 样式：hr */
hr {
  border: none;
  border-top: 1px solid var(--cp-border, #e5e5e5);
  margin: 16px 0;
}

/* 设置项容器 */
.setting-section {
  background: rgba(255, 253, 248, 0.70);
  border-radius: var(--cp-radius, 14px);
  padding: 14px 16px;
  margin-bottom: 24px;
  border: 1px solid var(--cp-border-light);
  box-shadow: 0 16px 36px rgba(20, 32, 29, 0.08);
}

/* 样式：.setting-section-title */
.setting-section-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--cp-text, #1a1a1a);
  margin-bottom: 12px;
}

/* 样式：.setting-item */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--cp-border-light);

  /* 样式：&:last-child */
  &:last-child {
    border-bottom: none;
  }
}

/* 样式：.setting-item-label */
.setting-item-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--cp-text, #1a1a1a);
}

/* 样式：.setting-item-content */
.setting-item-content {
  display: flex;
  align-items: center;
}
</style>
