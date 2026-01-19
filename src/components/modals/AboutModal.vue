<script setup lang="ts">
import { getVersion } from "@tauri-apps/api/app";
import { onMounted, ref } from "vue";

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    (e: "update:open", value: boolean): void;
}>();

const appVersion = ref("0.1.0");

// 组件挂载时从 Tauri 后端获取应用版本
onMounted(async () => {
    try {
        appVersion.value = await getVersion();
    } catch (e) {
        console.error("Failed to get app version", e);
    }
});

function close() {
    emit("update:open", false);
}
</script>

<template>
    <Teleport to="body">
        <div v-if="props.open" class="modal-overlay" @click.self="close">
            <div class="modal-content">
                <button class="close-btn" @click="close">&times;</button>

                <div class="logo-container">
                    <img src="/tauri.svg" alt="App Logo" class="app-logo" />
                </div>

                <h2 class="app-name">CarryPigeon Desktop</h2>
                <p class="version">Version {{ appVersion }}</p>

                <div class="footer">
                    <p>Copyleft © 2024 - 2025 CarryPigeon Team</p>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 20000;
}

.modal-content {
    background: white;
    border-radius: 12px;
    padding: 30px;
    width: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    animation: popIn 0.2s ease-out;
}

@keyframes popIn {
    from {
        transform: scale(0.95);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

.close-btn {
    position: absolute;
    top: 10px;
    right: 15px;
    background: none;
    border: none;
    font-size: 24px;
    color: #666;
    cursor: pointer;
    padding: 0;
    line-height: 1;

    &:hover {
        color: #000;
    }
}

.logo-container {
    margin-bottom: 20px;
}

.app-logo {
    width: 80px;
    height: 80px;
}

.app-name {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 10px;
}

.version {
    font-size: 14px;
    color: #6b7280;
    margin: 0 0 20px;
}

.footer {
    font-size: 12px;
    color: #9ca3af;
    text-align: center;
}
</style>
