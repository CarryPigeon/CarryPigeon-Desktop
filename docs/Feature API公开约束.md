# Feature API 公开约束（Object Capability）

本文档定义 `src/features/<feature>/api.ts` 的仓库级公开模式。

补充语义约束见：`docs/Feature语义规范.md`。

## 1. 核心原则

一句话原则：

- `api.ts` 公开的是能力，不是实现。

结论：

- 默认采用 **object-capability**。
- 不采用传统 public class 作为默认公开模式。
- 不长期使用散列式 named exports 作为主要公开形式。

原因：

- 相比散列式 named exports：能力对象更容易收敛公共能力面，减少 API 漂移和无意泄漏。
- 相比传统 class OO：能力对象更贴合当前仓库的 composition root、依赖注入和函数式组装方式。
- 对外可以保持稳定契约，对内仍允许自由重构。

## 2. 强约束

### 2.1 公开入口

- `src/features/<feature>/api.ts` 是跨 feature 唯一公共值入口。
- `src/features/<feature>/api-types.ts` 是跨 feature 唯一公共类型入口。
- `domain` 可以是内部语义源，但不是跨 feature 的公共值入口。
- 跨 feature 禁止依赖内部深路径；只允许依赖 `api.ts`、`api-types.ts`、`routes.ts`、`styles.ts` 等明确公共入口。

### 2.2 公开模式

- `api.ts` 默认必须提供 `create<Feature>Capabilities()`。
- 只有确实需要应用级缓存/单例时，才提供 `get<Feature>Capabilities()`。
- 能力对象必须表达“外部真的需要的最小能力面”。
- 能力对象优先暴露稳定的查询方法与命令方法，不暴露内部组织结构。

### 2.3 类型模式

- `api-types.ts` 只导出稳定公共类型。
- 公共能力类型命名固定为 `<Feature>Capabilities`。
- 输入输出类型应定义为稳定 DTO / contract，不直接复用内部 store/runtime 类型。
- `api-types.ts` 禁止直接导出 wire DTO；若确需导出，应先映射为稳定 domain contract 或 view snapshot。

## 3. 允许与禁止

### 3.1 允许导出

- `create<Feature>Capabilities`
- `get<Feature>Capabilities`
- `<Feature>Capabilities`
- 极少量跨 feature 必须共享的稳定常量
- 明确公共入口文件中的路由入口或样式入口

### 3.2 禁止导出

- `composition/*`
- `data/*`
- `presentation/store/live/*`
- UI 组件
- Vue `ref` / `computed`
- Vue 响应式容器派生出来的 view object
- 内部 runtime 容器
- 内部 helper
- 领域错误类本体
- `export *` 式透传 barrel
- 长期保留“临时兼容导出”

进一步禁止：

- 禁止通过 `createXxxView()` 把 `ref`、`computed`、`reactive` 或它们的组合对象跨 feature / 子域边界公开。
- 禁止在 `api.ts` / `api-types.ts` 中公开 `Vue Component`、`.vue` 组件类型或“渲染宿主”组件引用。
- 禁止把“当前 serverSocket”当作根 capability 上所有方法的重复参数；应优先收敛为 `forServer(serverSocket)` 形式的局部 capability。
- 禁止只提供 `startRuntime()` 而没有对应 ownership 协议；feature 级运行时默认应采用 `acquireLease()`。
- 禁止通过 `api.ts` 公开某个错误类，外部只能依赖谓词、分类结果或可展示错误文案。
- 禁止通过 `api.ts` / `api-types.ts` 把 `WireDto`、协议请求体、数据库记录类型直接升级为跨 feature 公共契约。
- 禁止在根或子域 `api.ts` 中直接导入 `presentation/store/*`、`data/*` 后原样转发为能力对象；应先下沉到 application/state facade。
- 禁止把 `snake_case` 协议字段命名提升到 `api-types.ts`、`contracts/*`、domain runtime contract 或跨 feature host bridge。

## 3.3 数据流公开协议

feature 对外公开时，必须满足：

- `api.ts` 暴露 capability
- `api-types.ts` 暴露稳定 contract
- 外部看不到 wire DTO、transport payload、数据库记录

