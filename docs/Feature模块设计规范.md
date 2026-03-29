# Feature 模块设计规范

本文档把 `chat` 当前采用的模块设计收敛为仓库级标准，供现有 feature 整理和新 feature 接入复用。

## 1. 目标

- 高内聚：一个 feature 只承载一个清晰业务域。
- 低耦合：跨 feature 不直接依赖内部实现。
- 可读性：目录、命名、注释都直接描述“当前职责”，不描述历史迁移过程。
- 可演进：公开 API 稳定，内部实现可以自由重构。

## 2. 标准分层

推荐结构：

```text
src/features/<feature>/
  api.ts
  api-types.ts            # 若该 feature 需要跨 feature 暴露类型
  README.md
  routes.ts               # 若该 feature 提供页面入口
  application/            # 可选：编排层、跨子域协调逻辑
  contracts/              # 可选：子域之间共享的中立契约
  data/
  di/
  domain/
  integration/            # 可选：对其他 feature 的受控适配层
  mock/
  presentation/
  typechecks/             # 可选：编译期契约检查
  <subfeature>/
```

依赖方向：

```text
presentation -> di -> domain <- data
presentation -> application -> domain <- data
subfeature A -> contracts <- subfeature B
feature internal -> integration -> other-feature/api
```

约束：

- `domain` 不依赖 Vue、Tauri、浏览器 API。
- `data` 只实现 `domain/ports/*`，不反向定义业务规则。
- `presentation` 不直连其他 feature 内部路径。
- 跨 feature 只允许依赖 `@/features/<feature>/api`、`@/features/<feature>/api-types` 或 `shared`。

## 2.1 严格数据流规范

项目整体默认采用以下数据流：

```text
wire dto -> data adapter -> domain model -> application/usecase -> view snapshot/capability -> presentation
```

含义：

- `wire dto`
  - 仅表示外部协议形状。
  - 可以是 HTTP JSON、TCP payload、Tauri command payload、数据库记录等。
- `data adapter`
  - 负责协议请求、错误归一化、DTO 解析、底层 transport 细节。
- `domain model`
  - 表达业务语义，不应携带 transport 细节。
- `application/usecase`
  - 编排领域动作、聚合多个 port、产出对上层稳定的结果。
- `view snapshot/capability`
  - 只服务于上层消费，不回流污染 domain。

仓库级硬约束：

- `domain/ports/*` 禁止直接以 `*Dto`、`*RequestDto`、`*ResponseDto` 作为公开契约。
- `domain/*` 禁止直接依赖 `snake_case` 协议字段命名。
- `data/*` 可以定义和消费 DTO，但 DTO 不应直接穿透到 `api.ts`、`application/*`、`presentation/*`。
- `application/usecase` 的输入输出默认应是领域模型或 feature 内稳定 contract，不应直接返回 wire DTO。
- `presentation` 默认只消费 capability、view snapshot、页面模型，不直接消费 data adapter 返回值。
- `api.ts`、`api-types.ts` 以及子域 `*/api.ts` 不应直接依赖 `presentation/store/*`、`data/*`；如需读取 UI 状态或底层 provider，应先经由 `application/*`、`integration/*` 或明确的 state facade 收敛。
- 跨 feature 或子域公开的稳定 contract 一律使用领域语义命名；`snake_case`、transport payload 字段只能停留在 `data/wire/*`、协议 mapper 或边界 normalizer。
- 当 `application/*` 需要读取 feature 内部 store/runtime 状态时，优先先定义 `contracts/*StateAccess` 一类访问契约，再由 `di/*` 组装具体 adapter；不要让 application 直接导入多个 `presentation/store/*` 进行拼接。

允许的例外：

- 若某个 feature 仍处于整改期，可临时在 feature 内部复用 DTO；
- 但必须把该问题记录到整改清单，并给出移除目标；
- 例外不得提升为跨 feature 公共契约。

推荐命名：

- `XxxWireDto`
- `XxxRecord`
- `XxxDomainModel`
- `XxxViewSnapshot`

避免命名：

- 在 `domain/*` 中直接出现 `Dto`
- 用 `XxxData` 同时指代协议体、领域模型和页面视图

## 3. 公开边界

### 3.1 `api.ts`

`api.ts` 是跨 feature 唯一公开入口。

职责：

- 聚合该 feature 可稳定暴露的能力。
- 对外隐藏 store、runtime、di、data 细节。
- 提供 capability-first 的函数和状态出口，而不是暴露内部目录结构。

不应做的事：

- 不直接导出 `di/*`、`data/*`、`presentation/store/live/*`。
- 不把“临时兼容导出”长期保留在公开面。

公开模式（仓库级强约束）：

- 默认采用 **object-capability**：由 `create<Feature>Capabilities` 返回稳定能力对象。
- 可按需提供 `get<Feature>Capabilities` 作为应用级访问器。
- 不以传统 public class 作为默认公开模式，不鼓励散列式 named exports 长期暴露。
- `api.ts` 公开的是能力，不是实现。

