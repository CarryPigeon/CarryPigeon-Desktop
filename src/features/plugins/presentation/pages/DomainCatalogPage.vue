<script setup lang="ts">
/**
 * @fileoverview DomainCatalogPage.vue
 * @description plugins｜页面：DomainCatalogPage。
 *
 * PRD 映射：
 * - PRD 6.4 Domain Catalog：展示 domains/versions/providers/contract 指针。
 *
 * API 映射：
 * - `GET /api/domains/catalog` (`docs/api/11-HTTP端点清单（v1，标准版）.md`)
 */

import { computed, onMounted, ref, watch, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";
import BackButton from "@/shared/ui/BackButton.vue";
import { usePluginsServerWorkspace } from "@/features/plugins/integration/serverWorkspace";
import { createDomainCatalogContext } from "@/features/plugins/presentation/composables/useDomainCatalogContext";
import { debounce } from "@/shared/utils/rateLimit";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';

const router = useRouter();
const { t } = useI18n();
const q = ref("");
const debouncedQ = ref("");

const updateDebouncedQ = debounce((val: string) => {
  debouncedQ.value = val;
}, 200);

watch(q, (val) => {
  updateDebouncedQ(val);
});

onBeforeUnmount(() => {
  updateDebouncedQ.cancel();
});

const { socket, serverId, refreshServerInfo } = usePluginsServerWorkspace();
const { domainCatalogStore, refreshDomainCatalog } = createDomainCatalogContext(socket);

/**
 * 刷新 server info 与 domain catalog（best-effort）。
 *
 * @returns 无返回值。
 */
async function refresh(): Promise<void> {
  await Promise.all([refreshServerInfo(), refreshDomainCatalog()]);
}

/**
 * 根据搜索关键字计算过滤后的 domain 列表。
 *
 * @returns 过滤后的列表。
 */
function computeFiltered() {
  const needle = debouncedQ.value.trim().toLowerCase();
  const items = domainCatalogStore.value.items.value;
  if (!needle) return items;
  return items.filter((it) => String(it.domain ?? "").toLowerCase().includes(needle));
}

const filtered = computed(computeFiltered);

onMounted(() => {
  void refresh();
});
</script>

<template>
  <!-- 页面：DomainCatalogPage｜职责：Domain Catalog（providers/constraints/contract）展示与复制 -->
  <main class="cp-domains">
    <ErrorBoundary>
      <header class="cp-domains__head">
        <BackButton test-id="domain-catalog-back" @click="router.back()" />
        <div class="cp-domains__title">
          <div class="cp-domains__name">{{ t("domain_catalog") }}</div>
          <div class="cp-domains__sub">{{ t("domain_catalog_sub") }}</div>
        </div>
        <div class="cp-domains__meta">
          <MonoTag :value="socket || 'no-server'" title="server socket" :copyable="true" />
          <MonoTag :value="serverId || 'missing-server_id'" title="server_id" :copyable="true" />
        </div>
      </header>

      <section class="cp-domains__controls">
        <div class="cp-domains__field">
          <div class="cp-domains__label">{{ t("domain_search_label") }}</div>
          <t-input v-model="q" :placeholder="t('domain_search_placeholder')" clearable />
        </div>
        <div class="cp-domains__actions">
          <button class="cp-domains__btn" type="button" @click="refresh">{{ t("domain_refresh") }}</button>
          <button class="cp-domains__btn" type="button" @click="$router.push('/plugins')">{{ t("plugin_center") }}</button>
        </div>
      </section>

      <div v-if="socket && !serverId" class="cp-domains__state warn" v-text="t('domain_missing_id')"></div>

      <div v-if="domainCatalogStore.loading.value" class="cp-domains__state">{{ t("domain_loading") }}</div>
      <div v-else-if="domainCatalogStore.error.value" class="cp-domains__state err">{{ domainCatalogStore.error.value }}</div>

      <section v-else class="cp-domains__list">
        <div v-if="filtered.length === 0" class="cp-domains__state">{{ t("domain_no_items") }}</div>

        <article v-for="it in filtered" :key="it.domain" class="cp-domainCard">
          <div class="cp-domainCard__top">
            <div class="cp-domainCard__domain">{{ it.domain }}</div>
            <div class="cp-domainCard__versions">
              <span class="cp-domainCard__pill">recommended: {{ it.recommendedVersion || "—" }}</span>
              <span class="cp-domainCard__pill">supported: {{ (it.supportedVersions || []).length }}</span>
            </div>
          </div>

          <div class="cp-domainCard__grid">
            <div class="cp-domainCard__kv">
              <div class="cp-domainCard__k">constraints</div>
              <div class="cp-domainCard__v">
                <span class="cp-domainCard__mono">max_payload_bytes={{ it.constraints?.maxPayloadBytes ?? "—" }}</span>
                <span class="cp-domainCard__mono">max_depth={{ it.constraints?.maxDepth ?? "—" }}</span>
              </div>
            </div>

            <div class="cp-domainCard__kv">
              <div class="cp-domainCard__k">providers</div>
              <div class="cp-domainCard__v">
                <template v-if="(it.providers || []).length === 0">—</template>
                <div v-for="(p, idx) in it.providers || []" :key="`${it.domain}-${idx}`" class="cp-domainCard__provider">
                  <span class="cp-domainCard__pill">{{ p.type }}</span>
                  <span v-if="p.type === 'plugin'" class="cp-domainCard__mono">
                    {{ p.pluginId }} (min {{ p.minPluginVersion || "—" }})
                  </span>
                </div>
              </div>
            </div>

            <div class="cp-domainCard__kv wide">
              <div class="cp-domainCard__k">contract</div>
              <div class="cp-domainCard__v">
                <div v-if="it.contract?.schemaUrl" class="cp-domainCard__contract">
                  <MonoTag :value="it.contract.schemaUrl" title="schema_url" :copyable="true" />
                  <span class="cp-domainCard__mono">sha256={{ it.contract.sha256 || "—" }}</span>
                </div>
                <div v-else class="cp-domainCard__muted">—</div>
              </div>
            </div>
          </div>
        </article>
      </section>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* 样式：Domain Catalog 页｜布局：PageHeader 风格头部 + 玻璃控制条 + 玻璃列表 + 内嵌分组卡 */
.cp-domains {
  @include cp-page;
}

/* 头部：一级玻璃面板 */
.cp-domains__head {
  @include cp-glass-panel;

  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: var(--cp-page-pad);
}

.cp-domains__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: 0.06em;
  color: var(--cp-text);
}

