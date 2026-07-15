import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

// 本配置始终从项目根目录执行（pnpm run vendor:build / predev / prebuild），
// 故以 process.cwd() 作为项目根。产出 public/vendor/vendor.mjs：将 vue +
// tdesign-vue-next 打包为单一 ESM，供 index.html 的 import map 引用。
const projectRoot = process.cwd();

export default defineConfig({
  root: projectRoot,
  plugins: [vue()],
  resolve: {
    alias: { "@": path.resolve(projectRoot, "src") },
  },
  build: {
    outDir: "public/vendor",
    emptyOutDir: true,
    target: "esnext",
    minify: false,
    lib: {
      entry: path.resolve(projectRoot, "src/vendor-entry.ts"),
      formats: ["es"],
      fileName: "vendor",
    },
    rollupOptions: {
      // vendor 自身须打包依赖，故不 external
      output: { entryFileNames: "vendor.mjs" },
    },
  },
});