### 3.2 `api-types.ts`

当 feature 需要跨 feature 暴露类型时，新增 `api-types.ts`。

职责：

- 只导出稳定公共类型。
- 隔离内部组合类型、runtime 类型、实现细节类型。

适用场景：

- 子域契约类型需要被外部页面或其他 feature 消费。
- `api.ts` 不应直接把内部 `contracts.ts` 路径暴露给外部。

### 3.3 公开边界收窄策略

仓库进入下一阶段后，公开边界不仅要求“能力化”，还要求“层级最少”。

强约束：

- 跨 feature 默认只允许依赖 feature 根入口：
  - `@/features/<feature>/api`
  - `@/features/<feature>/api-types`
- 子域 `api.ts` 默认只作为 feature 内部组织边界存在，不默认视为跨 feature 稳定入口。
- 若某个子域 `api.ts` 已有更高层 capability 覆盖，则新增消费方不得继续绕过根入口直连子域。
- 若某个低层子域公开的是“更差语义版本”，应优先减少消费面，而不是继续把低层 API 升格为公共标准。

优先保留在根入口的能力：

- 需要跨子域编排的高层命令。
- 已经完成 `Snapshot + Outcome + Lease` 收敛的稳定能力。
- 需要表达完整上下文 ownership 的局部 capability。

优先内收的能力：

- 仅反映内部技术分层的子域入口。
- 已被根 capability 同名或更高语义版本覆盖的低层命令。
- 仍暴露 `Promise<void>`、裸异常、临时 runtime 细节的低层 API。

### 3.3 `README.md`

每个 feature 的 README 至少写清：

- 定位
- 职责边界
- 跨 feature 入口
- 关键概念
- 目录结构
- 关键流程
- 主要入口文件

README 用语要求：

- 优先描述“当前职责”。
- 避免使用“兼容”“旧版”“门面”“不再”这类迁移语气，除非该文档本身就是迁移文档。

### 3.4 详细约束文档

`api.ts` 的能力对象公开模式、允许/禁止项、命名规则、可检查项与迁移策略，见：

- `docs/Feature API公开约束.md`

## 4. composition root

复杂 feature 应有唯一 composition root，统一负责：

- 端口构造
- 用例构造
- runtime/gateway/store 组装
- mock/live/protocol 分流
- 生命周期缓存与复用

常见命名：

- `di/<feature>Runtime.ts`
- `di/<feature>.di.ts`
- `di/<feature>Ports.ts`
- `di/<feature>Usecases.ts`

要求：

- “如何创建”和“何时缓存”分离。
- 不在多个目录分散维护模块级单例。
- 不在 composition root 跳过 usecase 直接把 data adapter 暴露给 presentation。

### 4.1 模板化要求

为提高新 feature 的可读性与可拓展性，后续新增或重构模块时应尽量对齐统一模板：

```text
src/features/<feature>/
  api.ts
  api-types.ts
  README.md
  application/
  contracts/
  data/
  di/
  domain/
  integration/
  mock/
  presentation/
  typechecks/
```

补充要求：

- `README.md` 必须写清“职责 / 不负责 / 根入口 / 子域结构 / 关键数据流”。
- `typechecks/` 至少对根 capability 与关键子 capability 做编译期契约检查。
- `integration/` 只承接“消费其他 feature 根入口”的受控适配，不允许倒流依赖对方内部路径。
- 若 feature 不需要某些目录，可以省略；但不得用其他历史目录名替代其语义。

## 5. 子域拆分

当 feature 足够复杂时，应按业务能力拆分子域，而不是按技术层切块。

推荐做法：

- 每个子域自持自己的 `contracts.ts`。
- 子域公共访问器放在自己的 `api.ts` 或 `presentation/store/*StoreApi.ts`。
- 子域之间若需要共享模型，通过 feature 级 `contracts/` 定义中立契约。

禁止：

- 子域直接持有彼此的大块内部状态容器。
- 为了复用方便，把聚合 store 直接伪装成多个模块。
- 子域 `api.ts` 直接返回响应式 view object。
- 子域 `api.ts` 直接承担 UI 组件出口。

子域公开建议：

- 子域根 capability 只组合若干更小的局部 capability。
- 局部 capability 默认采用 `getSnapshot()/observeSnapshot()/command`。
- 当能力天然依赖上下文时，优先公开 `forXxx()` 局部 capability，而不是平铺多参数函数。
- 子域内部若需要协议模型，协议模型应停留在 `data` 或 `contracts/wire`，不直接进入 `domain/ports`。
- 子域 `api.ts` 优先依赖 `application/*` 或稳定 capability/state facade，不直接包裹 store 本体或 data adapter。
- 若一个 feature 需要把多个 store/runtime 组合成对外能力，优先先下沉为 feature 内部 access contract，再由 application 组织快照与命令；不要在根入口或 application 中直接展开多个 store 细节。