.cp-domains__sub {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-domains__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
}

/* 控制条：搜索字段 + 操作胶囊 */
.cp-domains__controls {
  @include cp-glass-panel;

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 12px;
  padding: 14px;
}

.cp-domains__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.cp-domains__label {
  @include cp-section-label;
}

.cp-domains__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.cp-domains__btn {
  @include cp-pill-button;
}

/* 状态条：默认内嵌卡、warn/danger 用状态 token */
.cp-domains__state {
  @include cp-card;

  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-domains__state.err {
  border-color: var(--cp-danger-border);
  background: var(--cp-danger-bg);
  color: var(--cp-danger);
}

.cp-domains__state.warn {
  border-color: var(--cp-warn-border);
  background: var(--cp-warn-bg);
  color: var(--cp-text);
}

/* 列表面板：一级玻璃 + 内部滚动 */
.cp-domains__list {
  @include cp-glass-panel;

  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

/* domain 卡片：内嵌分组卡（无阴影） */
.cp-domainCard {
  @include cp-card;

  padding: 14px;
}

.cp-domainCard__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cp-domainCard__domain {
  font-family: var(--cp-font-display);
  font-weight: 900;
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--cp-text);
}

.cp-domainCard__versions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.cp-domainCard__pill {
  padding: 4px 10px;
  border: 1px solid var(--cp-border-light);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  font-family: var(--cp-font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-domainCard__grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cp-domainCard__kv {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
}

.cp-domainCard__kv.wide {
  grid-column: 1 / -1;
}

.cp-domainCard__k {
  @include cp-section-label;

  font-size: 11px;
}

.cp-domainCard__v {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  color: var(--cp-text);
}

.cp-domainCard__mono {
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--cp-text-muted);
  overflow-wrap: anywhere;
}

.cp-domainCard__provider {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.cp-domainCard__contract {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cp-domainCard__muted {
  color: var(--cp-text-muted);
}

/* 响应式：窄窗口单列 */
@media (max-width: 900px) {
  .cp-domains__controls {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }

  .cp-domainCard__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .cp-domainCard__kv.wide {
    grid-column: auto;
  }
}

@media (max-width: 640px) {
  .cp-domains {
    padding: 10px;
    gap: 10px;
  }
}
</style>
