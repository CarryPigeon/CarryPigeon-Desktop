import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

// 本配置始终从项目根目录执行（pnpm run vendor:build / predev / prebuild），
// 故以 process.cwd() 作为项目根。产出 public/vendor/vendor.mjs（vue + tdesign）
// 与 public/vendor/cordis.mjs（@cordisjs/core），供 index.html 的 import map 引用。
// 拆成两个文件的原因是 `export *` 同名导出会被浏览器判为歧义而静默丢弃。
const projectRoot = process.cwd();

export default defineConfig({
  root: projectRoot,
  plugins: [vue()],
  resolve: {
    alias: { "@": path.resolve(projectRoot, "src") },
  },
  define: {
    // lib 模式不会像 app 构建那样自动替换 process.env.NODE_ENV；vue/tdesign 的
    // esm-bundler 产物里存在大量裸引用，浏览器加载 vendor.mjs 时会直接抛出
    // "process is not defined"，导致 release 构建白屏卡死。此处按生产环境内联，
    // 让压缩器顺带裁掉 dev-only 分支。
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "public/vendor",
    emptyOutDir: true,
    target: "esnext",
    minify: false,
    lib: {
      entry: {
        vendor: path.resolve(projectRoot, "src/vendor-entry.ts"),
        cordis: path.resolve(projectRoot, "src/cordis-entry.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.mjs`,
      // 固定抽取的样式文件名：index.html 以 /vendor/vendor.css 引用了 TDesign 样式，
      // 多入口 lib 构建默认会用包名命名 CSS，需显式覆盖回 vendor.css。
      cssFileName: "vendor",
    },
    rollupOptions: {
      // vendor 自身须打包依赖，故不 external
      output: { entryFileNames: "[name].mjs" },
    },
  },
});
