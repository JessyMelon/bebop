# Smart Discuss — Autonomous Mode

Smart discuss 是 `gsd-discuss-phase` 的自主优化变体。它以批量表格形式提出灰色地带问题的答案建议，用户可以按区域接受或覆盖，然后写出与 discuss-phase 产物完全一致的 CONTEXT.md。

**Inputs:** `PHASE_NUM` 来自 execute_phase。运行 init 获取 phase 路径：

```bash
PHASE_STATE=$(gsd-sdk query init.phase-op ${PHASE_NUM})
```

从 JSON 中解析：`phase_dir`, `phase_slug`, `padded_phase`, `phase_name`。

---

## Sub-step 1: Load prior context

读取项目级与前序阶段上下文，避免重复询问已经决定的问题。

**Read project files:**

```bash
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

从中提取：
- **PROJECT.md** — 愿景、原则、不可妥协项、用户偏好
- **REQUIREMENTS.md** — 验收标准、约束、必须项与锦上添花项
- **STATE.md** — 当前进度、截至目前记录的决策

**Read all prior CONTEXT.md files:**

```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

对于每个 phase number 小于当前阶段的 CONTEXT.md：
- 读取 `<decisions>` 段 —— 这些是已锁定偏好
- 读取 `<specifics>` —— 特定参考或“我想要像 X 那样”的时刻
- 注意模式（例如“用户持续偏好极简 UI”“用户拒绝冗长输出”）

**Build internal prior_decisions context**（不要写入文件）：

```
<prior_decisions>
## Project-Level
- [Key principle or constraint from PROJECT.md]
- [Requirement affecting this phase from REQUIREMENTS.md]

## From Prior Phases
### Phase N: [Name]
- [Decision relevant to current phase]
- [Preference that establishes a pattern]
</prior_decisions>
```

如果不存在前序上下文，则直接继续 —— 在早期阶段这是预期情况。

---

## Sub-step 2: Scout Codebase

进行轻量级代码库扫描，以辅助识别灰色区域和生成建议。保持在约 5% 上下文以内。

**Check for existing codebase maps:**

```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**If codebase maps exist:** 读取最相关的那些（按阶段类型选择 CONVENTIONS.md、STRUCTURE.md、STACK.md）。提取可复用组件、既有模式和集成点。然后跳到下面的构建上下文步骤。

**If no codebase maps, do targeted grep:**

从阶段目标中提取关键术语。搜索相关文件：

```bash
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10 || true
ls src/components/ src/hooks/ src/lib/ src/utils/ 2>/dev/null || true
```

读取 3-5 个最相关文件，以理解现有模式。

**Build internal codebase_context**（不要写入文件）：
- **Reusable assets** — 本阶段可复用的现有 components、hooks、utilities
- **Established patterns** — 代码库如何处理 state management、styling、data fetching
- **Integration points** — 新代码接入的位置（routes、nav、providers）

---

## Sub-step 3: Analyze Phase and Generate Proposals

**Get phase details:**

```bash
DETAIL=$(gsd-sdk query roadmap.get-phase ${PHASE_NUM})
```

从 JSON 响应中提取 `goal`, `requirements`, `success_criteria`。

**Infrastructure detection — check FIRST before generating grey areas:**

当以下条件全部为真时，一个阶段属于纯基础设施阶段：
1. 目标关键词命中：“scaffolding”, “plumbing”, “setup”, “configuration”, “migration”, “refactor”, “rename”, “restructure”, “upgrade”, “infrastructure”
2. 并且 success criteria 全部是技术性的：“file exists”, “test passes”, “config valid”, “command runs”
3. 并且没有描述用户可见行为（没有 “users can”, “displays”, “shows”, “presents”）

**If infrastructure-only:** 跳过 Sub-step 4。直接进入 Sub-step 5，写最小化 CONTEXT.md。显示：

```
Phase ${PHASE_NUM}: Infrastructure phase — skipping discuss, writing minimal context.
```

对 CONTEXT.md 使用以下默认值：
- `<domain>`: 来自 ROADMAP goal 的阶段边界
- `<decisions>`: 单个 “### Claude's Discretion” 小节 —— “All implementation choices are at Claude's discretion — pure infrastructure phase”
- `<code_context>`: codebase scout 发现的内容
- `<specifics>`: “No specific requirements — infrastructure phase”
- `<deferred>`: “None”

**If NOT infrastructure — generate grey area proposals:**

根据阶段目标判断领域类型：
- 用户会 **SEE** 的东西 → visual：layout、interactions、states、density
- 用户会 **CALL** 的东西 → interface：contracts、responses、errors、auth
- 用户会 **RUN** 的东西 → execution：invocation、output、behavior modes、flags
- 用户会 **READ** 的东西 → content：structure、tone、depth、flow
- 正在被 **ORGANIZED** 的东西 → organization：criteria、grouping、exceptions、naming

检查 prior_decisions —— 已在前序阶段决定过的灰色区域应跳过。

生成 **3-4 个灰色区域**，每个区域 **约 4 个问题**。对每个问题：
- 基于以下信息 **预选一个推荐答案**：前序决策（一致性）、代码库模式（复用）、领域惯例（标准做法）、ROADMAP success criteria
- 为每个问题生成 **1-2 个备选项**
- 在相关处 **添加注释说明**，包括前序决策上下文（“你在 Phase N 决定了 X”）和代码上下文（“Component Y 已存在且有 Z 个变体”）

---

## Sub-step 4: Present Proposals Per Area

**一次只展示一个**灰色区域。对每个区域（N 个中的第 M 个）：

显示一个表格：

```
### Grey Area {M}/{N}: {Area Name}

