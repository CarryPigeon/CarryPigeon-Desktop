import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      // 与 vite.config.ts 保持一致：组件 <style lang="scss"> 依赖全局注入的 button-size mixin。
      scss: {
        api: "modern-compiler",
        additionalData: `@use "@/styles/button-size" as *;\n`,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setupLocalStorage.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "plugins/*/src/**/*.test.ts"],
    exclude: ["node_modules", "src-tauri", "dist"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.vue"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/**/mock/**",
        "src/**/typechecks/**",
      ],
    },
    css: true,
  },
});
