<purpose>
提取下游 agents 需要的实现决策。分析该 phase 以识别灰区，让用户选择要讨论的内容，然后对每个选中的区域深入讨论，直到用户满意。

你是思考搭档，不是采访者。用户是愿景提出者，而你是构建者。你的工作是记录能指导 research 和 planning 的决策，而不是自己先把实现方案想出来。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/domain-probes.md
@~/.claude/get-shit-done/references/gate-prompts.md
@~/.claude/get-shit-done/references/universal-anti-patterns.md
</required_reading>

<downstream_awareness>
**CONTEXT.md 会作为以下输入：**

1. **gsd-phase-researcher** — 读取 CONTEXT.md 了解要研究 WHAT
   - "User wants card-based layout" → researcher 调查 card component patterns
   - "Infinite scroll decided" → researcher 调查 virtualization libraries

2. **gsd-planner** — 读取 CONTEXT.md 了解哪些 WHAT 决策已经锁定
   - "Pull-to-refresh on mobile" → planner 在 task specs 中包含它
   - "Claude's Discretion: loading skeleton" → planner 可以自行决定实现方式

**你的职责：** 把决策记录得足够清晰，让下游 agents 无需再次询问用户就能据此行动。

**不是你的职责：** 搞清楚 HOW to implement。research 和 planning 会基于你记录的决策来完成这件事。
</downstream_awareness>

<philosophy>
**User = founder/visionary. Claude = builder.**

用户知道的是：
- 他们设想中的工作方式
- 它应该呈现出的外观/感觉
- 什么是必须的，什么只是锦上添花
- 他们心中已有的具体行为或参考

用户不知道的（也不应该被问到）是：
- 代码库模式（researcher 会读代码）
- 技术风险（researcher 会识别）
- 实现方案（planner 会搞定）
- 成功指标（会从工作中推断）

询问愿景和实现选择。为下游 agents 记录决策。
</philosophy>

<scope_guardrail>
**关键：不要范围蔓延。**

phase 边界来自 ROADMAP.md，并且是固定的。讨论只会澄清 HOW to implement 已在范围内的内容，绝不讨论 WHETHER to add new capabilities。

**允许的（澄清歧义）：**
- "How should posts be displayed?"（布局、密度、展示信息）
- "What happens on empty state?"（功能内部的状态处理）
- "Pull to refresh or manual?"（行为选择）

**不允许的（范围蔓延）：**
- "Should we also add comments?"（新增能力）
- "What about search/filtering?"（新增能力）
- "Maybe include bookmarking?"（新增能力）

**判断启发式：** 这是否是在澄清我们如何实现本 phase 已有内容，还是在增加一个足以单独成为自己 phase 的新能力？

**当用户提出范围蔓延时：**
```
"[Feature X] would be a new capability — that's its own phase.
Want me to note it for the roadmap backlog?

For now, let's focus on [phase domain]."
```

把这个想法记到 "Deferred Ideas" section。不要丢，也不要执行。
</scope_guardrail>

<gray_area_identification>
灰区是 **用户关心的实现决策** —— 这些事情可能有多种做法，而且会改变结果。

**如何识别灰区：**

1. **从 ROADMAP.md 读取 phase goal**
2. **理解领域** —— 正在构建的是什么类型的东西？
   - 用户会 SEE 的东西 → 视觉呈现、交互、状态很重要
   - 用户会 CALL 的东西 → 接口契约、响应、错误很重要
   - 用户会 RUN 的东西 → 调用方式、输出、行为模式很重要
   - 用户会 READ 的东西 → 结构、语气、深度、流程很重要
   - 正在被 ORGANIZED 的东西 → 标准、分组、异常处理很重要
3. **生成 phase-specific gray areas** —— 不是泛泛的分类，而是 THIS phase 的具体决策

**不要使用泛化分类标签**（UI、UX、Behavior）。要生成具体灰区：

```
Phase: "User authentication"
→ Session handling, Error responses, Multi-device policy, Recovery flow

Phase: "Organize photo library"
→ Grouping criteria, Duplicate handling, Naming convention, Folder structure

Phase: "CLI for database backups"
→ Output format, Flag design, Progress reporting, Error recovery

Phase: "API documentation"
→ Structure/navigation, Code examples depth, Versioning approach, Interactive elements
```

**关键问题：** 哪些决策会改变结果，因此用户应该参与权衡？

**这些由 Claude 处理（不要问用户）：**
- 技术实现细节
- 架构模式
- 性能优化
- 范围（由 roadmap 定义）
</gray_area_identification>

<answer_validation>
**重要：答案校验** — 每次调用 AskUserQuestion 后，检查响应是否为空或只包含空白。如果是：

**例外 —— "Other" 且文本为空：** 如果用户选择了 "Other"（或 "Chat more"），并且响应体为空或只包含空白，这 **不算** 空答案——这是用户想输入自由文本的信号。此时：
1. 输出一行纯文本："What would you like to discuss?"
2. 立即停止生成。不要调用任何工具。不要再输出任何文本。
3. 等待用户的下一条消息。
4. 收到后，先复述他们的内容，再继续流程。
当选择 "Other" 且文本为空时，不要重试 AskUserQuestion，也不要再生成更多问题。

**所有其他空响应：** 如果响应为空或只包含空白（且用户 **没有** 选择 "Other"）：
1. 用相同参数重试一次问题
2. 如果仍为空，则将选项作为纯文本编号列表呈现，并要求用户输入选项编号
绝不要在空答案的情况下继续。

**Text mode (`workflow.text_mode: true` in config or `--text` flag)：**
当 text mode 激活时，**完全不要使用 AskUserQuestion**。改为将每个问题都显示为纯文本编号列表，并要求用户输入选项编号。
这对 Claude Code remote sessions（`/rc` mode）是必需的，因为 Claude App 无法把 TUI 菜单选择转发回 host。

启用 text mode：
- Per-session：给任意命令加 `--text` flag（例如 `/gsd-discuss-phase --text`）
- Per-project：`gsd-sdk query config-set workflow.text_mode true`

Text mode 适用于该 session 中的 **所有** workflows，不只是 discuss-phase。
</answer_validation>

<process>

**Express path 可用：** 如果你已经有 PRD 或 acceptance criteria document，可使用 `/gsd-plan-phase {phase} --prd path/to/prd.md` 跳过本讨论，直接进入 planning。

<step name="initialize" priority="first">
从参数中获取 phase 编号（必填）。

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ADVISOR=$(gsd-sdk query agent-skills gsd-advisor 2>/dev/null)
```

解析 JSON，获取：`commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`, `response_language`。

**如果设置了 `response_language`：** 本 workflow 中所有面向用户的问题、提示和解释都 **必须** 使用 `{response_language}` 呈现。这包括 AskUserQuestion labels、option text、gray area descriptions 和 discussion summaries。技术术语、代码和 file paths 保持英文。subagent prompts 保持英文——只翻译面向用户的输出。

**如果 `phase_found` 为 false：**
```
Phase [X] not found in roadmap.