| # | Question | ✅ Recommended | Alternative(s) |
|---|----------|---------------|-----------------|
| 1 | {question} | {answer} — {rationale} | {alt1}; {alt2} |
| 2 | {question} | {answer} — {rationale} | {alt1} |
| 3 | {question} | {answer} — {rationale} | {alt1}; {alt2} |
| 4 | {question} | {answer} — {rationale} | {alt1} |
```

然后通过 **AskUserQuestion** 提示用户：
- **header:** `"Area {M}/{N}"`
- **question:** `"Accept these answers for {Area Name}?"`
- **options:** 动态构建 —— 始终把 “Accept all” 放第一位，然后是每个问题对应的 “Change Q1” 到 “Change QN”（最多 4 个），最后放 “Discuss deeper”。显式选项最多 6 个（AskUserQuestion 会自动补一个 “Other”）。

**On "Accept all":** 记录该区域的所有推荐答案。转到下一区域。

**On "Change QN":** 对该具体问题使用 AskUserQuestion 展示备选项：
- **header:** `"{Area Name}"`
- **question:** `"Q{N}: {question text}"`
- **options:** 列出 1-2 个备选项，再加上 “You decide”（映射到 Claude's Discretion）

记录用户选择。重新显示更新后的表格，再重新展示完整的确认提示，让用户可以继续调整或接受。

**On "Discuss deeper":** 仅对该区域切换到交互模式 —— 使用 AskUserQuestion 一次问一个问题，每个问题提供 2-3 个具体选项，再加一个 “You decide”。4 个问题之后，提示：
- **header:** `"{Area Name}"`
- **question:** `"More questions about {area name}, or move to next?"`
- **options:** `"More questions" / "Next area"`

如果选择 “More questions”，再问 4 个。如果选择 “Next area”，显示该区域已记录答案的最终汇总表，然后进入下一区域。

**On "Other"（自由文本）:** 将其解释为具体改动请求或一般性反馈。把内容合并进该区域决策，重新显示更新后的表格，再重新展示确认提示。

**Scope creep handling:** 如果用户提到超出阶段领域的内容：

```
"{Feature} sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to {current area}: {return to current question}"
```

在内部跟踪这些 deferred ideas，以便写入 CONTEXT.md。

---

## Sub-step 5: Write CONTEXT.md

在所有区域都解决后（或基础设施阶段直接跳过讨论），写入 CONTEXT.md 文件。

**File path:** `${phase_dir}/${padded_phase}-CONTEXT.md`

使用 **完全相同** 的结构（与 discuss-phase 输出一致）：

```markdown
# Phase {PHASE_NUM}: {Phase Name} - Context

**Gathered:** {date}
**Status:** Ready for planning

<domain>
## Phase Boundary

{Domain boundary statement from analysis — what this phase delivers}

</domain>

<decisions>
## Implementation Decisions

### {Area 1 Name}
- {Accepted/chosen answer for Q1}
- {Accepted/chosen answer for Q2}
- {Accepted/chosen answer for Q3}
- {Accepted/chosen answer for Q4}

### {Area 2 Name}
- {Accepted/chosen answer for Q1}
- {Accepted/chosen answer for Q2}
...

### Claude's Discretion
{Any "You decide" answers collected — note Claude has flexibility here}

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- {From codebase scout — components, hooks, utilities}

### Established Patterns
- {From codebase scout — state management, styling, data fetching}

### Integration Points
- {From codebase scout — where new code connects}

</code_context>

<specifics>
## Specific Ideas

{Any specific references or "I want it like X" from discussion}
{If none: "No specific requirements — open to standard approaches"}

</specifics>

<deferred>
## Deferred Ideas

{Ideas captured but out of scope for this phase}
{If none: "None — discussion stayed within phase scope"}

</deferred>
```

写入该文件。

**Commit:**

```bash
gsd-sdk query commit "docs(${PADDED_PHASE}): smart discuss context" "${phase_dir}/${padded_phase}-CONTEXT.md"
```

显示确认：

```
Created: {path}
Decisions captured: {count} across {area_count} areas
```
