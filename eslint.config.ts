import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import { defineConfig } from "eslint/config";
import structuredJsdoc from "./eslint-rules/structured-jsdoc.js";

export default defineConfig([
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "target/**",
      "src-tauri/**",
      "src/script/**",
      "src/api/**",
      "src/value/**",
      "src/router/**",
      "src/i18n/**",
      "src/**/*.d.ts",
    ],
  },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: {...globals.browser, ...globals.node} } },
  tseslint.configs.recommended,
  pluginVue.configs["flat/essential"],
  { files: ["**/*.vue"], languageOptions: { parserOptions: { parser: tseslint.parser } } },
  {
    files: ["src/**/*.vue"],
    plugins: { docs: structuredJsdoc },
    rules: {
      "docs/require-vue-template-style-docs": [
        "error",
        { requireTemplateLeadingComment: true, requireStyleLeadingComment: true },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx,vue}"],
    plugins: { docs: structuredJsdoc },
    rules: {
      "docs/require-structured-jsdoc": [
        "error",
        {
          requireFileOverview: true,
          requireParamTags: true,
          requireReturnsTag: true,
          requireConstTag: true,
          requireAllFunctions: true,
        },
      ],
      "docs/no-cross-feature-internal-imports": "error",
    },
  },
  {
    files: ["src/features/**/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tauri-apps/*"],
              message: "Do not import Tauri APIs from domain layer (use ports + data adapters).",
            },
            {
              group: ["vue", "vue/*", "vue-router", "tdesign-vue-next"],
              message: "Do not import UI frameworks from domain layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx,vue}"],
    ignores: ["src/api/**", "src/script/**", "src/value/**", "src/router/**", "src/i18n/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "../api/**",
                "../../api/**",
                "../../../api/**",
                "../../../../api/**",
                "../script/**",
                "../../script/**",
                "../../../script/**",
                "../../../../script/**",
                "../value/**",
                "../../value/**",
                "../../../value/**",
                "../../../../value/**",
                "../router/**",
                "../../router/**",
                "../../../router/**",
                "../../../../router/**",
                "../i18n/**",
                "../../i18n/**",
                "../../../i18n/**",
                "../../../../i18n/**",
              ],
              message: "Do not import from legacy dirs (api/script/value/router/i18n). Use features/* or shared/* (or app/*).",
            },
          ],
        },
      ],
    },
  },
]);