Use /gsd-progress ${GSD_WS} to see available phases.
```
退出 workflow。

**如果 `phase_found` 为 true：** 继续到 `check_existing`。

**Power mode** — 如果 ARGUMENTS 中包含 `--power`：
- 完全跳过交互式提问
- 端到端读取并执行 @~/.claude/get-shit-done/workflows/discuss-phase-power.md
- 不再继续下面的步骤

**All mode** — 如果 ARGUMENTS 中包含 `--all`：
- 在 `present_gray_areas` 中：自动选择 **所有** gray areas，不询问用户（跳过 AskUserQuestion 选择步骤）
- 每个 area 的讨论仍然完全交互式进行（由用户主导每个 area 的对话）
- 完成后 **不会** 自动进入 plan-phase——如果想自动推进，请使用 `--chain` 或 `--auto`
- 记录：`[--all] Auto-selected all gray areas: [list area names].`
- 这是“全部都讨论”的快捷方式：跳过选择摩擦，同时保留完整交互控制

**Auto mode** — 如果 ARGUMENTS 中包含 `--auto`：
- 在 `check_existing` 中：如果 context 已存在，自动选择 "Skip"；如果没有 context/plans，则不提示直接继续
- 在 `present_gray_areas` 中：自动选择 **所有** gray areas，不询问用户
- 在 `discuss_areas` 中：对每个讨论问题，都选择推荐选项（第一个选项，或标记为 "recommended" 的选项），不使用 AskUserQuestion
- 将每个自动选择以内联方式记录，方便用户稍后在 context file 中复查决策
- 讨论完成后，自动进入 plan-phase（既有行为）

**Chain mode** — 如果 ARGUMENTS 中包含 `--chain`：
- 讨论保持完全交互式（提问、gray area 选择——与默认模式相同）
- 讨论完成后，自动推进到 plan-phase → execute-phase（与 `--auto` 相同）
- 这是折中模式：用户掌控 discuss 决策，然后 plan+execute 自主运行
</step>

<step name="check_blocking_antipatterns" priority="first">
**强制要求 —— 在做任何其他工作之前先检查 blocking anti-patterns。**

在当前 phase directory 中查找 `.continue-here.md`：

```bash
ls ${phase_dir}/.continue-here.md 2>/dev/null || true
```

如果存在 `.continue-here.md`，解析其中 "Critical Anti-Patterns" table，查找 `severity` = `blocking` 的行。

**如果找到一个或多个 `blocking` anti-pattern：**

这个步骤不能跳过。在继续到 `check_existing` 或任何其他步骤之前，agent 必须通过回答每个 anti-pattern 的以下三个问题，来证明自己理解它们：

1. **What is this anti-pattern?** — 用你自己的话描述它，不要直接引用 handoff。
2. **How did it manifest?** — 解释导致它被记录下来的具体失败。
3. **What structural mechanism (not acknowledgment) prevents it?** — 指出能防止再次发生的具体步骤、checklist item 或 enforcement mechanism。

在继续之前，先内联写出这些答案。如果无法根据 `.continue-here.md` 中的上下文回答某个 blocking anti-pattern，就停止并向用户请求澄清。

**如果不存在 `.continue-here.md`，或未找到 `blocking` 行：** 直接继续到 `check_spec`。
</step>

<step name="check_spec">
检查该 phase 是否存在 SPEC.md（由 `/gsd-spec-phase` 生成）。SPEC.md 会在实现决策之前锁定 requirements——如果存在，本讨论聚焦 HOW to implement，而不是 WHAT to build。

```bash
ls ${phase_dir}/*-SPEC.md 2>/dev/null | grep -v AI-SPEC | head -1 || true
```

**如果找到 SPEC.md：**
1. 读取 SPEC.md file。
2. 统计 requirements 数量（`## Requirements` section 中的编号项）。
3. 显示：
   ```
   Found SPEC.md — {N} requirements locked. Focusing on implementation decisions.
   ```
4. 设置内部 flag `spec_loaded = true`。
5. 将 SPEC.md 中的 requirements、boundaries 和 acceptance criteria 存为 `<locked_requirements>` —— 它们会直接流入 CONTEXT.md，而不再重复提问。
6. 继续到 `check_existing`。

**如果未找到 SPEC.md：** 带着 `spec_loaded = false` 继续到 `check_existing`（默认行为不变）。

**注意：** 名为 `AI-SPEC.md` 的 SPEC.md files（由 `/gsd-ai-integration-phase` 生成）会被排除——它们用途不同。
</step>

<step name="check_existing">
使用 init 中的 `has_context` 检查是否已存在 CONTEXT.md。

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**如果存在：**

**如果是 `--auto`：** 自动选择 "Update it" —— 加载现有 context，然后继续到 `analyze_phase`。记录：`[auto] Context exists — updating with auto-selected decisions.`

**否则：** 使用 AskUserQuestion：
- header: "Context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — 审阅并修订现有 context
  - "View it" — 先看看里面有什么
  - "Skip" — 原样使用现有 context

如果选 "Update"：加载现有内容，继续到 `analyze_phase`
如果选 "View"：显示 CONTEXT.md，然后提供 update/skip
如果选 "Skip"：退出 workflow

**如果不存在：**

**检查是否有中断的 discussion checkpoint：**

```bash
ls ${phase_dir}/*-DISCUSS-CHECKPOINT.json 2>/dev/null || true
```

如果存在 checkpoint file（之前 session 在写出 CONTEXT.md 前中断）：

**如果是 `--auto`：** 自动选择 "Resume" —— 加载 checkpoint，并从上一个完成的 area 继续。

**否则：** 使用 AskUserQuestion：
- header: "Resume"
- question: "Found interrupted discussion checkpoint ({N} areas completed out of {M}). Resume from where you left off?"
- options:
  - "Resume" — 加载 checkpoint，跳过已完成的 areas，继续讨论
  - "Start fresh" — 删除 checkpoint，从头开始讨论

如果选 "Resume"：解析 checkpoint JSON。将 `decisions` 加载到内部累加器中。设置 `areas_completed` 以跳过这些 areas。仅带剩余 areas 继续到 `present_gray_areas`。
如果选 "Start fresh"：删除 checkpoint file。按不存在 checkpoint 的情况继续。

检查 init 中的 `has_plans` 和 `plan_count`。**如果 `has_plans` 为 true：**

**如果是 `--auto`：** 自动选择 "Continue and replan after"。记录：`[auto] Plans exist — continuing with context capture, will replan after.`

**否则：** 使用 AskUserQuestion：
- header: "Plans exist"
- question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
- options:
  - "Continue and replan after" — 先记录 context，然后运行 `/gsd-plan-phase {X} ${GSD_WS}` 重新规划
  - "View existing plans" — 先查看 plans 再决定
  - "Cancel" — 跳过 discuss-phase

如果选 "Continue and replan after"：继续到 `analyze_phase`。
如果选 "View existing plans"：显示 plan files，然后提供 "Continue" / "Cancel"。
如果选 "Cancel"：退出 workflow。

**如果 `has_plans` 为 false：** 继续到 `load_prior_context`。
</step>

<step name="load_prior_context">
读取项目级和前置 phase 的上下文，避免重复询问已经定下的问题，并保持一致性。

**Step 1: 读取项目级文件**
```bash
# Core project files
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

从这些文件中提取：
- **PROJECT.md** — 愿景、原则、不可妥协项、用户偏好
- **REQUIREMENTS.md** — 验收标准、约束条件、must-haves 与 nice-to-haves
- **STATE.md** — 当前进度、任何 flags 或 session notes

**Step 2: 读取之前所有的 CONTEXT.md files**
```bash
# Find all CONTEXT.md files from phases before current
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

对于每个 phase number < current phase 的 CONTEXT.md：
- 读取 `<decisions>` section —— 这些是已锁定的偏好
- 读取 `<specifics>` —— 具体参考或 "I want it like X" 这类时刻
- 记录任何模式（例如："user consistently prefers minimal UI"、"user rejected single-key shortcuts"）

**Step 3: 构建内部 `<prior_decisions>` context**

按以下结构整理提取的信息：
```
<prior_decisions>
## Project-Level
- [Key principle or constraint from PROJECT.md]
- [Requirement that affects this phase from REQUIREMENTS.md]

## From Prior Phases
### Phase N: [Name]
- [Decision that may be relevant to current phase]
- [Preference that establishes a pattern]

### Phase M: [Name]
- [Another relevant decision]
</prior_decisions>
```

**Step 4: 加载 spike/sketch findings（如果存在）**
```bash
# Check for spike/sketch findings skills (project-local)
SPIKE_FINDINGS=$(ls ./.claude/skills/spike-findings-*/SKILL.md 2>/dev/null | head -1)
SKETCH_FINDINGS=$(ls ./.claude/skills/sketch-findings-*/SKILL.md 2>/dev/null | head -1)

