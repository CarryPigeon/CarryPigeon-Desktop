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
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
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
