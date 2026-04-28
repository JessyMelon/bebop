<purpose>
提取下游 agents 需要的实现决策，方式是优先分析代码库并暴露假设，
而不是像采访一样连环提问。

你是思考搭档，不是采访者。要深入分析代码库，基于证据说明你的判断，
只在结论有误时让用户纠正。
</purpose>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-assumptions-analyzer — 分析代码库并暴露实现假设
</available_agent_types>

<downstream_awareness>
**CONTEXT.md 会作为以下输入：**

1. **gsd-phase-researcher** — 读取 CONTEXT.md 了解要研究什么
2. **gsd-planner** — 读取 CONTEXT.md 了解哪些决策已经确定

**你的职责：** 把决策记录得足够清晰，让下游 agents 可以据此行动，
无需再次向用户提问。输出与 discuss mode 完全一致，使用同样的 CONTEXT.md 格式。
</downstream_awareness>

<philosophy>
**Assumptions mode 的理念：**

用户是愿景提出者，不是代码库考古学家。他们需要的是足够的上下文来判断
你的假设是否符合其意图，而不是回答那些你本可以通过读代码弄清的问题。

- 先读代码库，再形成判断，只对真正不清楚的地方提问
- 每个假设都必须引用证据（文件路径、发现的模式）
- 每个假设都必须说明如果判断错了会有什么后果
- 尽量减少用户交互：约 2-4 次纠正，而不是 15-20 个问题
</philosophy>

<scope_guardrail>
**关键：不要范围蔓延。**

phase 边界来自 ROADMAP.md，且是固定的。讨论只澄清如何实现
已在范围内的内容，绝不讨论是否要新增能力。

当用户提出范围蔓延时：
"[Feature X] would be a new capability — that's its own phase.
Want me to note it for the roadmap backlog? For now, let's focus on [phase domain]."

把这个想法记录到 "Deferred Ideas"。不要丢，也不要执行。
</scope_guardrail>

<answer_validation>
**重要：答案校验** — 每次调用 AskUserQuestion 后，检查响应是否为空
或只包含空白。如果是：
1. 用相同参数重试一次
2. 如果仍为空，则将选项显示为纯文本编号列表

**Text mode (`workflow.text_mode: true` in config or `--text` flag)：**
当 text mode 激活时，完全不要使用 AskUserQuestion。把每个问题都显示为
纯文本编号列表，并要求用户输入选项编号。
</answer_validation>

<process>

<step name="initialize" priority="first">
从参数中获取阶段编号（必填）。

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ANALYZER=$(gsd-sdk query agent-skills gsd-assumptions-analyzer 2>/dev/null)
```

解析 JSON，获取：`commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`,
`phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`,
`plan_count`, `roadmap_exists`, `planning_exists`。

**如果 `phase_found` 为 false：**
```
Phase [X] not found in roadmap.

Use /gsd-progress to see available phases.
```
退出 workflow。

**如果 `phase_found` 为 true：** 继续到 check_existing。

**Auto mode** — 如果 ARGUMENTS 中包含 `--auto`：
- 在 `check_existing` 中：如果已有 context，则自动选择 "Update it"；否则不提示直接继续
- 在 `present_assumptions` 中：跳过确认闸门，直接写入 CONTEXT.md
- 在 `correct_assumptions` 中：为每个纠正项自动选择推荐选项
- 将每个自动选择以内联方式记录
- 完成后自动进入 plan-phase
</step>

<step name="check_existing">
使用 init 中的 `has_context` 检查是否已存在 CONTEXT.md。

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**如果存在：**

**如果是 `--auto`：** 自动选择 "Update it"。记录：`[auto] Context exists — updating with assumption-based analysis.`

**否则：** 使用 AskUserQuestion：
- header: "Context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — 重新分析代码库并刷新假设
  - "View it" — 先看看现有内容
  - "Skip" — 直接使用现有 context

如果选择 "Update"：加载现有内容，继续到 load_prior_context
如果选择 "View"：显示 CONTEXT.md，然后提供 update/skip
如果选择 "Skip"：退出 workflow

**如果不存在：**

检查 init 中的 `has_plans` 和 `plan_count`。**如果 `has_plans` 为 true：**

**如果是 `--auto`：** 自动选择 "Continue and replan after"。记录：`[auto] Plans exist — continuing with assumption analysis, will replan after.`

**否则：** 使用 AskUserQuestion：
- header: "Plans exist"
- question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
- options:
  - "Continue and replan after"
  - "View existing plans"
  - "Cancel"

如果选择 "Continue and replan after"：继续到 load_prior_context。
如果选择 "View existing plans"：显示 plan files，然后提供 "Continue" / "Cancel"。
如果选择 "Cancel"：退出 workflow。

**如果 `has_plans` 为 false：** 继续到 load_prior_context。
</step>

<step name="load_prior_context">
读取项目级和前置 phase 的上下文，避免重复问已经定下来的问题。

**Step 1: 读取项目级文件**
```bash
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

