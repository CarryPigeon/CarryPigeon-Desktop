import { defineConfig, type Plugin } from "vite";
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

// ---------------------------------------------------------------------------
// 开发期本地插件资产服务
//
// 背景：Vite 禁止从源码（含运行时动态 import）加载 public/ 目录下的 JS
// （"This file is in /public ... should not be imported from source code"），
// 因此插件构建产物不能只靠 public/plugins 静态分发。
//
// 方案：dev 下由自定义中间件（先于 Vite 内部中间件注册）直接从文件系统服务：
// - /plugins/<id>/<rel>  ->  plugins/<id>/dist/<rel>
// - /vendor/<rel>        ->  public/vendor/<rel>（绕开 public-import 限制，
//                            供插件产物 import "/vendor/vendor.mjs" 共享 vendor 实例）
// ---------------------------------------------------------------------------
const MIME_BY_EXT: Record<string, string> = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveFile(res: import("node:http").ServerResponse, file: string): void {
  const ext = path.extname(file).toLowerCase();
  res.setHeader("Content-Type", `${MIME_BY_EXT[ext] ?? "application/octet-stream"}; charset=utf-8`);
  res.setHeader("Cache-Control", "no-store");
  fs.createReadStream(file).pipe(res);
}

function localPluginAssetsPlugin(): Plugin {
  return {
    name: "carrypigeon-local-plugin-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const rawUrl = req.url ?? "";
        const pathname = decodeURIComponent(rawUrl.split("?")[0] ?? "");
        // /plugins/<id>/<rel> -> plugins/<id>/dist/<rel>
        const pluginMatch = /^\/plugins\/([A-Za-z0-9._-]+)\/(.+)$/.exec(pathname);
        if (pluginMatch) {
          const base = path.resolve(__dirname, "plugins", pluginMatch[1], "dist");
          const file = path.resolve(base, pluginMatch[2]);
          if (file.startsWith(base + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
            serveFile(res, file);
            return;
          }
          return next();
        }
        // /vendor/<rel> -> public/vendor/<rel>
        const vendorMatch = /^\/vendor\/(.+)$/.exec(pathname);
        if (vendorMatch) {
          const base = path.resolve(__dirname, "public", "vendor");
          const file = path.resolve(base, vendorMatch[1]);
          if (file.startsWith(base + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
            serveFile(res, file);
            return;
          }
          return next();
        }
        return next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isBuild = command === "build";

  return {
    plugins: [
      localPluginAssetsPlugin(),
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
