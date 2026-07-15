import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import fs from "node:fs";
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { TDesignResolver } from '@tdesign-vue-next/auto-import-resolver';

const host = process.env.TAURI_DEV_HOST;

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as {
  version: string;
};

// vue/tdesign 经 import map 指向的共享 vendor（/vendor/vendor.mjs）解析，
// 确保宿主主包与运行时加载的插件共享同一 Vue/TDesign 运行时实例。
// - dev：将裸模块名 vue/tdesign-vue-next 精确重定向到该 URL（dev 服务器直接托管 public/ 下的文件）。
// - build：将其 external，使产物保留裸模块名，运行期由 index.html 的 import map 解析。
// 两者都指向同一文件，故 dev 与 build 均为同一实例。
const VENDOR_URL = "/vendor/vendor.mjs";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isBuild = command === "build";

  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [TDesignResolver({
          library: 'vue-next'
        })],
      }),
      Components({
        globs: ["src/features/**/presentation/components/**/*.vue"],
        dts: false,
        resolvers: [TDesignResolver({
          library: 'vue-next'
        })],
      }),
    ],
    resolve: {
      alias: [
        { find: "@", replacement: path.resolve(__dirname, "src") },
        // 仅 dev 下重定向：用正则精确匹配裸模块名，避免误伤 tdesign-vue-next/es/style/index.css 等子路径导入。
        ...(isBuild
          ? []
          : [
              { find: /^vue$/, replacement: VENDOR_URL },
              { find: /^tdesign-vue-next$/, replacement: VENDOR_URL },
            ]),
      ],
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
          additionalData: `@use "@/styles/button-size" as *;\n`,
        },
      },
    },
    define: {
      "import.meta.env.PACKAGE_VERSION": JSON.stringify(pkg.version),
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },

    // Build optimizations
    build: {
      target: 'esnext',
      minify: 'esbuild' as const,
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        // build 下 external vue/tdesign（含子路径，但排除 .css），
        // 使主包不再内联，运行期经 import map 解析同一 vendor 实例。
        // 同时匹配裸模块名与 Vite/rolldown 解析后的 node_modules 绝对路径，确保完全 external。
        ...(isBuild
          ? {
              external: (id: string) =>
                !id.endsWith(".css") &&
                (id === "vue" ||
                  id === "tdesign-vue-next" ||
                  id.startsWith("vue/") ||
                  id.startsWith("tdesign-vue-next/") ||
                  id.includes("node_modules/vue/") ||
                  id.includes("node_modules/tdesign-vue-next/")),
            }
          : {}),
        output: {
          // vue/tdesign 已 external，仅保留 tauri 依赖的拆分。
          manualChunks(id: string) {
            if (id.includes('node_modules/@tauri-apps')) return 'vendor-tauri';
          },
        },
      },
    },

    // Optimize dependency pre-bundling
    optimizeDeps: {
      // vue/tdesign 由 import map 经 /vendor/vendor.mjs 提供，dev 下不预构建。
      include: ['vue-router', '@tauri-apps/api'],
      exclude: ['vue', 'tdesign-vue-next'],
    },
  };
});
