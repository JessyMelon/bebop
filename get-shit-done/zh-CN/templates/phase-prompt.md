# 阶段 Prompt 模板

> **注意：** 规划方法位于 `agents/gsd-planner.md`。
> 此模板定义了代理产出的 PLAN.md 输出格式。

用于 `.planning/phases/XX-name/{phase}-{plan}-PLAN.md` 的模板 - 为并行执行优化的可执行阶段计划。

**命名：** 使用 `{phase}-{plan}-PLAN.md` 格式（例如，阶段 1 的计划 2 为 `01-02-PLAN.md`）

---

## 文件模板

```markdown
---
phase: XX-name
plan: NN
type: execute
wave: N                     # 执行波次（1、2、3...）。在规划时预先计算。
depends_on: []              # 此计划依赖的计划 ID（例如，["01-01"]）。
files_modified: []          # 此计划会修改的文件。
autonomous: true            # 若计划包含需要用户交互的检查点，则为 false
requirements: []            # REQUIRED — 此计划覆盖的 ROADMAP 需求 ID。绝不能留空。
user_setup: []              # Claude 无法自动化、需要人工完成的设置（见下文）

# 目标逆推验证（在规划时推导，在执行后验证）
must_haves:
  truths: []                # 为实现目标必须成立的可观察行为
  artifacts: []             # 必须存在且包含真实实现的文件
  key_links: []             # 构件之间的关键连接
---

<objective>
[此计划要完成什么]

目的： [为何这对项目很重要]
产出： [会产出哪些内容]
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
[如果计划包含检查点任务（type="checkpoint:*"），添加：]
@~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# 仅在确实需要时引用前序计划的 SUMMARY：
# - 此计划使用前序计划中的类型/导出
# - 前序计划做出了会影响此计划的决策
# 不要机械串联：计划 02 引 01，计划 03 引 02...

[相关源文件：]
@src/path/to/relevant.ts
</context>

<tasks>

<task type="auto">
  <name>任务 1：[以动作为导向的名称]</name>
  <files>path/to/file.ext, another/file.ext</files>
  <read_first>path/to/reference.ext, path/to/source-of-truth.ext</read_first>
  <action>[具体实现 - 要做什么、如何做、应避免什么以及 WHY。包含具体值：精确标识符、参数、预期输出、文件路径、命令参数。绝不要在未明确目标状态时只说 "align X with Y"。]</action>
  <verify>[证明其生效的命令或检查]</verify>
  <acceptance_criteria>
    - [可通过 Grep 验证的条件："file.ext contains 'exact string'"]
    - [可度量的条件："output.ext uses 'expected-value', NOT 'wrong-value'"]
  </acceptance_criteria>
  <done>[可度量的验收标准]</done>
</task>

<task type="auto">
  <name>任务 2：[以动作为导向的名称]</name>
  <files>path/to/file.ext</files>
  <read_first>path/to/reference.ext</read_first>
  <action>[包含具体值的实现说明]</action>
  <verify>[命令或检查]</verify>
  <acceptance_criteria>
    - [可通过 Grep 验证的条件]
  </acceptance_criteria>
  <done>[验收标准]</done>
</task>

<!-- 检查点任务示例和模式见 @~/.claude/get-shit-done/references/checkpoints.md -->

<task type="checkpoint:decision" gate="blocking">
  <decision>[需要决定什么]</decision>
  <context>[为什么这个决定重要]</context>
  <options>
    <option id="option-a"><name>[名称]</name><pros>[收益]</pros><cons>[权衡]</cons></option>
    <option id="option-b"><name>[名称]</name><pros>[收益]</pros><cons>[权衡]</cons></option>
  </options>
  <resume-signal>Select: option-a or option-b</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[Claude 构建的内容] - 服务器运行于 [URL]</what-built>
  <how-to-verify>访问 [URL] 并验证：[仅视觉检查，不要使用 CLI 命令]</how-to-verify>
  <resume-signal>输入 "approved" 或描述问题</resume-signal>
</task>

</tasks>

<verification>
在声明计划完成前：
- [ ] [具体测试命令]
- [ ] [构建/类型检查通过]
- [ ] [行为验证]
</verification>

<success_criteria>

- 所有任务已完成
- 所有验证检查通过
- 未引入新的错误或警告
- [计划特定标准]
  </success_criteria>

<output>
完成后，创建 `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`
</output>
```

---

## Frontmatter 字段

