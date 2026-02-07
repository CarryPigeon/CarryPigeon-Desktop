# 新 Feature 接入检查清单

本文档用于给“新增一个 feature”提供可执行的最小清单，确保目录结构、依赖方向、mock 切换、跨 feature 协作边界都符合当前仓库规范。

## 一、目录与文档

- [ ] 新建 `src/features/<feature>/`。
- [ ] 至少包含：`domain/`、`data/`、`di/`、`presentation/`（按需加 `mock/`、`test/`）。
- [ ] 新建 `src/features/<feature>/README.md`，写清：定位、边界、入口、关键流程。
- [ ] 若需要跨 feature 调用，新增 `src/features/<feature>/api.ts` 作为唯一公共入口。

## 二、分层与依赖方向

- [ ] `domain/*` 不引入 Vue / Tauri / 浏览器 API。
- [ ] `usecases/*` 仅依赖 `domain/types|errors|ports`。
- [ ] `data/*` 实现 `domain/ports/*`。
- [ ] `presentation/*` 通过 `di/*` 或公开 API 调用能力，不直接依赖别的 feature 内部路径。

## 三、DI 与 mock 切换

优先使用统一选择器：`src/shared/config/mockModeSelector.ts`。

- [ ] 在 `di/*.ts` 中使用 `selectByMockMode`（off/store/protocol）。
- [ ] 仅区分“是否启用 mock”时使用 `selectByMockEnabled`。
- [ ] 不在业务实现中直接读取 `import.meta.env`。

示例（推荐）：

```ts
import { selectByMockMode } from "@/shared/config/mockModeSelector";

const port = selectByMockMode({
  off: () => httpPort,
  store: () => mockPort,
  protocol: () => httpPort,
});
```

## 四、跨 Feature API 边界

- [ ] 其他 feature 仅通过 `@/features/<feature>/api` 访问能力。
- [ ] 不从外部导出 feature 内部 `data/*` 实现细节（除兼容迁移的临时场景）。
- [ ] 若确有兼容导出，写清 `@deprecated` 与迁移目标。

## 五、状态与持久化

- [ ] 展示层 store 仅做状态组织与交互编排。
- [ ] 持久化读写（localStorage/DB）优先下沉到 `data` 适配器。
- [ ] 若有持久化抽象，优先定义 `domain/ports/*StatePort.ts`。

## 六、启动编排（如涉及全局流程）

若功能属于应用启动流程（会话恢复、桥接注册、子窗口分发）：

- [ ] 放到 `src/app/bootstrap/*`，避免把流程堆到 `src/main.ts`。
- [ ] `main.ts` 保持“组装层”职责（app/router/i18n/mount）。

## 七、插件与运行时（如涉及）

若 feature 涉及插件安装/运行时切换：

- [ ] 复杂编排（更新、回滚、版本切换）优先下沉为 `domain/usecases/*`。
- [ ] presentation store 只保留 UI 进度与状态映射。

## 八、提交前自检

- [ ] `npm run lint`
- [ ] `npx vue-tsc --noEmit`
- [ ] 手动验证三种运行模式：`off` / `store` / `protocol`
- [ ] 检查 `docs/` 与 feature README 是否同步更新