# Also check for raw spikes/sketches not yet wrapped up
RAW_SPIKES=$(ls .planning/spikes/MANIFEST.md 2>/dev/null)
RAW_SKETCHES=$(ls .planning/sketches/MANIFEST.md 2>/dev/null)
```

如果存在 spike/sketch findings skills，读取它们的 SKILL.md 和 reference files。提取：
- **Validated patterns** — 已被证明可行的内容（直接使用，不要重新探索）
- **Landmines** — 已被证明不可行的内容（避免）
- **Constraints** — 已发现的硬性限制（rate limits、API gaps、library limitations）
- **Design decisions** — 胜出的视觉方向、CSS patterns、layout choices

加入到 `<prior_decisions>`：
```
## From Spike Experiments
- [Validated pattern or constraint from spike findings]

## From Design Sketches
- [Design decision or visual direction from sketch findings]
```

如果存在 raw spikes/sketches 但没有 findings skill，则在输出中注明：
```
⚠ Unpackaged spikes/sketches detected — run `/gsd-spike-wrap-up` or `/gsd-sketch-wrap-up` to make findings available to planning agents.
```

**后续步骤中的使用方式：**
- `analyze_phase`：跳过那些已经在 prior phases 中决定，或已被 spikes/sketches 验证的 gray areas
- `present_gray_areas`：为选项添加 prior decisions 注释（"You chose X in Phase 5"）和 spike/sketch findings 注释（"Spike 002 validated this approach"）
- `discuss_areas`：预填答案或标记冲突（"This contradicts Phase 3 — same here or different?"）

**如果不存在 prior context：** 直接继续——在早期 phases 里这是正常情况。
</step>

<step name="cross_reference_todos">
检查是否有 pending todos 与本 phase 的范围相关。这会暴露那些原本可能被遗漏的 backlog items。

**加载并匹配 todos：**
```bash
TODO_MATCHES=$(gsd-sdk query todo.match-phase "${PHASE_NUMBER}")
```

解析 JSON，获取：`todo_count`, `matches[]`（每项包含 `file`, `title`, `area`, `score`, `reasons`）。

**如果 `todo_count` 为 0 或 `matches` 为空：** 静默跳过——不拖慢 workflow。

**如果找到匹配项：**

向用户展示匹配到的 todos。显示每个匹配项的 title、area 以及匹配原因：

```
📋 Found {N} pending todo(s) that may be relevant to Phase {X}:

{For each match:}
- **{title}** (area: {area}, relevance: {score}) — matched on {reasons}
```

使用 AskUserQuestion（multiSelect）询问哪些 todos 应被折叠进本 phase 的 scope：

```
Which of these todos should be folded into Phase {X} scope?
(Select any that apply, or none to skip)
```

**对于选中的（folded） todos：**
- 在内部存为 `<folded_todos>`，以便纳入 CONTEXT.md 的 `<decisions>` section
- 它们会成为额外的 scope items，下游 agents（researcher、planner）都能看到

**对于未选中但已审阅的 todos：**
- 在内部存为 `<reviewed_todos>`，以便纳入 CONTEXT.md 的 `<deferred>` section
- 这样未来 phases 就不会再把同一批 todos 当作“遗漏项”重复冒出来

**Auto mode (`--auto`)：** 自动折叠所有 score >= 0.4 的 todos。记录选择结果。
</step>

<step name="scout_codebase">
对现有代码做轻量扫描，以帮助识别 gray areas 并支撑后续讨论。大约使用 10% context——对于交互式 session 是可接受的。

**Step 1: 检查是否已有 codebase maps**
```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**如果存在 codebase maps：** 读取最相关的文件（根据 phase 类型选择 CONVENTIONS.md、STRUCTURE.md、STACK.md）。提取：
- 可复用的 components/hooks/utilities
- 已建立的 patterns（state management、styling、data fetching）
- 集成点（新代码会连接到哪里）

然后跳到下面的 Step 3。

**Step 2: 如果没有 codebase maps，则做定向 grep**

从 phase goal 中提取关键词（例如："feed" → "post", "card", "list"；"auth" → "login", "session", "token"）。

```bash
# Find files related to phase goal terms
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10 || true

# Find existing components/hooks
ls src/components/ 2>/dev/null || true
ls src/hooks/ 2>/dev/null || true
ls src/lib/ src/utils/ 2>/dev/null || true
```

读取最相关的 3-5 个 files，理解现有 patterns。

**Step 3: 构建内部 codebase_context**

根据扫描结果，识别：
- **Reusable assets** — 本 phase 可能用得上的现有 components、hooks、utilities
- **Established patterns** — 代码库如何处理 state management、styling、data fetching
- **Integration points** — 新代码会接到哪里（routes、nav、providers）
- **Creative options** — 现有架构允许或限制的实现路径

将其存为内部 `<codebase_context>`，供 `analyze_phase` 和 `present_gray_areas` 使用。**不要** 写入文件——它只在当前 session 内使用。
</step>

<step name="analyze_phase">
分析该 phase，找出值得讨论的 gray areas。**同时使用 `prior_decisions` 和 `codebase_context` 来锚定分析。**

**从 ROADMAP.md 读取 phase 描述并确定：**

1. **Domain boundary** — 该 phase 交付什么能力？要清晰陈述。