| 字段 | 必需 | 用途 |
|-------|----------|---------|
| `phase` | 是 | 阶段标识符（例如，`01-foundation`） |
| `plan` | 是 | 阶段内的计划编号（例如，`01`、`02`） |
| `type` | 是 | 标准计划始终为 `execute`，TDD 计划为 `tdd` |
| `wave` | 是 | 执行波次编号（1、2、3...）。在规划时预先计算。 |
| `depends_on` | 是 | 此计划依赖的计划 ID 数组。 |
| `files_modified` | 是 | 此计划会触及的文件。 |
| `autonomous` | 是 | 无检查点时为 `true`，有检查点时为 `false` |
| `requirements` | 是 | **必须** 列出来自 ROADMAP 的需求 ID。每个 roadmap 需求至少要出现在一个计划中。 |
| `user_setup` | 否 | 需要人工完成的设置项数组（外部服务） |
| `must_haves` | 是 | 目标逆推验证标准（见下文） |

**Wave 为预先计算：** 波次编号在 `/gsd-plan-phase` 期间分配。`execute-phase` 直接从 frontmatter 读取 `wave` 并按波次分组计划。无需运行时依赖分析。

**Must-haves 支持验证：** `must_haves` 字段把目标逆推需求从规划传递到执行。所有计划完成后，`execute-phase` 会启动一个验证子代理，对照真实代码库检查这些标准。

---

## 并行 vs 顺序

<parallel_examples>

**Wave 1 候选（并行）：**

```yaml
# 计划 01 - 用户功能
wave: 1
depends_on: []
files_modified: [src/models/user.ts, src/api/users.ts]
autonomous: true

# 计划 02 - 产品功能（与计划 01 无重叠）
wave: 1
depends_on: []
files_modified: [src/models/product.ts, src/api/products.ts]
autonomous: true

# 计划 03 - 订单功能（无重叠）
wave: 1
depends_on: []
files_modified: [src/models/order.ts, src/api/orders.ts]
autonomous: true
```

三者都在并行执行（Wave 1） - 无依赖、无文件冲突。

**顺序执行（真实依赖）：**

```yaml
# 计划 01 - 认证基础
wave: 1
depends_on: []
files_modified: [src/lib/auth.ts, src/middleware/auth.ts]
autonomous: true

# 计划 02 - 受保护功能（需要认证）
wave: 2
depends_on: ["01"]
files_modified: [src/features/dashboard.ts]
autonomous: true
```

Wave 2 的计划 02 要等待 Wave 1 的计划 01 - 它真实依赖认证类型/中间件。

**检查点计划：**

```yaml
# 计划 03 - 带验证的 UI
wave: 3
depends_on: ["01", "02"]
files_modified: [src/components/Dashboard.tsx]
autonomous: false  # 含 checkpoint:human-verify
```

Wave 3 在 Wave 1 和 2 之后运行。到达检查点时暂停，由编排器展示给用户，并在批准后恢复。

</parallel_examples>

---

## Context 部分

**并行执行上下文：**

```markdown
<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# 仅在确实需要时包含 SUMMARY 引用：
# - 此计划导入前序计划中的类型
# - 前序计划做出的决策影响了此计划
# - 前序计划的输出是此计划的输入
#
# 独立计划不需要任何前序 SUMMARY 引用。
# 不要机械串联：02 引 01，03 引 02...

@src/relevant/source.ts
</context>
```

**坏模式（制造伪依赖）：**
```markdown
<context>
@.planning/phases/03-features/03-01-SUMMARY.md  # 只是因为它更早
@.planning/phases/03-features/03-02-SUMMARY.md  # 机械串联
</context>
```

---

## 范围指引

**计划尺寸：**

- 每个计划 2-3 个任务
- 上下文使用量最多约 50%
- 复杂阶段：拆成多个聚焦计划，而不是一个大计划

**何时拆分：**

- 不同子系统（认证 vs API vs UI）
- >3 个任务
- 存在上下文溢出风险
- TDD 候选 - 单独拆成计划

**优先垂直切片：**

```
优先：Plan 01 = 用户（model + API + UI）
      Plan 02 = 产品（model + API + UI）

避免：Plan 01 = 所有模型
      Plan 02 = 所有 API
      Plan 03 = 所有 UI
```

---

## TDD 计划

TDD 功能应使用 `type: tdd` 的专用计划。

**启发式：** 你能否在写 `fn` 之前先写出 `expect(fn(input)).toBe(output)`？
→ 能：创建 TDD 计划
→ 不能：作为标准计划中的标准任务处理

TDD 计划结构见 `~/.claude/get-shit-done/references/tdd.md`。

---

## 任务类型

| Type | 用途 | 自主性 |
|------|---------|----------|
| `auto` | Claude 可以独立完成的一切 | 完全自主 |
| `checkpoint:human-verify` | 视觉/功能验证 | 暂停，返回编排器 |
| `checkpoint:decision` | 实现方案选择 | 暂停，返回编排器 |
| `checkpoint:human-action` | 确实无法避免的手动步骤（少见） | 暂停，返回编排器 |