从这些文件中提取：
- **PROJECT.md** — 愿景、原则、不可妥协项、用户偏好
- **REQUIREMENTS.md** — 验收标准、约束条件
- **STATE.md** — 当前进度、任何标记

**Step 2: 读取之前所有的 CONTEXT.md 文件**
```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

对于 phase 编号小于当前 phase 的每个 CONTEXT.md：
- 读取 `<decisions>` section — 这些是已经锁定的偏好
- 读取 `<specifics>` — 特定参考或 "I want it like X" 这类信息
- 记录模式（例如："user consistently prefers minimal UI"）

**Step 3: 构建内部 `<prior_decisions>` 上下文**

整理提取出的信息，供后续生成假设使用。

**如果不存在 prior context：** 不做特殊处理，直接继续，这在早期 phase 很正常。
</step>

<step name="cross_reference_todos">
检查是否有待办事项与此 phase 的范围相关。

```bash
TODO_MATCHES=$(gsd-sdk query todo.match-phase "${PHASE_NUMBER}")
```

解析 JSON，获取：`todo_count`, `matches[]`。

**如果 `todo_count` 为 0：** 静默跳过。

**如果找到匹配项：** 展示匹配到的 todos，使用 AskUserQuestion（multiSelect）将相关项折叠进范围。

**对于被选中（折叠）的 todos：** 存为 `<folded_todos>`，用于 CONTEXT.md 的 `<decisions>` section。
**对于未选中的：** 存为 `<reviewed_todos>`，用于 CONTEXT.md 的 `<deferred>` section。

**Auto mode (`--auto`)：** 自动折叠所有 score >= 0.4 的 todos，并记录选择结果。
</step>

<step name="load_methodology">
如果存在项目级 methodology 文件，则读取。必须在假设分析前完成，
这样激活的 lens 才能影响假设的生成与评估。

```bash
cat .planning/METHODOLOGY.md 2>/dev/null || true
```

**如果存在 METHODOLOGY.md：**
- 解析每个具名 lens：其 diagnoses、recommendations、triggering conditions
- 存为内部 `<active_lenses>`，供 deep_codebase_analysis 和 present_assumptions 使用
- 启动 gsd-assumptions-analyzer 时传入 lens 列表，以便标记哪些 lens 适用
- 展示假设时，追加一个 "Methodology" section，显示应用了哪些 lens，
  以及它们指出了什么（如果有）

**如果不存在 METHODOLOGY.md：** 静默跳过。该产物是可选的。
</step>

<step name="scout_codebase">
轻量扫描现有代码，为生成假设提供依据。

**Step 1: 检查是否已有 codebase maps**
```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**如果存在 codebase maps：** 读取相关文件（CONVENTIONS.md、STRUCTURE.md、STACK.md）。提取可复用组件、模式、集成点。跳到 Step 3。

**Step 2: 如果没有 codebase maps，则做定向 grep**

从 phase 目标提取关键词，搜索相关文件。

