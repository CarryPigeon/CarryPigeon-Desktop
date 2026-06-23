<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { createLogger } from "@/shared/utils/logger";
import { getAboutCapabilities } from "../../api";
import type { AppInfo } from "../../api-types";

const logger = createLogger("AboutPage");
const { t } = useI18n();

const appInfo = ref<AppInfo | null>(null);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    const caps = getAboutCapabilities();
    appInfo.value = await caps.getAppInfo();
  } catch (e) {
    error.value = t("load_failed");
    logger.error("Failed to load app info", { error: String(e) });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="cp-about">
    <template v-if="loading">
      <div class="cp-about__loading">{{ t("loading") }}</div>
    </template>
    <template v-else-if="error">
      <div class="cp-about__error">{{ error }}</div>
    </template>
    <template v-else-if="appInfo">
      <h1 class="cp-about__title">{{ appInfo.name }}</h1>
      <p class="cp-about__description">{{ appInfo.description }}</p>

      <section class="cp-about__section">
        <h2>{{ t("version") }}</h2>
        <p>{{ appInfo.version }}</p>
      </section>

      <section class="cp-about__section">
        <h2>{{ t("tech_stack") }}</h2>
        <ul>
          <li v-for="item in appInfo.techStack" :key="item">{{ item }}</li>
        </ul>
      </section>

      <section class="cp-about__section">
        <h2>{{ t("license") }}</h2>
        <p>{{ appInfo.license }}</p>
      </section>

      <section class="cp-about__section">
        <h2>{{ t("credits") }}</h2>
        <ul>
          <li v-for="credit in appInfo.credits" :key="credit.name">
            <a v-if="credit.url" :href="credit.url" target="_blank" rel="noopener">{{ credit.name }}</a>
            <span v-else>{{ credit.name }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.cp-about {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 24px;
  color: var(--cp-text);
}

.cp-about__title {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.cp-about__description {
  font-size: 14px;
  color: var(--cp-text-secondary);
  margin-bottom: 32px;
}

.cp-about__section {
  margin-bottom: 24px;

  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--cp-border);
  }

  ul {
    list-style: none;
    padding: 0;
  }

  li {
    padding: 4px 0;
    font-size: 14px;
  }

  a {
    color: var(--cp-accent);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.cp-about__loading,
.cp-about__error {
  text-align: center;
  padding: 48px;
  color: var(--cp-text-secondary);
}
</style>
