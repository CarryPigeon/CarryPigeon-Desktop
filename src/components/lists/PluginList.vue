<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { PluginManifest } from "../../script/service/PluginLoader";
import MenuButton, { type MenuButtonAction } from "../items/MenuButton.vue";
import AboutModal from "../modals/AboutModal.vue";

const props = defineProps<{
    activePluginName?: string | null;
}>();

const emit = defineEmits<{
    (e: "select", plugin: PluginManifest): void;
    (e: "toggle-plugin-loader-panel"): void;
}>();

// 插件列表状态
const plugins = ref<PluginManifest[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// 关于弹窗状态
const aboutModalOpen = ref(false);

// 从后端获取插件
async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
        plugins.value = await invoke<PluginManifest[]>("list_plugins");
    } catch (err) {
        plugins.value = [];
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

// 初始加载
onMounted(() => {
    refresh();
});

const hasPlugins = computed(() => plugins.value.length > 0);

// 获取插件图标的首字母辅助函数
function pluginInitial(name: string): string {
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

// 选择插件
function onSelect(plugin: PluginManifest): void {
    emit("select", plugin);
}

// 处理菜单按钮的操作
function handleMenuAction(action: MenuButtonAction) {
    if (action === "about") {
        aboutModalOpen.value = true;
    }
    // 应要求移除了“插件”操作逻辑
}
</script>

<template>
    <div class="plugin-list">
        <!-- 已加载插件列表 -->
        <div v-if="hasPlugins" class="items">
            <button
                v-for="plugin in plugins"
                :key="plugin.name"
                class="item"
                :class="
                    plugin.name === (props.activePluginName ?? null)
                        ? 'active'
                        : ''
                "
                type="button"
                :title="`${plugin.name} ${plugin.version ?? ''}`"
                @click="onSelect(plugin)"
            >
                <span class="icon">{{ pluginInitial(plugin.name) }}</span>
            </button>
        </div>

        <!-- 带菜单的管理按钮 -->
        <MenuButton
            :loading="loading"
            :error="error"
            @action="handleMenuAction"
        />

        <!-- 模态框 -->
        <AboutModal v-model:open="aboutModalOpen" />
    </div>
</template>

<style scoped lang="scss">
.plugin-list {
    width: 100%;
    padding: 10px 0 0;
    border-top: 1px solid rgba(148, 163, 184, 0.18);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.items {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.item {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(31, 41, 55, 1);
    cursor: pointer;
    padding: 0;
    display: grid;
    place-items: center;
    color: #e5e7eb;
}

.item.active {
    border-color: rgba(59, 130, 246, 0.9);
    background: rgba(59, 130, 246, 0.25);
}

.icon {
    font-weight: 700;
    font-size: 18px;
    line-height: 1;
}
</style>
