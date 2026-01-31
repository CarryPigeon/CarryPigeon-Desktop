<script setup lang="ts">
/**
 * @fileoverview AboutModal.vue 文件职责说明。
 */

import { getVersion } from "@tauri-apps/api/app";
import { onMounted, ref } from "vue";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("AboutModal");

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: "update:open", value: boolean): void;
}>();

const appVersion = ref("0.0.0");

// 组件挂载时从 Tauri 后端获取应用版本
onMounted(async () => {
    try {
        appVersion.value = await getVersion();
    } catch (e) {
        logger.error("Failed to get app version", { error: String(e) });
    }
});

/**
 * close 方法说明。
 * @returns 返回值说明。
 */
function close() {
    emit("update:open", false);
}
</script>

<template>
    <!-- 组件：AboutModal｜职责：应用关于弹窗；数据：从 Tauri 获取版本号 -->
    <Teleport to="body">
        <!-- 区块：<div> .modal-overlay -->
        <div v-if="props.open" class="modal-overlay" @click.self="close">
            <!-- 区块：<div> .modal-content -->
            <div class="modal-content">
                <!-- 区块：<button> -->
                <button class="close-btn" @click="close">&times;</button>

                <!-- 区块：<div> .logo-container -->
                <div class="logo-container">
                    <img src="/tauri.svg" alt="App Logo" class="app-logo" />
                </div>

                <h2 class="app-name">CarryPigeon Desktop</h2>
                <p class="version">Version {{ appVersion }}</p>

                <!-- 区块：<div> .footer -->
                <div class="footer">
                    <p>Copyleft © 2024 - 2025 CarryPigeon Team</p>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped lang="scss">
/* 样式：居中 Modal（遮罩 + 内容卡片）- 简洁白色风格 */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 20000;
}

/* 样式：.modal-content */
.modal-content {
    background: var(--cp-panel, #ffffff);
    border-radius: var(--cp-radius-lg, 8px);
    padding: 32px;
    width: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--cp-border, #e5e5e5);
}

/* 样式：.close-btn */
.close-btn {
    position: absolute;
    top: 12px;
    right: 16px;
    background: none;
    border: none;
    font-size: 20px;
    color: var(--cp-text-muted, #737373);
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: color 0.15s ease;

    /* 样式：&:hover */
    &:hover {
        color: var(--cp-text, #1a1a1a);
    }
}

/* 样式：.logo-container */
.logo-container {
    margin-bottom: 20px;
}

/* 样式：.app-logo */
.app-logo {
    width: 64px;
    height: 64px;
}

/* 样式：.app-name */
.app-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--cp-text, #1a1a1a);
    margin: 0 0 8px;
}

/* 样式：.version */
.version {
    font-size: 14px;
    color: var(--cp-text-muted, #737373);
    margin: 0 0 20px;
}

/* 样式：.footer */
.footer {
    font-size: 12px;
    color: var(--cp-text-light, #a3a3a3);
    text-align: center;
}
</style>