**并行执行中的检查点行为：**
- 计划运行到检查点为止
- 代理带着检查点详情 + agent_id 返回
- 编排器展示给用户
- 用户响应
- 编排器用 `resume: agent_id` 恢复代理

---

## 示例

**自主并行计划：**

```markdown
---
phase: 03-features
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/features/user/model.ts, src/features/user/api.ts, src/features/user/UserList.tsx]
autonomous: true
---

<objective>
实现完整的 User 功能，作为垂直切片。

目的： 可独立运行、能与其他功能并行推进的用户管理。
产出： User model、API 端点和 UI 组件。
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>
<task type="auto">
  <name>任务 1：创建 User model</name>
  <files>src/features/user/model.ts</files>
  <action>定义包含 id、email、name、createdAt 的 User 类型。导出 TypeScript interface。</action>
  <verify>tsc --noEmit passes</verify>
  <done>User 类型已导出并可用</done>
</task>

<task type="auto">
  <name>任务 2：创建 User API 端点</name>
  <files>src/features/user/api.ts</files>
  <action>GET /users（列表）、GET /users/:id（单个）、POST /users（创建）。使用 model 中的 User 类型。</action>
  <verify>fetch tests pass for all endpoints</verify>
  <done>所有 CRUD 操作可用</done>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] API endpoints respond correctly
</verification>

<success_criteria>
- 所有任务已完成
- User 功能端到端可用
</success_criteria>

<output>
完成后，创建 `.planning/phases/03-features/03-01-SUMMARY.md`
</output>
```

**带检查点的计划（非自主）：**

```markdown
---
phase: 03-features
plan: 03
type: execute
wave: 2
depends_on: ["03-01", "03-02"]
files_modified: [src/components/Dashboard.tsx]
autonomous: false
---

<objective>
构建带视觉验证的 dashboard。

目的： 将 user 和 product 功能整合到统一视图中。
产出： 可工作的 dashboard 组件。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
@~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03-features/03-01-SUMMARY.md
@.planning/phases/03-features/03-02-SUMMARY.md
</context>

<tasks>
<task type="auto">
  <name>任务 1：构建 Dashboard 布局</name>
  <files>src/components/Dashboard.tsx</files>
  <action>创建包含 UserList 和 ProductList 组件的响应式网格。使用 Tailwind 进行样式处理。</action>
  <verify>npm run build succeeds</verify>
  <done>Dashboard 渲染无错误</done>
</task>

<!-- 检查点模式：Claude 启动服务器，用户访问 URL。完整模式见 checkpoints.md。 -->
<task type="auto">
  <name>启动开发服务器</name>
  <action>在后台运行 `npm run dev`，等待就绪</action>
  <verify>fetch http://localhost:3000 returns 200</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Dashboard - 服务器地址为 http://localhost:3000</what-built>
  <how-to-verify>访问 localhost:3000/dashboard。检查：桌面端网格、移动端堆叠、无滚动问题。</how-to-verify>
  <resume-signal>输入 "approved" 或描述问题</resume-signal>
</task>
</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] 已通过视觉验证
</verification>

<success_criteria>
- 所有任务已完成
- 用户已批准视觉布局
</success_criteria>

<output>
完成后，创建 `.planning/phases/03-features/03-03-SUMMARY.md`
</output>
```

---

## 反模式

**坏：机械式依赖串联**
```yaml
depends_on: ["03-01"]  # 只是因为 01 在 02 之前
```

**坏：按水平层分组**
```
Plan 01: 所有 models
Plan 02: 所有 APIs（依赖 01）
Plan 03: 所有 UIs（依赖 02）
```

**坏：缺少 autonomy 标记**
```yaml
# 有检查点但没有 autonomous: false
depends_on: []
files_modified: [...]
# autonomous: ???  <- 缺失！
```

**坏：任务含糊不清**
```xml
<task type="auto">
  <name>设置认证</name>
  <action>给应用添加 auth</action>
</task>
```

**坏：缺少 read_first（执行器修改了未读取的文件）**
```xml
<task type="auto">
  <name>更新数据库配置</name>
  <files>src/config/database.ts</files>
  <!-- 没有 read_first！执行器不了解当前状态或约定 -->
  <action>更新数据库配置以匹配生产环境设置</action>
</task>
```

**坏：验收标准模糊（不可验证）**
```xml
<acceptance_criteria>
  - 配置已正确设置
  - 数据库连接工作正常
</acceptance_criteria>
```

