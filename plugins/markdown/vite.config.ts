import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";

// markdown 插件构建：产出 ESM，外部化 vue/tdesign（经宿主 /vendor/vendor.mjs 共享）。
// root 设为插件目录，确保 build.outDir: "dist" 写入 plugins/markdown/dist 而非仓库根 dist/。
// 本插件不使用 scss，故省略相关预处理器配置。
export default defineConfig({
  root: __dirname,
  plugins: [
    vue(),
    // 构建后将 manifest.json 源文件复制到 dist/，保证单一真源。
    {
      name: "copy-plugin-manifest",
      closeBundle() {
        const destDir = path.resolve(__dirname, "dist");
        mkdirSync(destDir, { recursive: true });
        copyFileSync(
          path.resolve(__dirname, "manifest.json"),
          path.resolve(destDir, "manifest.json"),
        );
      },
    },
  ],
  resolve: {
    alias: {
      // vue/tdesign 经宿主共享 vendor（/vendor/vendor.mjs）解析，
      // 确保插件与宿主主包运行期共享同一 Vue/TDesign 实例。
      vue: "/vendor/vendor.mjs",
      "tdesign-vue-next": "/vendor/vendor.mjs",
      "@": path.resolve(__dirname, "../../src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
    minify: false,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      // vue/tdesign 经 resolve.alias 重定向到 /vendor/vendor.mjs 后与宿主共享同一实例。
      external: (id: string) =>
        id === "/vendor/vendor.mjs" ||
        id.startsWith("/vendor/vendor.mjs") ||
        id === "@tauri-apps/api" ||
        id === "@tauri-apps/api/event",
      output: {
        // 抽取的样式保留为根目录 style.css；其余资源落入 assets/。
        assetFileNames: (assetInfo) => {
          const name = (assetInfo.name as string) ?? "";
          if (name.endsWith(".css")) return "style.css";
          return `assets/${name}[extname]`;
        },
        chunkFileNames: "chunks/[name].js",
      },
    },
  },
});
