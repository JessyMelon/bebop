<purpose>
通过体验式探索对一个想法进行 spike，构建聚焦实验，亲手感受未来应用的关键组成，验证可行性，并为真实构建产出已验证的知识。
产物保存到 `.planning/spikes/`。对应 `/gsd-spike-wrap-up` 的配套流程。

支持两种模式：
- **Idea mode**（默认）— 用户描述一个要做 spike 的想法
- **Frontier mode** — 无参数或传入 "frontier" / "what should I spike?" — 分析已有 spike 全景并提出 integration / frontier spikes
</purpose>

<required_reading>
开始前读取 invoking prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="banner">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPIKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

解析 `$ARGUMENTS`：
- `--quick` flag → 设置 `QUICK_MODE=true`
- `--text` flag → 设置 `TEXT_MODE=true`
- `frontier` 或空值 → 设置 `FRONTIER_MODE=true`
- 剩余文本 → 作为要做 spike 的想法

**Text mode：** 如果启用 TEXT_MODE，用纯文本编号列表替换 AskUserQuestion 调用。
</step>

<step name="route">
## 路由

- **FRONTIER_MODE is true** → 跳到 `frontier_mode`
- **否则** → 继续到 `setup_directory`
</step>

<step name="frontier_mode">
## Frontier Mode — 提出下一步该做什么 Spike

### 加载 Spike 全景

如果不存在 `.planning/spikes/` 目录，告诉用户当前没有可分析内容，并提供从一个新想法开始的选项。

否则按以下顺序加载：

**a. MANIFEST.md** — 整体想法、需求，以及带 verdict 的 spike 表格。

**b. Findings skills** — glob `./.claude/skills/spike-findings-*/SKILL.md`，读取所有存在的文件及其 `references/*.md`。这些文件包含之前 wrap-up 整理出的知识。

**c. CONVENTIONS.md** — 如果存在，读取 `.planning/spikes/CONVENTIONS.md`。这里记录了已形成的技术栈和模式。

**d. 所有 spike README** — 读取 `.planning/spikes/*/README.md`，获取 verdict、结果、调查轨迹和 tags。

### 分析 Integration Spikes

审查每一对以及每一组 VALIDATED spikes。查找：

- **Shared resources:** 两个 spike 都涉及同一 API、database、state 或 data format，但它们是分别独立测试的。
- **Data handoffs:** Spike A 产出的输出会被 Spike B 消费。两者格式被假设兼容，但从未被验证。
- **Timing/ordering:** 单独运行都可行，但在真实流程中存在时序依赖的 spikes。
- **Resource contention:** 单独运行没问题，但组合后可能争抢连接、内存、速率限制或 tokens 的 spikes。

如果存在 integration 风险，把它们作为具体的候选 spikes 展示出来，给出名称和 Given/When/Then 验证问题。如果没有有意义的 integration 风险，明确说明并跳过这一类。

### 分析 Frontier Spikes

围绕 MANIFEST.md 中的整体想法以及目前已验证的内容，横向思考。考虑：

- **Gaps in the vision:** 被默认假设存在但尚未验证的能力。
- **Discovered dependencies:** 现有发现暴露出的新问题。
- **Alternative approaches:** 针对 PARTIAL 或 INVALIDATED spikes 的不同思路。
- **Adjacent capabilities:** 如果可行，会显著增强该想法的相邻能力。
- **Comparison opportunities:** 已可行但显得过重的方案，是否值得比较替代实现。

将 frontier spikes 作为具体提案展示，编号从现有最大 spike 编号继续递增，并附带 Given/When/Then 与风险排序。

### 对齐并执行

展示所有 integration 和 frontier 候选项，然后询问要运行哪些。用户选定后，将定义写入 `.planning/spikes/MANIFEST.md`（追加到现有表格），并直接从 `research` 开始构建。
</step>

<step name="setup_directory">
如果 `.planning/spikes/` 不存在，则创建：

```bash
mkdir -p .planning/spikes
```

检查现有 spikes 以确定编号：
```bash
ls -d .planning/spikes/[0-9][0-9][0-9]-* 2>/dev/null | sort | tail -1
```

检查 `commit_docs` 配置：
```bash
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
```
</step>

<step name="detect_stack">
检查项目技术栈，以便为 spike 选择合适技术。

**先检查 conventions。** 如果存在 `.planning/spikes/CONVENTIONS.md`，优先遵循其中的技术栈和模式，这些代表用户已经验证并希望延续的选择。