**好：具体，包含 read_first + 可验证标准**
```xml
<task type="auto">
  <name>更新数据库配置以支持连接池</name>
  <files>src/config/database.ts</files>
  <read_first>src/config/database.ts, .env.example, docker-compose.yml</read_first>
  <action>Add pool configuration: min=2, max=20, idleTimeoutMs=30000. Add SSL config: rejectUnauthorized=true when NODE_ENV=production. Add .env.example entry: DATABASE_POOL_MAX=20.</action>
  <acceptance_criteria>
    - database.ts contains "max: 20" and "idleTimeoutMillis: 30000"
    - database.ts contains SSL conditional on NODE_ENV
    - .env.example contains DATABASE_POOL_MAX
  </acceptance_criteria>
</task>
```

---

## 指南

- 始终使用 XML 结构，便于 Claude 解析
- 每个计划都包含 `wave`、`depends_on`、`files_modified`、`autonomous`
- 优先使用垂直切片，而不是水平层
- 仅在确实需要时引用前序 SUMMARY
- 将检查点与相关的自动任务放在同一个计划中
- 每个计划 2-3 个任务，上下文最多约 50%

---

## User Setup（外部服务）

当计划引入需要人工配置的外部服务时，在 frontmatter 中声明：

```yaml
user_setup:
  - service: stripe
    why: "Payment processing requires API keys"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Stripe Dashboard → Developers → API keys → Secret key"
      - name: STRIPE_WEBHOOK_SECRET
        source: "Stripe Dashboard → Developers → Webhooks → Signing secret"
    dashboard_config:
      - task: "Create webhook endpoint"
        location: "Stripe Dashboard → Developers → Webhooks → Add endpoint"
        details: "URL: https://[your-domain]/api/webhooks/stripe"
    local_dev:
      - "stripe listen --forward-to localhost:3000/api/webhooks/stripe"
```

**自动化优先规则：** `user_setup` 中只包含 Claude 确实做不到的事情：
- 账户创建（需要人工注册）
- 获取密钥（需要访问控制台）
- 控制台配置（需要人工在浏览器中操作）

**不应包含：** 安装包、代码变更、文件创建、Claude 可以运行的 CLI 命令。

**结果：** `execute-plan` 会生成 `{phase}-USER-SETUP.md`，供用户按清单完成设置。

完整 schema 和示例见 `~/.claude/get-shit-done/templates/user-setup.md`

---

## Must-Haves（目标逆推验证）

`must_haves` 字段定义了要实现阶段目标，哪些事实必须为 TRUE。它在规划时推导，在执行后验证。

**结构：**

```yaml
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
    - "Messages persist across refresh"
  artifacts:
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
      min_lines: 30
    - path: "src/app/api/chat/route.ts"
      provides: "Message CRUD operations"
      exports: ["GET", "POST"]
    - path: "prisma/schema.prisma"
      provides: "Message model"
      contains: "model Message"
  key_links:
    - from: "src/components/Chat.tsx"
      to: "/api/chat"
      via: "fetch in useEffect"
      pattern: "fetch.*api/chat"
    - from: "src/app/api/chat/route.ts"
      to: "prisma.message"
      via: "database query"
      pattern: "prisma\\.message\\.(find|create)"
```

**字段说明：**

| Field | 用途 |
|-------|---------|
| `truths` | 从用户视角观察到的行为。每一项都必须可测试。 |
| `artifacts` | 必须存在且包含真实实现的文件。 |
| `artifacts[].path` | 相对项目根目录的文件路径。 |
| `artifacts[].provides` | 该构件提供什么。 |
| `artifacts[].min_lines` | 可选。判定为实质性实现所需的最少行数。 |
| `artifacts[].exports` | 可选。用于验证的预期导出。 |
| `artifacts[].contains` | 可选。文件中必须存在的模式。 |
| `key_links` | 构件之间的关键连接。 |
| `key_links[].from` | 源构件。 |
| `key_links[].to` | 目标构件或端点。 |
| `key_links[].via` | 它们如何连接（描述）。 |
| `key_links[].pattern` | 可选。用于验证连接存在的正则。 |

**为什么重要：**

任务完成 ≠ 目标实现。一个“创建聊天组件”的任务，可能只靠生成占位内容就算完成。`must_haves` 字段捕获的是实际必须可用的结果，使验证能够在问题继续扩散前发现缺口。

**验证流程：**

1. `plan-phase` 从阶段目标推导 must_haves（目标逆推）
2. 将 must_haves 写入 PLAN.md frontmatter
3. `execute-phase` 运行所有计划
4. 验证子代理对照代码库检查 must_haves
5. 发现缺口 → 创建修复计划 → 执行 → 重新验证
6. 所有 must_haves 通过 → 阶段完成

验证逻辑见 `~/.claude/get-shit-done/workflows/verify-phase.md`。