1b. **初始化 canonical refs accumulator** — 开始为 CONTEXT.md 构建 `<canonical_refs>` 列表。这个列表会贯穿整个讨论持续累积，而不只是在这一步。

   **Source 1（现在）：** 复制 ROADMAP.md 中该 phase 的 `Canonical refs:`。将每项扩展成完整的相对路径。
   **Source 2（现在）：** 检查 REQUIREMENTS.md 和 PROJECT.md，看是否引用了与该 phase 相关的 specs/ADRs。
   **Source 3（scout_codebase）：** 如果现有代码引用了 docs（例如 comments 提到 ADRs），把它们也加进来。
   **Source 4（discuss_areas）：** 当用户在讨论中说 "read X"、"check Y"，或提到任何 doc/spec/ADR 时，要立刻加进去。这些往往是 **最重要** 的 refs，因为它们代表用户明确要求遵循的文档。

   该列表在 CONTEXT.md 中是 **强制项**。每个 ref 都必须有完整的相对路径，便于下游 agents 直接读取。如果没有外部 docs，要明确写出来。

2. **检查 prior decisions** — 在生成 gray areas 之前，先看是否已有决定：
   - 扫描 `<prior_decisions>` 中相关的选择（例如："Ctrl+C only, no single-key shortcuts"）
   - 这些都属于 **预先回答**，除非本 phase 存在冲突需求，否则不要再问
   - 记录适用的 prior decisions，供后续展示时使用

2b. **SPEC.md awareness** — 如果 `spec_loaded = true`（在 `check_spec` 中找到了 SPEC.md）：
   - 来自 SPEC.md 的 `<locked_requirements>` 已经预先回答了：Goal、Boundaries、Constraints、Acceptance Criteria。
   - 不要生成关于 WHAT to build 或 WHY 的 gray areas——这些已经锁定。
   - 只生成关于 HOW to implement 的 gray areas：technical approach、library choices、UX/UI patterns、interaction details、error handling style。
   - 在展示 gray areas 时，附带说明："Requirements are locked by SPEC.md — discussing implementation decisions only."

3. **按类别识别 gray areas** — 对每个相关类别（UI、UX、Behavior、Empty States、Content），识别 1-2 个会改变实现的具体歧义点。**在相关处加上 code context 注释**（例如："You already have a Card component" 或 "No existing pattern for this"）。

4. **是否可跳过的评估** — 如果没有有意义的 gray areas（纯基础设施、实现路径很明确，或全部已由 prior phases 决定），则该 phase 可能不需要讨论。

**Advisor Mode Detection：**

检查是否应激活 advisor mode：

1. 检查 USER-PROFILE.md：
   ```bash
   PROFILE_PATH="$HOME/.claude/get-shit-done/USER-PROFILE.md"
   ```
   ADVISOR_MODE = file exists at PROFILE_PATH → true，否则 → false

2. 如果 ADVISOR_MODE 为 true，则解析 vendor_philosophy calibration tier：
   - Priority 1：读取 config.json > preferences.vendor_philosophy（项目级 override）
   - Priority 2：读取 USER-PROFILE.md 中的 Vendor Choices/Philosophy rating（全局）
   - Priority 3：如果两者都没有值，或值为 UNSCORED，则默认使用 "standard"

   映射为 calibration tier：
   - conservative OR thorough-evaluator → full_maturity
   - opinionated → minimal_decisive
   - pragmatic-fast OR any other value OR empty → standard

3. 为 advisor agents 解析 model：
   ```bash
   ADVISOR_MODEL=$(gsd-sdk query resolve-model gsd-advisor-researcher --raw)
   ```

如果 ADVISOR_MODE 为 false，跳过所有 advisor 专属步骤——workflow 保持现有对话流程不变。

**User Profile Language Detection：**

检查 USER-PROFILE.md 中的 communication preferences，以判断用户是否为非技术型产品负责人：

```bash
PROFILE_CONTENT=$(cat "$HOME/.claude/get-shit-done/USER-PROFILE.md" 2>/dev/null || true)
```

若 USER-PROFILE.md 中出现以下任一信号，则设置 NON_TECHNICAL_OWNER = true：
- `learning_style: guided`
- `frustration_triggers` section 中出现 `jargon` 这个词
- `explanation_depth: practical-detailed`（且没有 technical modifier）
- `explanation_depth: high-level`

如果 USER-PROFILE.md 不存在，或以上信号一个都没有，则 NON_TECHNICAL_OWNER = false。

当 NON_TECHNICAL_OWNER 为 true 时，在向用户展示前，使用 product-outcome 语言重写 gray area labels 和 descriptions。底层决策保持不变——只改变表述方式：
- 技术实现术语 → 用户能感知到的结果
  - "Token architecture" → "Color system: which approach prevents the dark theme from flashing white on open"
  - "CSS variable strategy" → "Theme colors: how your brand colors stay consistent in both light and dark mode"
  - "Component API surface area" → "How the building blocks connect: how tightly coupled should these parts be"
  - "Caching strategy: SWR vs React Query" → "Loading speed: should screens show saved data right away or wait for fresh data"
- 所有决策内容都不变。只调整问题语言。

此重写适用于：
1. `present_gray_areas` 中的 gray area labels 和 descriptions
2. `advisor_research` synthesis 中的 advisor research rationale rewrites

**先在内部完成分析，然后再向用户呈现。**

"Post Feed" phase 的分析示例（包含代码和 prior context）：
```
Domain: Displaying posts from followed users
Existing: Card component (src/components/ui/Card.tsx), useInfiniteQuery hook, Tailwind CSS
Prior decisions: "Minimal UI preferred" (Phase 2), "No pagination — always infinite scroll" (Phase 4)
Gray areas:
- UI: Layout style (cards vs timeline vs grid) — Card component exists with shadow/rounded variants
- UI: Information density (full posts vs previews) — no existing density patterns
- Behavior: Loading pattern — ALREADY DECIDED: infinite scroll (Phase 4)
- Empty State: What shows when no posts exist — EmptyState component exists in ui/
- Content: What metadata displays (time, author, reactions count)
```
</step>

<step name="present_gray_areas">
向用户展示 domain boundary、prior decisions 和 gray areas。

**首先，说明边界以及任何适用的 prior decisions：**
```
Phase [X]: [Name]
Domain: [What this phase delivers — from your analysis]

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)

[If prior decisions apply:]
**Carrying forward from earlier phases:**
- [Decision from Phase N that applies here]
- [Decision from Phase M that applies here]
```

**如果是 `--auto` 或 `--all`：** 自动选择 **所有** gray areas。记录：`[--auto/--all] Selected all gray areas: [list area names].` 跳过下面的 AskUserQuestion，直接带着所有已选 areas 进入 `discuss_areas`。

**否则，使用 AskUserQuestion（multiSelect: true）：**
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: 生成 3-4 个 phase-specific gray areas，每个都包含：
  - "[Specific area]"（label）—— 要具体，不要泛化
  - [该 area 涵盖的 1-2 个问题 + code context annotation]（description）
  - **用简短理由高亮推荐选择**

**Prior decision annotations：** 当某个 gray area 已在 prior phase 中被决定时，要这样注释：
```
☐ Exit shortcuts — How should users quit?
  (You decided "Ctrl+C only, no single-key shortcuts" in Phase 5 — revisit or keep?)
```

**Code context annotations：** 当 scout 找到了相关现有代码时，在 gray area description 中注明：
```
☐ Layout style — Cards vs list vs timeline?
  (You already have a Card component with shadow/rounded variants. Reusing it keeps the app consistent.)
```