**然后检查项目现有技术栈：**
```bash
ls package.json pyproject.toml Cargo.toml go.mod 2>/dev/null
```

默认使用项目已有的 language/framework。对于没有 conventions、也没有现有技术栈的 greenfield 项目，选择能最快得到可运行结果的方案。

除非 spike 明确需要，否则避免：
- 超出 `npm install` 或 `pip install` 范围的复杂 package management
- Build tools、bundlers 或 transpilers
- Docker、containers 或 infrastructure
- Env files 或 config systems，一律直接硬编码
</step>

<step name="load_prior_context">
如果 `.planning/spikes/` 已有内容，按以下优先级加载上下文：

**a. Conventions:** 如果存在，读取 `.planning/spikes/CONVENTIONS.md`。

**b. Findings skills:** Glob `./.claude/skills/spike-findings-*/SKILL.md`，读取所有存在的文件及其 `references/*.md`。

**c. Manifest:** 读取 `.planning/spikes/MANIFEST.md` 作为所有 spikes 的索引。

**d. Related READMEs:** 基于新想法，通过匹配 tags、名称、技术或领域重叠来识别相关的历史 spikes。只读取这些 `.planning/spikes/*/README.md`，跳过无关内容。

与这整套已有工作交叉对照：
- **跳过已被验证的问题。** 标明之前的 spike 编号后继续。
- **建立在已有发现之上。** 不要重复失败方案。使用它们的 Research 和 Results 部分。
- **复用已有研究。** 传承已有发现，而不是重新调研。
- **遵循既有 conventions。** 如有偏离，要明确说明。
- **在呈现拆解方案时指出相关 prior art。**

如果不存在 `.planning/spikes/`，跳过此步骤。
</step>

<step name="decompose">
**如果 `QUICK_MODE` 为 true：** 跳过拆解与对齐。将用户想法视为一个单独的 spike 问题。分配下一个可用编号。跳到 `research`。

将想法拆成 2-5 个独立问题。每个问题都用 Given/When/Then 表述。用表格展示：

```
| # | Spike | Type | Validates (Given/When/Then) | Risk |
|---|-------|------|-----------------------------|------|
| 001 | websocket-streaming | standard | Given a WS connection, when LLM streams tokens, then client receives chunks < 100ms | **High** |
| 002a | pdf-parse-pdfjs | comparison | Given a multi-page PDF, when parsed with pdfjs, then structured text is extractable | Medium |
| 002b | pdf-parse-camelot | comparison | Given a multi-page PDF, when parsed with camelot, then structured text is extractable | Medium |
```

**Spike types:**
- **standard** — 一个方案回答一个问题
- **comparison** — 同一个问题，对比不同方案。共享编号并使用字母后缀。

好的 spikes：具体的可行性问题，并且有可观察输出。
差的 spikes：范围过大、没有可观察输出，或只是阅读/规划。

按风险排序，最可能直接否定这个想法的先做。
</step>

<step name="align">
**如果 `QUICK_MODE` 为 true：** 跳过。

╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                               ║
╚══════════════════════════════════════════════════════════════╝

{spike table from decompose step}

──────────────────────────────────────────────────────────────
→ 按这个顺序全部构建，还是调整列表？
──────────────────────────────────────────────────────────────
</step>

<step name="research">
## 每个 Spike 开始前的研究与简报

这一步会在**每一个 spike 之前执行**，而不是只在最开始执行一次。

**a. 展示 spike 简报：**

> **Spike NNN: Descriptive Name**
> [2-3 句话：这个 spike 是什么、为什么重要、关键风险或未知点是什么。]

**b. 研究当前最佳实践。** 对 libraries/frameworks 使用 context7（resolve-library-id → query-docs）。对没有 context7 条目的 APIs/services 使用 web search。读取真实文档。

**c. 列出竞争方案**，用表格展示：

| Approach | Tool/Library | Pros | Cons | Status |
|----------|-------------|------|------|--------|
| ... | ... | ... | ... | ... |

**Chosen approach:** [选哪个，以及原因]

如果存在 2 个以上可信方案，计划在 spike 内构建快速变体并进行比较。

**d. 将研究发现记录到 README 的 `## Research` 部分。**

**若无必要可跳过**，例如没有外部依赖的纯逻辑问题。
</step>

<step name="create_manifest">
创建或更新 `.planning/spikes/MANIFEST.md`：