```bash
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

读取最相关的 3-5 个文件。

**Step 3: 构建内部 `<codebase_context>`**

识别可复用资产、既有模式、集成点和可行的创意选项。存入内部，供 deep_codebase_analysis 使用。
</step>

<step name="deep_codebase_analysis">
启动一个 `gsd-assumptions-analyzer` agent，对该 phase 的代码库做深度分析。这样可以避免把原始文件内容全部塞进主上下文窗口，节省 token 预算。

**解析 calibration tier（如果存在 USER-PROFILE.md）：**

```bash
PROFILE_PATH="$HOME/.claude/get-shit-done/USER-PROFILE.md"
```

如果 PROFILE_PATH 处存在该文件：
- Priority 1: 读取 config.json > preferences.vendor_philosophy（项目级覆盖）
- Priority 2: 读取 USER-PROFILE.md 中的 Vendor Choices/Philosophy rating（全局）
- Priority 3: 默认使用 "standard"

映射到 calibration tier：
- conservative OR thorough-evaluator → full_maturity（更多备选方案、更详细证据）
- opinionated → minimal_decisive（更少备选方案、更果断的推荐）
- pragmatic-fast OR 其他任何值 → standard

如果没有 USER-PROFILE.md：calibration_tier = "standard"

**启动 Explore subagent：**

```
Task(subagent_type="gsd-assumptions-analyzer", prompt="""
Analyze the codebase for Phase {PHASE}: {phase_name}.

Phase goal: {roadmap_description}
Prior decisions: {prior_decisions_summary}
Codebase scout hints: {codebase_context_summary}
Calibration: {calibration_tier}

Your job:
1. Read ROADMAP.md phase {PHASE} description
2. Read any prior CONTEXT.md files from earlier phases
3. Glob/Grep for files related to: {phase_relevant_terms}
4. Read 5-15 most relevant source files
5. Return structured assumptions

## Output Format

Return EXACTLY this structure:

## Assumptions

### [Area Name] (e.g., "Technical Approach")
- **Assumption:** [Decision statement]
  - **Why this way:** [Evidence from codebase — cite file paths]
  - **If wrong:** [Concrete consequence of this being wrong]
  - **Confidence:** Confident | Likely | Unclear

(3-5 areas, calibrated by tier:
- full_maturity: 3-5 areas, 2-3 alternatives per Likely/Unclear item
- standard: 3-4 areas, 2 alternatives per Likely/Unclear item
- minimal_decisive: 2-3 areas, decisive single recommendation per item)

## Needs External Research
[Topics where codebase alone is insufficient — library version compatibility,
ecosystem best practices, etc. Leave empty if codebase provides enough evidence.]

${AGENT_SKILLS_ANALYZER}
""")
```

解析 subagent 的响应，提取：
- `assumptions[]` — 每项包含 area、statement、evidence、consequence、confidence
- `needs_research[]` — 需要外部研究的主题（可为空）

**初始化 canonical refs 累加器：**
- 来源 1：复制此 phase 在 ROADMAP.md 中的 `Canonical refs:`，并展开为完整路径
- 来源 2：检查 REQUIREMENTS.md 和 PROJECT.md 中引用的 specs/ADRs
- 来源 3：加入 codebase scout 结果中引用的任何文档
</step>

<step name="external_research">
**如果满足以下条件则跳过：** deep_codebase_analysis 中的 `needs_research` 为空。

如果标记了需要研究的主题，则启动一个通用 research agent：

```
Task(subagent_type="general-purpose", prompt="""
Research the following topics for Phase {PHASE}: {phase_name}.

Topics needing research:
{needs_research_content}

For each topic, return:
- **Finding:** [What you learned]
- **Source:** [URL or library docs reference]
- **Confidence impact:** [Which assumption this resolves and to what confidence level]

Use Context7 (resolve-library-id then query-docs) for library-specific questions.
Use WebSearch for ecosystem/best-practice questions.
""")
```

将研究结果合并回假设中：
- 当研究消除歧义时，更新 confidence levels
- 给受影响的假设添加 source attribution
- 保存研究结果，供 DISCUSSION-LOG.md 使用

**如果没有标记出缺口：** 完全跳过。大多数 phase 都会跳过这一步。
</step>

<step name="present_assumptions">
按 area 分组展示所有假设，并附上 confidence 标记。

**展示格式：**

```
## Phase {PHASE}: {phase_name} — Assumptions

Based on codebase analysis, here's what I'd go with:

### {Area Name}
{Confidence badge} **{Assumption statement}**
↳ Evidence: {file paths cited}
↳ If wrong: {consequence}

### {Area Name 2}
...

[If external research was done:]
### External Research Applied
- {Topic}: {Finding} (Source: {URL})
```

**如果是 `--auto`：**
- 如果所有假设都是 Confident 或 Likely：记录假设，跳到 write_context。
  记录：`[auto] All assumptions Confident/Likely — proceeding to context capture.`
- 如果存在 Unclear 假设：记录警告，并为
  每个 Unclear 项自动选择推荐备选方案。记录：`[auto] {N} Unclear assumptions auto-resolved with recommended defaults.`
  然后继续到 write_context。

**否则：** 使用 AskUserQuestion：
- header: "Assumptions"
- question: "These all look right?"
- options:
  - "Yes, proceed" — 用这些假设作为决策写入 CONTEXT.md
  - "Let me correct some" — 选择要修改的假设

**如果选择 "Yes, proceed"：** 跳到 write_context。
**如果选择 "Let me correct some"：** 继续到 correct_assumptions。
</step>

<step name="correct_assumptions">
上面的 present_assumptions 已经展示了这些假设。

展示一个 multiSelect，其中每个选项的 label 为假设陈述，description
为 "If wrong" 后果：

使用 AskUserQuestion（multiSelect）：
- header: "Corrections"
- question: "Which assumptions need correcting?"
- options: [每个假设一个选项，label = assumption statement，description = "If wrong: {consequence}"]

对每个选中的纠正项，只问 **一个** 聚焦问题：

使用 AskUserQuestion：
- header: "{Area Name}"
- question: "What should we do instead for: {assumption statement}?"
- options: [2-3 个具体备选方案，描述用户可见结果，推荐选项放在最前]

记录每个纠正：
- 原始假设
- 用户选择的替代方案
- 原因（若通过 "Other" 自由文本提供）

处理完所有纠正后，使用更新后的假设继续到 write_context。

**Auto mode：** 不应到达此步骤（`--auto` 会从 present_assumptions 跳过）。
</step>

<step name="write_context">
如有需要，先创建 phase 目录。使用标准 6-section 格式写入 CONTEXT.md。

**文件：** `${phase_dir}/${padded_phase}-CONTEXT.md`

将假设映射到 CONTEXT.md sections：
- 假设 → `<decisions>`（每个假设变成一个锁定决策：D-01、D-02 等）
- 纠正项 → 覆盖 `<decisions>` 中的原始假设
- 所有假设都为 Confident 的 area → 标记为锁定决策
- 有纠正项的 area → 将用户选择的替代方案作为决策
- 被折叠的 todos → 放入 `<decisions>` 中的 "### Folded Todos"

```markdown
# Phase {PHASE}: {phase_name} - Context