**两者同时适用时：**
```
☐ Loading behavior — Infinite scroll or pagination?
  (You chose infinite scroll in Phase 4. useInfiniteQuery hook already set up.)
```

**不要包含 "skip" 或 "you decide" 选项。** 用户运行这个命令就是为了讨论——给他们真正的选择。

**按领域示例（带 code context）：**

对于 "Post Feed"（视觉功能）：
```
☐ Layout style — Cards vs list vs timeline? (Card component exists with variants)
☐ Loading behavior — Infinite scroll or pagination? (useInfiniteQuery hook available)
☐ Content ordering — Chronological, algorithmic, or user choice?
☐ Post metadata — What info per post? Timestamps, reactions, author?
```

对于 "Database backup CLI"（命令行工具）：
```
☐ Output format — JSON, table, or plain text? Verbosity levels?
☐ Flag design — Short flags, long flags, or both? Required vs optional?
☐ Progress reporting — Silent, progress bar, or verbose logging?
☐ Error recovery — Fail fast, retry, or prompt for action?
```

对于 "Organize photo library"（组织类任务）：
```
☐ Grouping criteria — By date, location, faces, or events?
☐ Duplicate handling — Keep best, keep all, or prompt each time?
☐ Naming convention — Original names, dates, or descriptive?
☐ Folder structure — Flat, nested by year, or by category?
```

带着已选 areas 继续到 `discuss_areas`（如果 ADVISOR_MODE 为 true，则先到 `advisor_research`）。
</step>

<step name="advisor_research">
**Advisor Research**（仅当 ADVISOR_MODE 为 true 时）

用户在 `present_gray_areas` 中选择 gray areas 后，并行启动 research agents。

1. 显示简短状态："Researching {N} areas..."

2. 对 **每个** 用户选中的 gray area，并行启动一个 Task()：

   Task(
     prompt="First, read @~/.claude/agents/gsd-advisor-researcher.md for your role and instructions.

     <gray_area>{area_name}: {area_description from gray area identification}</gray_area>
     <phase_context>{phase_goal and description from ROADMAP.md}</phase_context>
     <project_context>{project name and brief description from PROJECT.md}</project_context>
     <calibration_tier>{resolved calibration tier: full_maturity | standard | minimal_decisive}</calibration_tier>

     Research this gray area and return a structured comparison table with rationale.
     ${AGENT_SKILLS_ADVISOR}",
     subagent_type="general-purpose",
     model="{ADVISOR_MODEL}",
     description="Research: {area_name}"
   )

   所有 Task() 调用必须同时启动——**不要** 等一个完成后再启动下一个。

3. 在 **所有** agents 返回后，先综合结果，再呈现给用户：
   对每个 agent 的返回值：
   a. 解析 markdown comparison table 和 rationale paragraph
   b. 校验 5 个 columns 是否齐全（Option | Pros | Cons | Complexity | Recommendation）——若缺列，要补齐，而不是展示损坏的 table
   c. 校验 option 数量是否匹配 calibration tier：
      - full_maturity：可接受 3-5 个 options
      - standard：可接受 2-4 个 options
      - minimal_decisive：可接受 1-2 个 options
      如果 agent 返回太多，就裁掉可行性最低的；如果太少，则原样接受。
   d. 重写 rationale paragraph，把 agent 无法访问到的 project context 和当前讨论上下文织入进去
   e. 如果 agent 只返回 1 个 option，则把 table 格式改成直接推荐："Standard approach for {area}: {option}. {rationale}"
   f. **如果 NON_TECHNICAL_OWNER 为 true：** 在完成 a–e 后，对 rationale paragraph 做 plain language rewrite。把实现层术语替换为用户无需技术背景也能理解的结果描述。若 table 中的 option names 也是实现术语，也可以改写成通俗表述——但 Recommendation column 的值和 table 结构必须保持不变。不要删减细节；只是翻译它。示例："SWR uses stale-while-revalidate to serve cached responses immediately" → "This approach shows you something right away, then quietly updates in the background — users see data instantly."

4. 将综合后的 tables 存起来，供 `discuss_areas` 使用。

**如果 ADVISOR_MODE 为 false：** 完全跳过此步骤——从 `present_gray_areas` 直接进入 `discuss_areas`。
</step>

<step name="discuss_areas">
与用户讨论每个已选 area。流程取决于 advisor mode。

**如果 ADVISOR_MODE 为 true：**

采用先表格后讨论的流程——先展示有 research 支撑的 comparison tables，再记录用户选择。

**对于每个已选 area：**

1. **展示综合后的 comparison table + rationale paragraph**（来自 `advisor_research` step）

2. **使用 AskUserQuestion：**
   - header: "{area_name}"
   - question: "Which approach for {area_name}?"
   - options: 从 table 的 Option column 中提取（AskUserQuestion 会自动添加 "Other"）

3. **记录用户的选择：**
   - 如果用户从 table options 中选择 → 记录为该 area 的锁定决策
   - 如果用户选择 "Other" → 接收他们的输入，复述确认后记录

   **Thinking partner（条件触发）：**
   如果 config 中启用了 `features.thinking_partner`，则检查用户回答是否带有取舍信号
   （信号列表见 `references/thinking-partner.md`）。如果检测到 tradeoff：

   ```
   I notice competing priorities here — {option_A} optimizes for {goal_A} while {option_B} optimizes for {goal_B}.

   Want me to think through the tradeoffs before we lock this in?
   [Yes, analyze] / [No, decision made]
   ```

   如果 yes：提供 3-5 条 bullet analysis（各自优化/牺牲什么、与 PROJECT.md goals 的对齐情况、推荐意见）。然后回到正常流程。
   如果 no，或 thinking_partner 被禁用：继续到下一个 area。

4. **记录选择后，由 Claude 决定是否需要追问：**
   - 如果该选择仍有歧义，且会影响下游 planning → 使用 AskUserQuestion 再问 1-2 个定向 follow-up questions
   - 如果该选择已经清晰且自包含 → 进入下一个 area
   - **不要** 再问标准的 4 个问题——table 已经提供了上下文

5. **所有 areas 处理完后：**
   - header: "Done"
   - question: "That covers [list areas]. Ready to create context?"
   - options: "Create context" / "Revisit an area"

**范围蔓延处理（advisor mode）：**
如果用户提到超出 phase domain 的内容：
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

在内部追踪 deferred ideas。

---

**如果 ADVISOR_MODE 为 false：**

对每个已选 area，执行聚焦讨论循环。

**Research-before-questions mode：** 检查 config 中是否启用了 `workflow.research_before_questions`（来自 init context 或 `.planning/config.json`）。启用时，在为每个 area 提问前：
1. 对该 area topic 做一个简短 web search，查最佳实践
2. 用 2-3 条 bullets 总结关键发现
3. 将 research 与问题一起呈现，帮助用户做出更有依据的决策

启用 research 的示例：
```
Let's talk about [Authentication Strategy].

📊 Best practices research:
• OAuth 2.0 + PKCE is the current standard for SPAs (replaces implicit flow)
• Session tokens with httpOnly cookies preferred over localStorage for XSS protection
• Consider passkey/WebAuthn support — adoption is accelerating in 2025-2026

With that context: How should users authenticate?
```