```markdown
# Spike Manifest

## Idea
[一段话描述当前正在探索的整体想法]

## Requirements
[用户在 spiking 过程中作出的选择所形成的设计决策。对真实构建不可妥协。随着 spikes 推进持续更新。]

- [e.g., "Must use streaming JSON output, not single-response"]
- [e.g., "Must support reconnection on network failure"]

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
```

**随着需求出现就立即记录。** 当用户在 spiking 过程中表达偏好时，立刻把它加入 Requirements section。
</step>

<step name="reground">
## 每个 Spike 前重新对齐

在开始每个 spike 前（不只是第一个），重新读取 `.planning/spikes/MANIFEST.md` 和 `.planning/spikes/CONVENTIONS.md`，避免长会话中逐渐偏离。检查 Requirements section，确保当前 spike 不会与已建立的 requirements 相冲突。
</step>

<step name="build_spikes">
## 依次构建每个 Spike

**深度优先于速度。** 目标是真正理解，而不是快速下结论。绝不要因为一次 happy-path 测试通过就宣布 VALIDATED。要追踪意外发现，测试边界情况，记录调查轨迹，而不只是结论。

**Comparison spikes** 使用共享编号加字母后缀：`NNN-a-name` / `NNN-b-name`。先背靠背实现，再正面对比。

### 对每个 Spike：

**a.** 创建 `.planning/spikes/NNN-descriptive-name/`

**b.** 默认要给用户一个能亲自体验的东西。优先构建简单 UI 或交互式 demo，而不是只把 stdout 给 Claude 看。用户想要的是*亲自感受到* spike 在工作，而不只是被告知它能工作。

**默认做法是：构建一个用户可交互的东西。** 可以是：
- 一个简单 HTML 页面，以可视方式展示结果
- 一个带按钮的 web UI，触发动作并展示响应
- 一个展示数据流过某条 pipeline 的页面
- 一个最小界面，让用户尝试不同输入并看到输出

**只有当 spike 真正关心的是事实，而不是体验时，才退回到 stdout/CLI 验证：**
- 纯数据转换，结论只是“能否正确解析”
- 二元 yes/no 问题（这个 API 是否能认证？这个 library 是否存在？）
- Benchmark 数字（X 有多快？Y 占多少内存？）

拿不准时，就做 UI。多花几分钟，但能产出用户可演示、也更有信心的 spike。

**如果 spike 需要运行时可观测性，** 构建一层 forensic log：
1. 带 ISO 时间戳和分类 tags 的事件日志数组
2. 导出机制（server: GET endpoint，CLI: JSON file，browser: Export button）
3. 日志总结（事件计数、耗时、错误、元数据）
4. 如果日志量值得，就加分析辅助工具

**c.** 编写代码。先从最简单版本开始，再逐步加深。

**d.** 如果发现值得继续深入，就继续迭代：
- **出现意外现象？** 补一个后续测试，隔离并深入探索。
- **答案显得太浅？** 继续 probing 边界情况，大输入、并发请求、畸形数据、网络失败。
- **假设错了？** 调整方案，并在 README 中记录转向。

复杂问题下，一个 spike 有多个文件是正常的（例如 `test-basic.js`、`test-edge-cases.js`、`benchmark.js`）。

**e.** 写入带 YAML frontmatter 的 `README.md`：

```markdown
---
spike: NNN
name: descriptive-name
type: standard
validates: "Given [precondition], when [action], then [expected outcome]"
verdict: PENDING
related: []
tags: [tag1, tag2]
---

# Spike NNN: Descriptive Name

## What This Validates
[Given/When/Then]

## Research
[查过哪些文档、方案比较表、选定方案、gotchas。若无外部依赖可省略。]

## How to Run
[Command(s)]

## What to Expect
[具体、可观察的结果]

## Observability
[如果存在 forensic log layer，则写在这里；否则省略。]

## Investigation Trail
[随着 spike 推进持续更新。记录每次迭代：尝试了什么、发现了什么、下一步又尝试了什么。]

## Results
[Verdict、证据、意外发现、log analysis findings。]
```

**f.** 静默地自动关联 related spikes。

**g.** 运行并验证：
- 可自证：运行、在发现值得深入时继续迭代、更新 verdict
- 需要人工判断：展示 checkpoint box：

╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                           ║
╚══════════════════════════════════════════════════════════════╝

**Spike {NNN}: {name}**
**How to run:** {command}
**What to expect:** {concrete outcomes}