标准流向：

```text
wire dto -> data -> domain/application -> capability/view snapshot -> external consumer
```

要求：

- `data` 负责 DTO 解析与协议错误归一化。
- `application` / `usecase` 负责业务语义编排与模型转化。
- `api.ts` 不得把 DTO 直通到其他 feature。

## 3.4 分层依赖补充约束

### 3.4.1 application 公开给上层的只能是 port 语义

- `application` 向 `presentation` / `composition` 暴露的交互点必须是 capability、query port、mutation port、gateway port。
- `application` 禁止把 `Ref<T>`、`computed`、`reactive` 或裸状态容器升级成上层契约。
- `presentation` 若需要响应式实现，必须在本层 runtime store 适配，不得把 Vue 语义回灌到 usecase。

### 3.4.2 presentation 禁止把 domain contract 当作公共入口

- `presentation` 不得通过 `*/domain/contracts.ts` 充当跨子域、跨 feature 的主契约源。
- 页面模型、组件、bridge 与上层组合优先依赖：
  - `public/api-types.ts`
  - 子域 `api.ts` 导出的 capability 类型
  - `presentation/contracts.ts`
- `domain/contracts.ts` 只作为内部语义模型，不作为 UI 边界协议。

### 3.4.3 composition 禁止借道 presentation 持有核心端口

- `composition` 所需的 gateway / runtime / state port，必须来自 `application/ports/*` 或 `composition/contracts/*`。
- 禁止通过 `presentation/*` 中的类型别名定义核心依赖方向。
- 若某端口当前只存在于 `presentation/store/*`，应先上提为显式 port，再由 `presentation` 消费。

### 3.4.4 UI 错误公开必须来自 outcome 映射

- `presentation` 不能手写领域错误对象后再向外传播。
- UI 错误必须来自：
  - `Outcome.error`
  - `mapXxxOutcomeToUiError(...)`
- `api.ts` / `api-types.ts` 不得为 UI 临时文案暴露未建模错误结构。

## 3.5 状态公开协议

跨边界状态读取必须使用 plain snapshot 协议：

- `getSnapshot(): XxxSnapshot`
- `observeSnapshot(observer): () => void`
- 命令方法（如 `select()`、`setDraft()`、`refresh()`）

要求：

- snapshot 必须是 plain data，不含 Vue 响应式对象。
- observer 建立后应立即推送一次当前快照。
- 写能力必须通过显式命令方法暴露，不允许调用方拿到内部可写状态句柄。
- 跨层状态写入必须走命名 mutation 能力，而不是暴露内部对象给调用方直接改字段。

推荐的子 capability 形态：

```ts
type MessageComposerCapabilities = {
  getSnapshot(): MessageComposerSnapshot;
  observeSnapshot(observer: (snapshot: MessageComposerSnapshot) => void): () => void;
  setDraft(value: string): void;
  setActiveDomainId(value: string): void;
  sendMessage(payload?: ComposerSubmitPayload): Promise<void>;
};
```

## 3.6 局部 capability 协议

当某一组能力天然依赖上下文时，应优先返回局部 capability，而不是让每个方法重复接受上下文参数。

推荐：

- `accountCapabilities.forServer(serverSocket)`
- `pluginsCapabilities.forServer(serverSocket)`

避免：

- `accountCapabilities.sendVerificationCode(serverSocket, email)`
- `pluginsCapabilities.attachPluginHostBridge(serverSocket, bridge)`

原因：

- 调用点更短，边界更清晰。
- 上下文被显式绑定，能力面更小。
- 更符合 object-capability 的“先拿到局部权能，再执行动作”模型。

## 3.7 运行时 ownership 协议

feature 级运行时公开默认采用 lease：

```ts
type FeatureRuntimeCapabilities = {
  acquireLease(): Promise<{ release(): Promise<void> }>;
};
```

要求：

- `acquireLease()` 必须幂等支持多调用者共享。
- 只有最后一个 lease 释放后，底层 runtime 才允许真正停止。
- 若启动中失败，必须回滚已启动子系统。
- `startRuntime()` 仅允许存在于 feature 内部子域或私有装配层，不应作为根公开面的长期契约。