禁用时（默认）：跳过 research，像以前一样直接提问。

**Text mode support：** 解析 `$ARGUMENTS` 中可选的 `--text`。
- 接受 `--text` flag，或从 config 中读取 `workflow.text_mode`（来自 init context）
- 激活时，将 **所有** `AskUserQuestion` 调用替换为纯文本编号列表
- 用户通过输入编号进行选择，或输入自由文本表示 "Other"
- 这对 Claude Code remote sessions（`/rc` mode）是必需的，因为 TUI 菜单无法通过 Claude App 工作

**Batch mode support：** 解析 `$ARGUMENTS` 中可选的 `--batch`。
- 接受 `--batch`、`--batch=N` 或 `--batch N`

**Analyze mode support：** 解析 `$ARGUMENTS` 中可选的 `--analyze`。
当 `--analyze` 激活时，在展示每个问题（或 batch mode 中的问题组）之前，先提供一段简短的 **trade-off analysis**：
- 结合 codebase context 和常见模式，给出 2-3 个 options 及其 pros/cons
- 给出带理由的推荐方案
- 说明来自 prior phases 的已知 pitfalls 或 constraints

带 `--analyze` 的示例：
```
**Trade-off analysis: Authentication strategy**

| Approach | Pros | Cons |
|----------|------|------|
| Session cookies | Simple, httpOnly prevents XSS | Requires CSRF protection, sticky sessions |
| JWT (stateless) | Scalable, no server state | Token size, revocation complexity |
| OAuth 2.0 + PKCE | Industry standard for SPAs | More setup, redirect flow UX |

💡 Recommended: OAuth 2.0 + PKCE — your app has social login in requirements (REQ-04) and this aligns with the existing NextAuth setup in `src/lib/auth.ts`.

How should users authenticate?
```

这样用户在不需要额外追问的情况下，也能获得足够上下文来做决策。若未提供 `--analyze`，则继续像之前一样直接提问。
- 接受 `--batch`、`--batch=N` 或 `--batch N`
- 未提供具体数字时，默认每批 4 个问题
- 显式大小限制在 2-5 之间，确保一批仍然可回答
- 如果没有 `--batch`，保持现有的一次一个问题流程

**理念：** 保持自适应，但让用户决定节奏。
- 默认模式：4 个单题回合，然后确认是否继续
- `--batch` 模式：1 个分组回合，内含 2-5 个编号问题，然后确认是否继续

每个回答（或 batch mode 下的一组回答）都应揭示下一个问题或下一批问题。

**Auto mode (`--auto`)：** 对每个 area，Claude 会为每个问题选择推荐选项（第一个选项，或明确标注为 "recommended" 的选项），不使用 AskUserQuestion。记录每个自动选择：
```
[auto] [Area] — Q: "[question text]" → Selected: "[chosen option]" (recommended default)
```
所有 areas 自动决议完后，跳过 "Explore more gray areas" 提示，直接进入 `write_context`。

**关键 —— Auto-mode pass cap：**
在 `--auto` mode 中，discuss step **必须** 在 **单次 pass** 内完成。写出 CONTEXT.md 一次后，就完成了——立即进入 `write_context`，然后进入 `auto_advance`。**不要** 再去重读你自己写出的 CONTEXT.md，试图寻找“gaps”“undefined types”或“missing decisions”并再跑额外 pass。这会形成自我喂养循环：每一轮都会生成新的引用，下一轮又把这些当成 gaps，导致时间和资源无限消耗。

从 config 中检查 pass cap：
```bash
MAX_PASSES=$(gsd-sdk query config-get workflow.max_discuss_passes 2>/dev/null || echo "3")
```

如果你已经写出并提交了 CONTEXT.md，那么 discuss step 就完成了。继续往下走。

**Interactive mode（无 `--auto`）：**

**对于每个 area：**

1. **宣布该 area：**
   ```
   Let's talk about [Area].
   ```

2. **按照所选节奏提问：**

   **默认（无 `--batch`）：使用 AskUserQuestion 提 4 个问题**
   - header: "[Area]"（最多 12 个字符——必要时缩写）
   - question: 该 area 的具体决策点
   - options: 2-3 个具体选择（AskUserQuestion 会自动添加 "Other"），并用简短理由高亮推荐选项
   - **在相关时为选项加上 code context 注释：**
      ```
      "How should posts be displayed?"
      - Cards (reuses existing Card component — consistent with Messages)
      - List (simpler, would be a new pattern)
      - Timeline (needs new Timeline component — none exists yet)
      ```
   - 在合理时包含 "You decide" 选项——用于记录 Claude discretion
   - **针对 library choices 使用 Context7：** 当 gray area 涉及 library selection（例如："magic links" → 查询 next-auth docs）或 API approach 决策时，使用 `mcp__context7__*` tools 拉取最新文档，以便生成更可靠的 options。不要对每个问题都用 Context7——只在 library-specific knowledge 能明显改善选项质量时使用。

   **Batch mode (`--batch`)：在一个纯文本回合中提出 2-5 个编号问题**
   - 将当前 area 中密切相关的问题分组成一条消息
   - 保持每个问题都具体，并能在一次回复中回答
   - 如有帮助，可在每个问题后内联短选项，而不是为每一项都单独调用 AskUserQuestion
   - 用户回复后，复述已记录的决策，指出未回答项，并在进入下一个 area 前，只做最少必要的追问
   - 在 batches 之间保留自适应能力：利用完整答案决定下一批问题，或判断该 area 是否已经足够清晰

3. **在当前这组问题之后，检查：**
   - header: "[Area]"（最多 12 个字符）
   - question: "More questions about [area], or move to next? (Remaining: [list other unvisited areas])"
   - options: "More questions" / "Next area"

   构造问题文本时，要列出剩余未访问的 areas，让用户知道后面还有什么。例如："More questions about Layout, or move to next? (Remaining: Loading behavior, Content ordering)"

   如果选 "More questions" → 再问 4 个单题，或在 `--batch` 激活时再问一批 2-5 个问题，然后再次确认
   如果选 "Next area" → 进入下一个已选 area
   如果选 "Other"（自由文本）→ 解释其意图：延续型表述（"chat more"、"keep going"、"yes"、"more"）映射为 "More questions"；推进型表述（"done"、"move on"、"next"、"skip"）映射为 "Next area"。如果仍有歧义，则问："Continue with more questions about [area], or move to the next area?"

4. **所有初始选中的 areas 都完成后：**
   - 总结目前讨论中已记录的内容
   - 使用 AskUserQuestion：
     - header: "Done"
     - question: "We've discussed [list areas]. Which gray areas remain unclear?"
     - options: "Explore more gray areas" / "I'm ready for context"
   - 如果选 "Explore more gray areas"：
     - 根据目前学到的信息，再识别 2-4 个额外 gray areas
     - 回到 `present_gray_areas` 的逻辑，展示这些新 areas
     - 循环：讨论新 areas，然后再次提示
   - 如果选 "I'm ready for context"：进入 `write_context`