──────────────────────────────────────────────────────────────
→ 这和你的预期一致吗？请描述你看到的现象。
──────────────────────────────────────────────────────────────

**h.** 用该 spike 的一行记录更新 `.planning/spikes/MANIFEST.md`。

**i.** 提交（如果 `COMMIT_DOCS` 为 true）：
```bash
gsd-sdk query commit "docs(spike-NNN): [VERDICT] — [key finding]" .planning/spikes/NNN-descriptive-name/ .planning/spikes/MANIFEST.md
```

**j.** 汇报：
```
◆ Spike NNN: {name}
  Verdict: {VALIDATED ✓ / INVALIDATED ✗ / PARTIAL ⚠}
  Key findings: {不只是 verdict，还包括调查轨迹、意外发现、已探索的边界情况}
  Impact: {对剩余 spikes 的影响}
```

不要急着下结论。一个只写着“VALIDATED — it works”的 spike，几乎总是不完整的。

**k.** 如果核心假设被否定：

╔══════════════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                               ║
╚══════════════════════════════════════════════════════════════╝

Core assumption invalidated by Spike {NNN}.
{哪项核心假设被否定，以及原因}

──────────────────────────────────────────────────────────────
→ 继续剩余 spikes / Pivot approach / Abandon
──────────────────────────────────────────────────────────────
</step>

<step name="update_conventions">
## 更新 Conventions

在本次会话中的所有 spikes 都完成后，用本轮形成或被强化的模式更新 `.planning/spikes/CONVENTIONS.md`。

```markdown
# Spike Conventions

跨多个 spike 会话形成的模式和技术栈选择。除非问题本身要求不同，否则新的 spikes 都遵循这些约定。

## Stack
[前端、后端、脚本分别使用什么，以及原因]

## Structure
[常见文件布局、端口分配、命名模式]

## Patterns
[反复出现的方法：auth 如何处理、styling 如何处理、serving 如何处理]

## Tools & Libraries
[优先使用且已验证可行的 packages 及版本，以及需要避免的项]
```

只纳入在 2 个以上 spikes 中重复出现，或由用户明确选择的模式。如果 `CONVENTIONS.md` 已存在，则用本次会话的新模式更新各 section。

提交（如果 `COMMIT_DOCS` 为 true）：
```bash
gsd-sdk query commit "docs(spikes): update conventions" .planning/spikes/CONVENTIONS.md
```
</step>

<step name="report">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SPIKE COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Verdicts

| # | Name | Type | Verdict |
|---|------|------|---------|
| 001 | {name} | standard | ✓ VALIDATED |
| 002a | {name} | comparison | ✓ WINNER |

## Key Discoveries
{意外发现、gotchas、调查轨迹中的高价值结论}

## Feasibility Assessment
{整体可行性评估}

## Signal for the Build
{该用什么、该避免什么、需要关注什么}
```

───────────────────────────────────────────────────────────────

## ▶ Next Up

**整理发现** — 将 spike 知识打包为实现蓝图

`/gsd-spike-wrap-up`

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd-spike` — 继续对更多想法做 spike（或不带参数运行进入 frontier mode）
- `/gsd-plan-phase` — 开始规划真实实现
- `/gsd-explore` — 继续探索这个想法

───────────────────────────────────────────────────────────────
</step>

</process>

<success_criteria>
- [ ] 已创建 `.planning/spikes/`（如有需要自动创建，无需先初始化项目）
- [ ] 在开始构建前已查阅已有 spikes 和 findings skills
- [ ] 已遵循 conventions（或已记录偏离原因）
- [ ] 每个 spike 在编码前都已基于当前文档完成 research grounding
- [ ] 深度优先于速度：已测试边界情况、追踪意外发现、记录调查轨迹
- [ ] comparison spikes 已背靠背构建并给出正面对比 verdict
- [ ] 需要人工交互的 spikes 具备 forensic log layer
- [ ] 来自用户选择的 requirements 已随着出现被记录到 MANIFEST.md
- [ ] 已创建或更新 CONVENTIONS.md，记录形成的模式
- [ ] 每个 spike README 都包含完整 frontmatter、Investigation Trail 和 Results
- [ ] MANIFEST.md 保持最新（包含 Type 列和 Requirements section）
- [ ] 提交使用 `docs(spike-NNN): [VERDICT]` 格式
- [ ] 已展示汇总报告及下一步路由
</success_criteria>