**Gathered:** {date} (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

{Domain boundary from ROADMAP.md — clear statement of scope anchor}
</domain>

<decisions>
## Implementation Decisions

### {Area Name 1}
- **D-01:** {Decision — from assumption or correction}
- **D-02:** {Decision}

### {Area Name 2}
- **D-03:** {Decision}

### Claude's Discretion
{Any assumptions where the user confirmed "you decide" or left as-is with Likely confidence}

### Folded Todos
{If any todos were folded into scope}
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

{Accumulated canonical refs from analyze step — full relative paths}

[If no external specs: "No external specs — requirements fully captured in decisions above"]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
{From codebase scout + Explore subagent findings}

### Established Patterns
{Patterns that constrain/enable this phase}

### Integration Points
{Where new code connects to existing system}
</code_context>

<specifics>
## Specific Ideas

{Any particular references from corrections or user input}

[If none: "No specific requirements — open to standard approaches"]
</specifics>

<deferred>
## Deferred Ideas

{Ideas mentioned during corrections that are out of scope}

### Reviewed Todos (not folded)
{Todos reviewed but not folded — with reason}

[If none: "None — analysis stayed within phase scope"]
</deferred>
```

写入文件。
</step>

<step name="write_discussion_log">
写入假设与纠正的审计轨迹。

**文件：** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# Phase {PHASE}: {phase_name} - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** {ISO date}
**Phase:** {padded_phase}-{phase_name}
**Mode:** assumptions
**Areas analyzed:** {comma-separated area names}

## Assumptions Presented

### {Area Name}
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| {Statement} | {Confident/Likely/Unclear} | {file paths} |

{Repeat for each area}

## Corrections Made

{If corrections were made:}

### {Area Name}
- **Original assumption:** {what Claude assumed}
- **User correction:** {what the user chose instead}
- **Reason:** {user's rationale, if provided}

{If no corrections: "No corrections — all assumptions confirmed."}

## Auto-Resolved

{If --auto and Unclear items existed:}
- {Assumption}: auto-selected {recommended option}

{If not applicable: omit this section}

## External Research

{If research was performed:}
- {Topic}: {Finding} (Source: {URL})

{If no research: omit this section}
```

写入文件。
</step>

<step name="git_commit">
提交 phase context 和 discussion log：

```bash
gsd-sdk query commit "docs(${padded_phase}): capture phase context (assumptions mode)" "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
```

确认："Committed: docs(${padded_phase}): capture phase context (assumptions mode)"
</step>

<step name="update_state">
用 session 信息更新 STATE.md：

```bash
gsd-sdk query state.record-session \
  --stopped-at "Phase ${PHASE} context gathered (assumptions mode)" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

提交 STATE.md：

```bash
gsd-sdk query commit "docs(state): record phase ${PHASE} context session" .planning/STATE.md
```
</step>

<step name="confirm_creation">
展示摘要和下一步：

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured (Assumptions Mode)

### {Area Name}
- {Key decision} (from assumption / corrected)

{Repeat per area}

[If corrections were made:]
## Corrections Applied
- {Area}: {original} → {corrected}

[If deferred ideas exist:]
## Noted for Later
- {Deferred idea} — future phase

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase ${PHASE}: {phase_name}** — {Goal from ROADMAP.md}

`/clear` then:

`/gsd-plan-phase ${PHASE}`

---

**Also available:**
- `/gsd-plan-phase ${PHASE} --skip-research` — 不做 research 直接规划
- `/gsd-ui-phase ${PHASE}` — 生成 UI design contract（如果是前端工作）
- 继续前先查看/编辑 CONTEXT.md

---
```
</step>

<step name="auto_advance">
检查是否应自动前进：

1. 从 $ARGUMENTS 解析 `--auto` flag
2. 同步 chain flag：
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     gsd-sdk query config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. 读取汇总后的 auto-mode（`active` = chain flag OR user preference）：
   ```bash
   AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
   ```

**如果存在 `--auto` flag 且 `AUTO_MODE` 不为 true：**
```bash
gsd-sdk query config-set workflow._auto_chain_active true
```

**如果存在 `--auto` flag 或 `AUTO_MODE` 为 true：**

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured (assumptions mode). Launching plan-phase...
```

启动：`Skill(skill="gsd-plan-phase", args="${PHASE} --auto")`

处理返回：PHASE COMPLETE / PLANNING COMPLETE / INCONCLUSIVE / GAPS FOUND
（处理方式与 discuss-phase.md 的 auto_advance step 完全相同）

**如果既没有 `--auto`，config 也未启用：**
路由到 confirm_creation step。
</step>

</process>

<success_criteria>
- 已根据 roadmap 校验 phase
- 已加载 prior context（不会重复询问已定决策）
- 已通过 Explore subagent 深度分析代码库（读取 5-15 个文件）
- 已结合证据和 confidence level 暴露假设
- 用户已确认或纠正假设（最多约 2-4 次交互）
- 已将范围蔓延重定向到 deferred ideas
- CONTEXT.md 已记录实际决策（格式与 discuss mode 完全一致）
- CONTEXT.md 包含 canonical_refs 和完整文件路径（强制要求）
- CONTEXT.md 包含来自代码库分析的 code_context
- DISCUSSION-LOG.md 已记录假设与纠正，作为审计轨迹
- STATE.md 已更新 session 信息
- 用户清楚下一步该做什么
</success_criteria>
