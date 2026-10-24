<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import PageHeader from "@/shared/ui/PageHeader.vue";
import PanelGroup from "@/shared/ui/panel/PanelGroup.vue";
import PanelRow from "@/shared/ui/panel/PanelRow.vue";
import AppIcon from "@/shared/ui/AppIcon.vue";
import { createLogger } from "@/shared/utils/logger";
import { getAboutCapabilities } from "../../api";
import type { AppInfo } from "../../api-types";

const logger = createLogger("AboutPage");
const { t } = useI18n();
const router = useRouter();

const appInfo = ref<AppInfo | null>(null);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    const caps = getAboutCapabilities();
    appInfo.value = await caps.getAppInfo();
  } catch (e) {
    error.value = t("load_failed");
    logger.error("Action: api_about_load_failed", { error: String(e) });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="cp-about">
    <PageHeader
      :title="t('menu_about')"
      back
      data-testid="about-header"
      @back="router.back()"
    />

    <section class="cp-about__panel">
      <div class="cp-about__body">
        <template v-if="loading">
          <div class="cp-about__state">{{ t("loading") }}</div>
        </template>
        <template v-else-if="error">
          <div class="cp-about__state cp-about__state--error">{{ error }}</div>
        </template>
        <template v-else-if="appInfo">
          <header class="cp-about__hero">
            <div class="cp-about__mark">
              <AppIcon name="package" :size="26" />
            </div>
            <div class="cp-about__heroText">
              <h1 class="cp-about__title">{{ appInfo.name }}</h1>
              <p class="cp-about__description">{{ appInfo.description }}</p>
            </div>
            <span class="cp-about__version">v{{ appInfo.version }}</span>
          </header>

          <PanelGroup :title="t('about_version')">
            <PanelRow :label="t('about_version')">
              <template #control>
                <span class="cp-about__mono">{{ appInfo.version }}</span>
              </template>
            </PanelRow>
            <PanelRow :label="t('about_license')">
              <template #control>
                <span class="cp-about__value">{{ appInfo.license }}</span>
              </template>
            </PanelRow>
          </PanelGroup>

          <PanelGroup :title="t('about_tech_stack')" padded>
            <div class="cp-about__chips">
              <span v-for="item in appInfo.techStack" :key="item" class="cp-about__chip">{{ item }}</span>
            </div>
          </PanelGroup>

          <PanelGroup :title="t('about_credits')" padded>
            <ul class="cp-about__credits">
              <li v-for="credit in appInfo.credits" :key="credit.name">
                <a v-if="credit.url" :href="credit.url" target="_blank" rel="noopener">{{ credit.name }}</a>
                <span v-else>{{ credit.name }}</span>
              </li>
            </ul>
          </PanelGroup>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* 样式：AboutPage｜布局：工作台骨架 + 紧凑 PageHeader + 透明内容区（880 阅读列） */
.cp-about {
  @include cp-workspace;

  overflow: hidden;
}

.cp-about__panel {
  @include cp-region;

  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.cp-about__body {
  max-width: 880px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 24px 28px;
  display: flex;
  flex-direction: column;
  gap: var(--cp-page-gap);
}

/* 品牌区：图标瓦片 + 名称/描述 + 版本胶囊 */
.cp-about__hero {
  @include cp-card;

  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.cp-about__mark {
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
  color: var(--cp-accent);
}

.cp-about__heroText {
  flex: 1 1 auto;
  min-width: 0;
}

.cp-about__title {
  margin: 0;
  font-family: var(--cp-font-display);
  font-weight: 900;
  font-size: 18px;
  line-height: 1.2;
  color: var(--cp-text);
}

.cp-about__description {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-about__version {
  flex: 0 0 auto;
  padding: 4px 10px;
  border: 1px solid var(--cp-border-light);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  font-family: var(--cp-font-mono);
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-about__mono {
  font-family: var(--cp-font-mono);
  font-size: 12.5px;
  color: var(--cp-text);
}

.cp-about__value {
  font-size: 12.5px;
  color: var(--cp-text);
}

.cp-about__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cp-about__chip {
  padding: 4px 10px;
  border: 1px solid var(--cp-border-light);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  font-family: var(--cp-font-mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-about__credits {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  color: var(--cp-text);
}

.cp-about__credits a {
  color: var(--cp-accent);
  text-decoration: none;
}

.cp-about__credits a:hover {
  text-decoration: underline;
}

.cp-about__state {
  padding: 48px;
  text-align: center;
  font-size: 13px;
  color: var(--cp-text-muted);
}

.cp-about__state--error {
  color: var(--cp-danger);
}

@media (max-width: 640px) {
  .cp-about__body {
    padding: 12px 12px 16px;
  }

  .cp-about__hero {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