**讨论期间的 canonical ref 累积：**
当用户在任意回答中提到 doc、spec 或 ADR —— 例如 "read adr-014"、"check the MCP spec"、"per browse-spec.md" —— 要立刻：
1. 读取该引用的文档（或确认其存在）
2. 将它以完整相对路径加入 canonical refs accumulator
3. 使用从文档中学到的内容，来影响后续问题

这些用户引用的 docs 往往比 ROADMAP.md refs **更重要**，因为它们代表用户明确要求下游 agents 遵循的文档。绝不要丢掉它们。

**Question design：**
- 选项要具体，而不是抽象（用 "Cards"，不要用 "Option A"）
- 每个答案都应该推动下一个问题或下一批问题
- 如果用户选择 "Other" 来提供自由输入（例如："let me describe it"、"something else" 或开放式回复），你的 follow-up 必须使用纯文本提问——**不要** 再调用 AskUserQuestion。等待他们在正常提示符下输入，再复述确认，然后才恢复 AskUserQuestion 或下一个编号 batch。

**范围蔓延处理：**
如果用户提到超出 phase domain 的内容：
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

在内部追踪 deferred ideas。

**增量 checkpoint —— 每完成一个 area 就保存：**

每当一个 area 解决完成（用户选择 "Next area"，或该 area 在 `--auto` mode 中自动决议）后，立刻写一个 checkpoint file，保存迄今为止记录的所有决策。这样如果讨论中途 session 被打断，也不会丢数据。

**Checkpoint file：** `${phase_dir}/${padded_phase}-DISCUSS-CHECKPOINT.json`

每个 area 完成后写入：
```json
{
  "phase": "{PHASE_NUM}",
  "phase_name": "{phase_name}",
  "timestamp": "{ISO timestamp}",
  "areas_completed": ["Area 1", "Area 2"],
  "areas_remaining": ["Area 3", "Area 4"],
  "decisions": {
    "Area 1": [
      {"question": "...", "answer": "...", "options_presented": ["..."]},
      {"question": "...", "answer": "...", "options_presented": ["..."]}
    ],
    "Area 2": [
      {"question": "...", "answer": "...", "options_presented": ["..."]}
    ]
  },
  "deferred_ideas": ["..."],
  "canonical_refs": ["..."]
}
```

这是结构化 checkpoint，不是最终的 CONTEXT.md——真正的规范输出仍由 `write_context` step 生成。但如果 session 中断，下次执行 `/gsd-discuss-phase` 时，就能检测到该 checkpoint，并提供从中断处恢复，而不是从头再来。

**在 session resume 时：** 在 `check_existing` step 中，也要检查 `*-DISCUSS-CHECKPOINT.json`。如果找到且不存在 CONTEXT.md：
- 显示："Found interrupted discussion checkpoint ({N} areas completed). Resume from checkpoint?"
- options: "Resume" / "Start fresh"
- 如果选 "Resume"：加载 checkpoint，跳过已完成 areas，从中断处继续
- 如果选 "Start fresh"：删除 checkpoint，按正常流程继续

**当 `write_context` 成功完成后：** 删除 checkpoint file——此时规范 CONTEXT.md 已经包含全部决策。

**在内部追踪 discussion log data：**
对每个被问到的问题，累计记录：
- Area name
- 所有展示过的 options（label + description）
- 用户选择了哪个 option（或他们的自由文本回答）
- 用户提供的任何 follow-up notes 或 clarifications
这些数据将在 `write_context` step 中用于生成 DISCUSSION-LOG.md。
</step>

<step name="write_context">
创建 CONTEXT.md，记录已作出的决策。

**同时生成 DISCUSSION-LOG.md** —— 完整保存 discuss-phase 的 Q&A 审计轨迹。
该文件仅供人工参考（software audits、compliance reviews）。它 **不会**
被下游 agents（researcher、planner、executor）消费。

**查找或创建 phase directory：**

使用 init 中的值：`phase_dir`, `phase_slug`, `padded_phase`。

如果 `phase_dir` 为 null（roadmap 中存在该 phase，但还没有 directory）：
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**File location：** `${phase_dir}/${padded_phase}-CONTEXT.md`

**SPEC.md integration** —— 如果 `spec_loaded = true`：
- 在 `<domain>` 之后立刻添加一个 `<spec_lock>` section（见下方模板）。
- 将 SPEC.md file 加入 `<canonical_refs>`，并注明 "Locked requirements — MUST read before planning"。
- 不要把 SPEC.md 中的 requirements 文本重复写进 `<decisions>` —— agents 会直接读取 SPEC.md。
- `<decisions>` section 只包含本次讨论产出的实现决策。

**根据实际讨论内容组织结构：**

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor]

</domain>

[If spec_loaded = true, insert this section:]
<spec_lock>
## Requirements (locked via SPEC.md)

**{N} requirements are locked.** See `{padded_phase}-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `{padded_phase}-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** [copy the "In scope" bullet list from SPEC.md Boundaries]
**Out of scope (from SPEC.md):** [copy the "Out of scope" bullet list from SPEC.md Boundaries]

</spec_lock>

<decisions>
## Implementation Decisions

### [Category 1 that was discussed]
- **D-01:** [Decision or preference captured]
- **D-02:** [Another decision if applicable]

### [Category 2 that was discussed]
- **D-03:** [Decision or preference captured]

### Claude's Discretion
[Areas where user said "you decide" — note that Claude has flexibility here]

### Folded Todos
[If any todos were folded into scope from the cross_reference_todos step, list them here.
Each entry should include the todo title, original problem, and how it fits this phase's scope.
If no todos were folded: omit this subsection entirely.]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

[MANDATORY section. Write the FULL accumulated canonical refs list here.
Sources: ROADMAP.md refs + REQUIREMENTS.md refs + user-referenced docs during
discussion + any docs discovered during codebase scout. Group by topic area.
Every entry needs a full relative path — not just a name.]