## 4. 命名规范

- 能力类型：`<Feature>Capabilities`
- 工厂函数：`create<Feature>Capabilities`
- 访问器：`get<Feature>Capabilities`
- 测试重置：`reset<Feature>CapabilitiesForTest`

避免：

- `Facade`
- `Manager`
- `Service`
- `legacy*`
- `compat*`

## 5. 标准模板

```ts
// api-types.ts
export type ChatCapabilities = {
  ensureReady(): Promise<void>;
  sendMessage(input: SendMessageInput): Promise<void>;
  listChannels(): readonly ChatChannelView[];
};

// api.ts
export function createChatCapabilities(deps?: ChatCapabilityDeps): ChatCapabilities {
  // 组装内部依赖，返回最小公开能力面
}

export function getChatCapabilities(): ChatCapabilities {
  // 可选：应用级缓存/访问器
}
```

## 6. 检查规则

### 6.1 编译期检查

复杂 feature 应提供 `typechecks/apiContractChecks.ts`：

```ts
import { createChatCapabilities } from "@/features/chat/public/api";
import type { ChatCapabilities } from "@/features/chat/public/api-types";

export const chatApiContractCheck: ChatCapabilities = createChatCapabilities();
```

### 6.2 边界检查

边界脚本或 code review 必须检查：

- `api.ts` 是否直接导出 `data/composition/presentation/live`。
- `api.ts` 是否导出组件或内部容器。
- 是否仍存在跨 feature 深路径 import。
- `application` 是否重新出现 `vue`、`Ref`、`computed`、`watch`。
- `presentation` 是否重新深依赖 `*/domain/contracts.ts` 作为页面契约。
- `composition` 是否重新经由 `presentation/*` 定义核心 port。

### 6.3 PR 检查清单

涉及 `api.ts` 变更的 PR 必须回答：

1. 新增导出是否属于稳定公共能力？
2. 为什么它不能留在 feature 内部？
3. 是否应收敛进 capability object，而不是散列导出？
4. 是否存在 `ref` / `computed` / 组件 / 错误类 / runtime 容器泄漏？
5. 是否应该进一步收敛为 `forServer()` 或其他局部 capability？
6. 是否存在 DTO / transport payload / snake_case 协议字段直接穿透到公共契约？
7. 是否同步更新了 `api-types.ts` 与 `typechecks/apiContractChecks.ts`？
8. 是否把状态读写收敛为显式 port / mutation capability，而不是把响应式容器直接交给 usecase？

## 7. 迁移规则

针对已经存在散列式导出的 feature，按以下顺序迁移：

1. 先新增 `create/get*Capabilities()`，内部复用现有实现。
2. 再迁移跨 feature 调用方到能力对象。
3. 最后删除临时散列导出，收敛到“能力对象 + 类型入口分离”。

迁移期间允许短期兼容导出，但必须在 README 标注迁移目标和移除计划。

## 8. 仓库级已知反模式

以下问题一旦再次出现，应直接视为设计回退：

1. 跨边界公开响应式状态。
2. 在 `api.ts` 中公开 UI 组件。
3. 根 capability 直接堆平大量方法，缺少局部 capability 分组。
4. 重复传递 `serverSocket`，而不绑定局部上下文。
5. 公开错误类而不是公开错误语义。
6. 只提供 `startRuntime()`，没有 lease / release ownership。
7. 把 wire DTO / transport payload 直接暴露给其他 feature。
8. 子域 `api.ts` 直接包裹 `presentation/store/*` 或 `data/*`，没有中间的 application/state facade。
9. `snake_case` runtime contract 穿透到 `api-types.ts`、`contracts/*` 或跨 feature capability。
10. `application` 向上层泄漏 Vue `Ref`、`computed` 或裸状态容器。
11. `presentation` 以 `*/domain/contracts.ts` 充当组件和页面模型的公共契约源。
12. `composition` 通过 `presentation/*` 拿 gateway / runtime port 类型，导致依赖方向反转。
