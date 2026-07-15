import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { TDesignResolver } from "@tdesign-vue-next/auto-import-resolver";

// 插件库构建：产出 ESM，外部化 vue/tdesign/@tauri-apps/api（经宿主 import map 共享）。
// root 设为插件目录，确保 build.outDir: "dist" 写入 plugins/voice-call/dist 而非仓库根 dist/。
// CSS 由 Vite 自动抽取为 style.css，供宿主加载入口时 import。
export default defineConfig({
  root: __dirname,
  plugins: [
    vue(),
    AutoImport({
      resolvers: [TDesignResolver({ library: "vue-next" })],
    }),
    Components({
      globs: ["src/**/components/**/*.vue"],
      dts: false,
      resolvers: [TDesignResolver({ library: "vue-next" })],
    }),
    // 构建后将 manifest.json 源文件复制到 dist/，保证单一真源。
    {
      name: "copy-plugin-manifest",
      closeBundle() {
        const destDir = path.resolve(__dirname, "dist");
        mkdirSync(destDir, { recursive: true });
        // 确保资源目录存在，供后续任务产物（图片等）落入 assets/。
        mkdirSync(path.resolve(destDir, "assets"), { recursive: true });
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
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
        additionalData: '@use "@/styles/button-size" as *;\n',
      },
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
      // 仅在别名解析后的 URL（及 tauri 模块）上 external，确保产物保留
      // `import ... from "/vendor/vendor.mjs"` 而不内联 vue/tdesign 副本。
      external: (id: string) =>
        id === "/vendor/vendor.mjs" ||
        id.startsWith("/vendor/vendor.mjs") ||
        id === "@tauri-apps/api" ||
        id === "@tauri-apps/api/event",
      output: {
        // 抽取的样式保留为根目录 style.css；其余资源（图片等）落入 assets/。
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