### [Topic area 1]
- `path/to/adr-or-spec.md` — [What it decides/defines that's relevant]
- `path/to/doc.md` §N — [Specific section reference]

### [Topic area 2]
- `path/to/feature-doc.md` — [What this doc defines]

[If no external specs: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [Component/hook/utility]: [How it could be used in this phase]

### Established Patterns
- [Pattern]: [How it constrains/enables this phase]

### Integration Points
- [Where new code connects to existing system]

</code_context>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other phases. Don't lose them.]

### Reviewed Todos (not folded)
[If any todos were reviewed in cross_reference_todos but not folded into scope,
list them here so future phases know they were considered.
Each entry: todo title + reason it was deferred (out of scope, belongs in Phase Y, etc.)
If no reviewed-but-deferred todos: omit this subsection entirely.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

写入 file。
</step>

<step name="confirm_creation">
展示摘要和下一步：

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured

### [Category]
- [Key decision]

### [Category]
- [Key decision]

[If deferred ideas exist:]
## Noted for Later
- [Deferred idea] — future phase

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/clear` then:

`/gsd-plan-phase ${PHASE} ${GSD_WS}`

---

**Also available:**
- `/gsd-discuss-phase ${PHASE} --chain ${GSD_WS}` — 重新运行，并在之后自动 plan+execute
- `/gsd-plan-phase ${PHASE} --skip-research ${GSD_WS}` — 跳过 research 直接规划
- `/gsd-ui-phase ${PHASE} ${GSD_WS}` — 在 planning 前生成 UI design contract（如果该 phase 包含 frontend 工作）
- Review/edit CONTEXT.md before continuing

---
```
</step>

<step name="git_commit">
**提交前先写入 DISCUSSION-LOG.md：**

**File location：** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# Phase [X]: [Name] - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** [ISO date]
**Phase:** [phase number]-[phase name]
**Areas discussed:** [comma-separated list]

---

[For each gray area discussed:]

## [Area Name]

| Option | Description | Selected |
|--------|-------------|----------|
| [Option 1] | [Description from AskUserQuestion] | |
| [Option 2] | [Description] | ✓ |
| [Option 3] | [Description] | |

**User's choice:** [Selected option or free-text response]
**Notes:** [Any clarifications, follow-up context, or rationale the user provided]

---

[Repeat for each area]

## Claude's Discretion

[List areas where user said "you decide" or deferred to Claude]

## Deferred Ideas

[Ideas mentioned during discussion that were noted for future phases]
```

写入 file。

**清理 checkpoint file** —— CONTEXT.md 现在是规范记录：

```bash
rm -f "${phase_dir}/${padded_phase}-DISCUSS-CHECKPOINT.json"
```

提交 phase context 和 discussion log：

```bash
gsd-sdk query commit "docs(${padded_phase}): capture phase context" "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
```

确认："Committed: docs(${padded_phase}): capture phase context"
</step>

<step name="update_state">
使用 session 信息更新 STATE.md：

```bash
gsd-sdk query state.record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

提交 STATE.md：

```bash
gsd-sdk query commit "docs(state): record phase ${PHASE} context session" .planning/STATE.md
```
</step>

<step name="auto_advance">
检查是否触发 auto-advance：

1. 从 $ARGUMENTS 解析 `--auto` 和 `--chain` flags。注意：`--all` **不是** auto-advance trigger——它只影响 area selection。带 `--all` 但不带 `--auto` 或 `--chain` 的 session，在讨论完成后仍会回到手动 next-steps。
2. **让 chain flag 与意图保持同步** —— 如果用户是手动调用（没有 `--auto` 也没有 `--chain`），则清除上一次中断的 `--auto` chain 留下的临时 chain flag。**不要** 修改 `workflow.auto_advance`（这是用户的持久化设置偏好）：
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]] && [[ ! "$ARGUMENTS" =~ --chain ]]; then
     gsd-sdk query config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. 读取合并后的 auto-mode（`active` = chain flag OR user preference）：
   ```bash
   AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
   ```

**如果存在 `--auto` 或 `--chain` flag，且 `AUTO_MODE` 不为 true：** 将 chain flag 持久化到 config（用于处理未经过 new-project 的直接调用）：
```bash
gsd-sdk query config-set workflow._auto_chain_active true
```

**如果存在 `--auto` flag，或存在 `--chain` flag，或 `AUTO_MODE` 为 true：**

显示 banner：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured. Launching plan-phase...
```

使用 Skill tool 启动 plan-phase，以避免嵌套 Task sessions（深层 agent 嵌套会导致运行时冻结，见 #686）：
```
Skill(skill="gsd-plan-phase", args="${PHASE} --auto ${GSD_WS}")
```

这样可以让 auto-advance chain 保持扁平——discuss、plan 和 execute 都在同一层级运行，而不是不断生成更深的 Task agents。

**处理 plan-phase 的返回：**
- **PHASE COMPLETE** → 整条链路成功完成。显示：
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${PHASE} COMPLETE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished: discuss → plan → execute

  /clear then:

  Next: /gsd-discuss-phase ${NEXT_PHASE} ${WAS_CHAIN ? "--chain" : "--auto"} ${GSD_WS}
  ```
- **PLANNING COMPLETE** → planning 已完成，但 execution 未完成：
  ```
  Auto-advance partial: Planning complete, execution did not finish.
  Continue: /gsd-execute-phase ${PHASE} ${GSD_WS}
  ```
- **PLANNING INCONCLUSIVE / CHECKPOINT** → 停止链路：
  ```
  Auto-advance stopped: Planning needs input.
  Continue: /gsd-plan-phase ${PHASE} ${GSD_WS}
  ```
- **GAPS FOUND** → 停止链路：
  ```
  Auto-advance stopped: Gaps found during execution.
  Continue: /gsd-plan-phase ${PHASE} --gaps ${GSD_WS}
  ```

**如果 `--auto`、`--chain` 和 config 启用三者都不存在：**
转到 `confirm_creation` step（现有行为——展示手动下一步）。
</step>

</process>

<power_user_mode>
当 ARGUMENTS 中包含 `--power` flag 时，跳过交互式提问，执行 power user workflow。

power user mode 会先一次性生成 **所有** 问题，输出为 machine-readable 和 human-friendly files，然后等待用户按自己的节奏回答，最后再在单次 pass 中处理全部答案。

**完整逐步说明：** @~/.claude/get-shit-done/workflows/discuss-phase-power.md

**流程摘要：**
1. 执行与标准 mode 相同的 phase analysis（gray area identification）
2. 将所有问题写入 `{phase_dir}/{padded_phase}-QUESTIONS.json` 和 `{phase_dir}/{padded_phase}-QUESTIONS.html`
3. 告知用户 file paths，并等待 "refresh" 或 "finalize" 命令
4. 当用户说 "refresh"：读取 JSON，处理已回答问题，更新 stats 和 HTML
5. 当用户说 "finalize"：从 JSON 读取所有答案，用标准格式生成 CONTEXT.md
</power_user_mode>

<success_criteria>
- 已依据 roadmap 校验 phase
- 已加载 prior context（PROJECT.md、REQUIREMENTS.md、STATE.md、之前的 CONTEXT.md files）
- 已决定的问题不会被重复提问（会从 prior phases 延续）
- 已扫描代码库，以识别可复用资产、模式和集成点
- 已通过带代码注释和 prior decision 注释的智能分析识别 gray areas
- 用户已选择要讨论哪些 areas
- 每个已选 area 都已探索到用户满意为止（选项会结合代码信息和 prior decisions）
- 范围蔓延已被重定向到 deferred ideas
- CONTEXT.md 记录的是实际决策，而不是模糊愿景
- CONTEXT.md 包含 canonical_refs section，并带有下游 agents 需要的每个 spec/ADR/doc 的完整 file paths（**强制项**——绝不能省略）
- CONTEXT.md 包含 code_context section，记录可复用资产和模式
- Deferred ideas 已为未来 phases 保留
- STATE.md 已更新 session 信息
- 用户知道下一步该做什么
- 每完成一个 area 就会写 checkpoint file（增量保存）
- 中断的 sessions 可以从 checkpoint 恢复（不必重答已完成 areas）
- 成功写出 CONTEXT.md 后会清理 checkpoint file
- `--chain` 会触发交互式 discuss，之后自动 plan+execute（不自动代答）
- `--chain` 和 `--auto` 都会持久化 chain flag，并自动推进到 plan-phase
</success_criteria>
