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
      // 解析预构建依赖的浏览器加载 URL。
      // 宿主源码 `import "vue"` 会被 Vite 重写为 `<root 相对路径>?v=<browserHash>`
      // 指向 node_modules/.vite/deps 产物；此处返回完全一致的 URL，保证模块实例同一。
      const resolveOptimizedDepUrl = (id: string): string | null => {
        type DepsMetadata = {
          browserHash?: string;
          optimized?: Record<string, { file?: string; browserHash?: string }>;
        };
        // Vite 8（rolldown）把 optimizer 挂在 client 环境；旧版兼容 server.optimizeDeps。
        const metadata = (
          server as unknown as {
            environments?: { client?: { depsOptimizer?: { metadata?: DepsMetadata } } };
            optimizeDeps?: { metadata?: DepsMetadata };
          }
        ).environments?.client?.depsOptimizer?.metadata
          ?? (server as unknown as { optimizeDeps?: { metadata?: DepsMetadata } }).optimizeDeps?.metadata;
        const entry = metadata?.optimized?.[id];
        const hash = entry?.browserHash ?? metadata?.browserHash;
        if (!entry?.file || !hash) return null;
        const rel = path.relative(server.config.root, entry.file).split(path.sep).join("/");
        if (!rel || rel.startsWith("..")) return null;
        return `/${encodeURI(rel)}?v=${hash}`;
      };

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
          // dev shim：插件产物 import "/vendor/vendor.mjs" 时，不返回 public 下的生产
          // 构建产物（那是一份独立的 Vue 实例），而是重导出宿主正在使用的预构建
          // vue / tdesign-vue-next，使宿主与插件共享同一运行时实例。否则插件组件的
          // 响应式全部失效（首帧渲染正常、状态更新死掉）。release 不经过 dev 中间件，
          // 仍由 dist 内真实 vendor.mjs + index.html import map 承担同一职责。
          if (vendorMatch[1] === "cordis.mjs") {
            // 与 vendor.mjs 同理：dev 下把 /vendor/cordis.mjs 重导出为宿主正在使用的
            // 预构建 @cordisjs/core 实例，保证宿主与插件共享同一 Cordis 运行时。
            const cordisUrl = resolveOptimizedDepUrl("@cordisjs/core");
            if (cordisUrl) {
              const body = [
                "// CarryPigeon dev vendor shim: re-export the SAME pre-bundled",
                "// @cordisjs/core instance the host app uses.",
                `export * from ${JSON.stringify(cordisUrl)};`,
                "",
              ].join("\n");
              res.setHeader("Content-Type", "text/javascript; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(body);
              return;
            }
          }
          if (vendorMatch[1] === "vendor.mjs") {
            const vueUrl = resolveOptimizedDepUrl("vue");
            const tdesignUrl = resolveOptimizedDepUrl("tdesign-vue-next");
            if (vueUrl && tdesignUrl) {
              const body = [
                "// CarryPigeon dev vendor shim: re-export the SAME pre-bundled",
                "// vue / tdesign-vue-next instances the host app uses, so plugin",
                '// dists importing "/vendor/vendor.mjs" share one runtime copy.',
                `export * from ${JSON.stringify(vueUrl)};`,
                `export * from ${JSON.stringify(tdesignUrl)};`,
                // 与 src/vendor-entry.ts 对齐：vue 与 tdesign-vue-next 存在同名运行时
                // 导出（Comment / Text），浏览器对歧义 star export 一律不导出，需显式消歧。
                `export { Comment, Text } from ${JSON.stringify(vueUrl)};`,
                `export { default as TDesign } from ${JSON.stringify(tdesignUrl)};`,
                "",
              ].join("\n");
              res.setHeader("Content-Type", "text/javascript; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(body);
              return;
            }
            // 预构建 metadata 尚未就绪（极早期请求）时退回真实产物，行为等同修复前。
          }
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
                  id === "@cordisjs/core" ||
                  id.startsWith("vue/") ||
                  id.startsWith("tdesign-vue-next/") ||
                  id.startsWith("@cordisjs/core/") ||
                  id.includes("node_modules/vue/") ||
                  id.includes("node_modules/tdesign-vue-next/") ||
                  id.includes("node_modules/@cordisjs/core/")),
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
      include: ['vue', 'vue-router', 'tdesign-vue-next', '@tauri-apps/api', '@cordisjs/core'],
    },
  };
});
