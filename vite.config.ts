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
        // build 产物仍 external vue/tdesign，由 index.html import map 指向 /vendor/vendor.mjs。
        // Vite 8 的 import-analysis 不能把 URL `/vendor/vendor.mjs` 解析成 dev 模块；
        // 若 alias 到 public/vendor/vendor.mjs，会被当成静态资源且缺少 `Text` 等 named export。
        // 因此 dev 宿主改走 node_modules 预构建，保证浏览器联调可启动。
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
        // 根 Cargo.toml 定义了 workspace,target 产物在仓库根部;
        // cargo 链接时会锁住 target 下的 exe,监听它会触发 EBUSY 崩溃。
        ignored: ["**/src-tauri/**", "**/target/**"],
      },
      // 浏览器预览联调：把同 origin 的 `/api` 转到 CarryPigeon-Server，避开受保护接口 OPTIONS 预检 500。
      proxy: {
        "/api/ws": {
          target: process.env.VITE_DEV_WS_PROXY_TARGET || "ws://127.0.0.1:18080",
          ws: true,
          changeOrigin: true,
        },
        "/api": {
          target: process.env.VITE_DEV_API_PROXY_TARGET || "http://127.0.0.1:8080",
          changeOrigin: true,
        },
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
      include: ['vue', 'vue-router', 'tdesign-vue-next', '@tauri-apps/api'],
    },
  };
});