## 6. runtime / store 规范

如果 feature 需要 runtime store：

- 聚合 store 只承载完整状态与动作。
- 子域 store 只暴露最小能力面。
- UI 默认依赖子域 API，只有跨子域联合读取时才访问聚合 store。
- 跨边界默认只公开 plain snapshot，不公开 store/ref/computed。
- feature 根运行时默认公开 lease，而不是公开裸 `startRuntime()`。
- store 若消费远端结果，应优先消费 usecase/application 产出的领域结果或 view snapshot，而不是直接消费 DTO。

推荐命名：

- `*RuntimeStore`
- `*StoreApi`
- `*RuntimePorts`
- `*SharedContext`

避免命名：

- `Facade`
- `Live*` 这种只能表达实现阶段、不能表达职责的历史命名

## 7. 命名规范

命名优先表达职责，不表达设计模式口号。

推荐：

- `createChatRuntimeStore`
- `resolveRoomSessionStore`
- `apiContractChecks`
- `runtimePorts`

避免：

- `FacadeStore`
- `compatBarrel`
- `legacy*`
- `old*`

规则：

- 文件名优先描述“它是什么”。
- 方法名优先描述“它做什么”。
- 若一个词只有理解历史重构的人才看得懂，应该换掉。

## 8. 注释规范

注释目标是帮助第一次读代码的人快速建立模型。

## 9. 下一阶段治理重点

下一阶段的目标不再是“继续拆文件”，而是把当前设计收敛成不会轻易回退的结构标准。

优先级顺序：

1. 公开边界继续收窄。
   - 把跨 feature 消费统一收敛到根 capability。
   - 减少对低层子域 API 的直接依赖。
2. 业务命令结果继续显式化。
   - 把仍由 `Promise<void>` 承担业务成功/拒绝语义的公开命令改成 `Outcome`。
3. 模板化与 typecheck 固化。
   - 让 README、typechecks、命名和目录结构形成统一模板。
4. 页面编排层继续减负。
   - 页面层只消费 capability / page model，不自行拼装多子域流程。

当前明确的高价值整改对象：

- `chat`：继续把 `selectChannel` 一类复合业务动作收敛为显式 `Outcome`。
- `server-connection`：继续减少对 `connectivity/server-info` 低层入口的直接消费。
- `features/*/README.md`：补齐“职责 / 不负责 / 根入口 / 数据流”四段式说明。
- `typechecks/`：为更多 feature 根 capability 增加回归式编译期约束。

要求：

- 注释解释职责边界、装配原因、顺序约束。
- 注释不重复代码表面意思。
- 注释不记录一次性迁移痕迹。

推荐：

- “该文件负责组装 XXX”
- “该函数只暴露 YYY，避免页面误依赖 ZZZ”
- “顺序固定为 1/2/3/4”

避免：

- “兼容导出入口”
- “旧版实现保留”
- “暂时这样做”

数据流注释要求：

- 当某个文件承担 DTO -> domain model 映射时，应在文件头或函数注释中明确写出。
- 若某个层刻意保留协议字段名，必须解释原因和清理计划。

## 9. 其他 feature 协作

复杂 feature 应通过 `integration/` 持有对其他 feature 的受控适配。

目的：

- 把跨 feature import 收敛到单点。
- 避免子模块四处直接依赖外部 feature。
- 为后续替换外部依赖提供缓冲层。

协作约束：

- `integration/` 可以把外部 capability 重新包装成适合本 feature 的局部模型。
- `integration/` 不应把外部 feature 的原始宽 capability 原样继续扩散。
- 若外部能力已经是 `forServer(serverSocket)` 形式，优先在 integration 层尽早绑定上下文。

## 10. 编译期与边界检查

推荐增加：

- `typechecks/*`：编译期 API/contract 检查
- `README.md` 中的跨 feature 约束说明
- `scripts/check-feature-boundaries.sh` 的静态边界校验
- `api.ts` 公开模式检查（是否收敛为 capability object，是否泄漏内部实现）
- `domain` 边界检查：是否直接出现 `Dto`、`snake_case`、transport payload 直通

## 11. chat 作为参考实现

当前 `chat` 是本仓库最接近标准形态的参考实现：

- `chat/api.ts`：聚合公开入口
- `chat/api-types.ts`：稳定公共类型出口
- `chat/di/chatRuntime.ts`：唯一 composition root
- `chat/contracts/`：子域共享中立契约
- `chat/room-session` / `message-flow` / `room-governance`：业务子域拆分
- `chat/typechecks/`：编译期契约检查
- `chat/api.ts`：采用 capability object 聚合 feature 公开面
- `chat` 各子域：继续向“局部 capability + plain snapshot”模式收敛

若其他 feature 结构不清晰，优先按 `chat` 的以下模式靠拢：

1. 先明确公开边界。
2. 再收敛 composition root。
3. 再整理子域和共享契约。
4. 最后统一命名、注释和 README。
