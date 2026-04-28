<purpose>
通过统一流程初始化一个新项目：提问、research（可选）、requirements、roadmap。这是任何项目中最具杠杆效应的时刻之一，在这里进行深入提问，通常意味着更好的计划、更好的执行和更好的结果。一个 workflow 就能把想法推进到 ready-for-planning。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<available_agent_types>
有效的 GSD subagent types（使用精确名称，不要回退到 `general-purpose`）：
- gsd-project-researcher — 研究项目级技术决策
- gsd-research-synthesizer — 汇总并行 research agents 的发现
- gsd-roadmapper — 创建分阶段执行 roadmap
</available_agent_types>

<auto_mode>

## Auto Mode Detection

检查 `$ARGUMENTS` 中是否存在 `--auto` flag。

**如果是 auto mode：**

- 跳过 brownfield mapping 选项（默认视为 greenfield）
- 跳过深度提问（从提供的文档中提取上下文）
- Config：YOLO mode 为隐式开启（跳过该问题），但要**先**询问 granularity/git/agents（Step 2a）
- 完成 config 后，使用合理默认值自动执行 Steps 6-9：
  - Research：始终选择 yes
  - Requirements：包含提供文档中的所有 table stakes 和功能
  - Requirements approval：自动批准
  - Roadmap approval：自动批准

**文档要求：**
Auto mode 需要一份 idea 文档，可以是以下任一形式：

- 文件引用：`/gsd-new-project --auto @prd.md`
- 在 prompt 中粘贴或直接写入文本

如果未提供任何文档内容，则报错：

```
Error: --auto requires an idea document.

Usage:
  /gsd-new-project --auto @your-idea.md
  /gsd-new-project --auto [paste or write your idea here]

The document should describe what you want to build.
```

</auto_mode>

<process>

## 1. Setup

**强制第一步：在与用户进行任何交互之前，先执行以下检查：**

```bash
INIT=$(gsd-sdk query init.new-project)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_RESEARCHER=$(gsd-sdk query agent-skills gsd-project-researcher 2>/dev/null)
AGENT_SKILLS_SYNTHESIZER=$(gsd-sdk query agent-skills gsd-synthesizer 2>/dev/null)
AGENT_SKILLS_ROADMAPPER=$(gsd-sdk query agent-skills gsd-roadmapper 2>/dev/null)
```

解析 JSON 中的：`researcher_model`、`synthesizer_model`、`roadmapper_model`、`commit_docs`、`project_exists`、`has_codebase_map`、`planning_exists`、`has_existing_code`、`has_package_file`、`is_brownfield`、`needs_codebase_map`、`has_git`、`project_path`、`agents_installed`、`missing_agents`。

**如果 `agents_installed` 为 false：** 继续前先显示警告：
```
⚠ GSD agents not installed. The following agents are missing from your agents directory:
  {missing_agents joined with newline}

Subagent spawns (gsd-project-researcher, gsd-research-synthesizer, gsd-roadmapper) will fail
with "agent type not found". Run the installer with --global to make agents available:

  npx get-shit-done-cc@latest --global

Proceeding without research subagents — roadmap will be generated inline.
```
跳过 Steps 6–7（并行 research 与 synthesis），直接在 Step 8 中创建 roadmap。

**检测 runtime 并设置 instruction file 名称：**

从调用 prompt 的 `execution_context` 路径推导 `RUNTIME`：
- 路径包含 `/.codex/` → `RUNTIME=codex`
- 路径包含 `/.gemini/` → `RUNTIME=gemini`
- 路径包含 `/.config/opencode/` 或 `/.opencode/` → `RUNTIME=opencode`
- 其他情况 → `RUNTIME=claude`

如果无法获得 `execution_context` 路径，则回退到环境变量：
```bash
if [ -n "$CODEX_HOME" ]; then RUNTIME="codex"
elif [ -n "$GEMINI_CONFIG_DIR" ]; then RUNTIME="gemini"
elif [ -n "$OPENCODE_CONFIG_DIR" ] || [ -n "$OPENCODE_CONFIG" ]; then RUNTIME="opencode"
else RUNTIME="claude"; fi
```

设置 instruction file 变量：
```bash
if [ "$RUNTIME" = "codex" ]; then INSTRUCTION_FILE="AGENTS.md"; else INSTRUCTION_FILE="CLAUDE.md"; fi
```

后续所有对项目 instruction file 的引用都使用 `$INSTRUCTION_FILE`。

**如果 `project_exists` 为 true：** 报错，说明项目已初始化。请使用 `/gsd-progress`。

**如果 `has_git` 为 false：** 初始化 git：

```bash
git init
```

## 2. Brownfield Offer

**如果是 auto mode：** 跳到 Step 4（默认视为 greenfield，并根据提供的文档生成 PROJECT.md）。

**如果 `needs_codebase_map` 为 true**（来自 init，表示检测到现有代码，但没有 codebase map）：

**Text mode（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 `TEXT_MODE` 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。
使用 AskUserQuestion：

- header: `"Codebase"`
- question: `"I detected existing code in this directory. Would you like to map the codebase first?"`
- options:
  - `"Map codebase first"` — 先运行 /gsd-map-codebase 来理解现有架构（Recommended）
  - `"Skip mapping"` — 继续执行项目初始化

**如果选择 `"Map codebase first"`：**

```
Run `/gsd-map-codebase` first, then return to `/gsd-new-project`
```

退出命令。

**如果选择 `"Skip mapping"` 或 `needs_codebase_map` 为 false：** 继续执行 Step 3。

## 2a. Auto Mode Config（仅 auto mode）

**如果是 auto mode：** 在处理 idea 文档之前，先收集 config settings。

YOLO mode 为隐式开启（auto = YOLO）。继续询问剩余的 config 问题：

**Round 1 — Core settings（3 个问题，不包含 Mode 问题）：**

```
AskUserQuestion([
  {
    header: "Granularity",
    question: "How finely should scope be sliced into phases?",
    multiSelect: false,
    options: [
      { label: "Coarse (Recommended)", description: "Fewer, broader phases (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced phase size (5-8 phases, 3-5 plans each)" },
      { label: "Fine", description: "Many focused phases (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
])
```

**Round 2 — Workflow agents（与 Step 5 相同）：**

```
AskUserQuestion([
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" },
      { label: "Inherit", description: "Use the current session model for all agents (OpenCode /model)" }
    ]
  }
])
```

使用全部设置创建 `.planning/config.json`（CLI 会自动补全剩余默认值）：

```bash
mkdir -p .planning
gsd-sdk query config-new-project '{"mode":"yolo","granularity":"[selected]","parallelization":true|false,"commit_docs":true|false,"model_profile":"quality|balanced|budget|inherit","workflow":{"research":true|false,"plan_check":true|false,"verifier":true|false,"nyquist_validation":true|false,"auto_advance":true}}'
```

**如果 `commit_docs = No`：** 将 `.planning/` 加入 `.gitignore`。

**Commit config.json：**

```bash
mkdir -p .planning
gsd-sdk query commit "chore: add project config" .planning/config.json
```

**将 auto-advance chain flag 持久化到 config（避免在 context compaction 后丢失）：**

```bash
gsd-sdk query config-set workflow._auto_chain_active true
```

继续执行 Step 4（跳过 Steps 3 和 5）。

## 2b. 检测已有 Spike/Sketch

检查是否存在已有 spike 或 sketch 工作，并将其用于项目初始化：

```bash
# Check for spike findings skill (project-local)
SPIKE_SKILL=$(ls ./.claude/skills/spike-findings-*/SKILL.md 2>/dev/null | head -1)

# Check for sketch findings skill (project-local)
SKETCH_SKILL=$(ls ./.claude/skills/sketch-findings-*/SKILL.md 2>/dev/null | head -1)

# Check for raw spikes/sketches in .planning/
HAS_SPIKES=$(ls .planning/spikes/MANIFEST.md 2>/dev/null)
HAS_SKETCHES=$(ls .planning/sketches/MANIFEST.md 2>/dev/null)
```

如果存在其中任何一项，在提问前先展示：

```
⚡ Prior exploration detected:
{if SPIKE_SKILL}  ✓ Spike findings skill: {path} — validated patterns from experiments
{if SKETCH_SKILL}  ✓ Sketch findings skill: {path} — validated design decisions
{if HAS_SPIKES && !SPIKE_SKILL}  ◆ Raw spikes in .planning/spikes/ — consider `/gsd-spike-wrap-up` to package findings
{if HAS_SKETCHES && !SKETCH_SKILL}  ◆ Raw sketches in .planning/sketches/ — consider `/gsd-sketch-wrap-up` to package findings

These findings will be incorporated into project context and available to planning agents.
```

如果存在 spike/sketch findings skills，读取它们的 `SKILL.md` 文件，用于指导提问阶段；这些文件中包含已经验证的模式、约束和设计决策，应影响项目定义。

## 3. 深度提问

**如果是 auto mode：** 跳过（已在 Step 2a 处理）。改为从提供的文档中提取项目上下文，然后继续执行 Step 4。

**显示阶段横幅：**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**开启对话：**

内联提问（freeform，不要使用 AskUserQuestion）：

`"What do you want to build?"`

等待用户回复。这会给你后续进行智能追问所需的上下文。

**Research-before-questions mode：** 检查 `.planning/config.json`（或 init 上下文中的配置）中是否启用了 `workflow.research_before_questions`。如果启用，那么在围绕某个主题进行后续提问之前：

1. 先做一次与用户描述相关的最佳实践简要 web 搜索
2. 在提问时自然提到关键发现（例如：`"Most projects like this use X — is that what you're thinking, or something different?"`）
3. 这样能让问题更有依据，同时不改变对话节奏

如果未启用（默认），则像以前一样直接提问。

**顺着线索继续追问：**

根据用户所说的内容，继续提出深入追问。使用 AskUserQuestion，提供能探查其提及内容的选项，包括不同理解方式、澄清问题和具体示例。

继续追踪每条线索。每个回答都会引出新的线索。可以围绕以下方面提问：

- 什么让他们兴奋
- 是什么问题触发了这个想法
- 他们口中的模糊术语具体指什么
- 实际上会呈现为什么样子
- 哪些事情已经确定了

参考 `questioning.md` 中的技巧：

- 挑战模糊表述
- 把抽象变成具体
- 暴露隐藏假设
- 找到边界条件
- 揭示动机

**检查上下文（只在脑中，不要说出来）：**

随着提问推进，在心里对照 `questioning.md` 中的 context checklist。如果仍有缺口，就自然地将问题编织进对话。不要突然切换成 checklist 模式。

**Decision gate：**

当你已经能够写出清晰的 PROJECT.md 时，使用 AskUserQuestion：

- header: `"Ready?"`
- question: `"I think I understand what you're after. Ready to create PROJECT.md?"`
- options:
  - `"Create PROJECT.md"` — 继续推进
  - `"Keep exploring"` — 我还想补充 / 继续问我

如果选择 `"Keep exploring"`：询问他们还想补充什么，或识别缺口并自然追问。

循环直到选择 `"Create PROJECT.md"`。

## 4. 写入 PROJECT.md

**如果是 auto mode：** 根据提供的文档生成。由于不会显示 `"Ready?"` gate，因此直接进入 commit。

将收集到的全部上下文整合为 `.planning/PROJECT.md`，使用 `templates/project.md` 模板。

**对于 greenfield 项目：**

将 requirements 初始化为假设：

```markdown
## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] [Requirement 3]

### Out of Scope

- [Exclusion 1] — [why]
- [Exclusion 2] — [why]
```

所有 Active requirements 在交付并验证之前都只是 hypotheses。

**对于 brownfield 项目（存在 codebase map）：**

从现有代码中推断 Validated requirements：

1. 读取 `.planning/codebase/ARCHITECTURE.md` 和 `STACK.md`
2. 识别代码库当前已经具备的能力
3. 将这些内容作为初始的 Validated 集合

```markdown
## Requirements

### Validated

- ✓ [Existing capability 1] — existing
- ✓ [Existing capability 2] — existing
- ✓ [Existing capability 3] — existing

### Active

- [ ] [New requirement 1]
- [ ] [New requirement 2]

### Out of Scope

- [Exclusion 1] — [why]
```

**Key Decisions：**

初始化时加入提问阶段已经做出的决策：

```markdown
## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice from questioning] | [Why] | — Pending |
```

**Last updated footer：**

```markdown
---
*Last updated: [date] after initialization*
```

**Evolution section**（放在 PROJECT.md 末尾、footer 前）：

```markdown
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
```

不要压缩内容。把收集到的内容完整写进去。

**Commit PROJECT.md：**

```bash
mkdir -p .planning
gsd-sdk query commit "docs: initialize project" .planning/PROJECT.md
```

## 5. Workflow Preferences

**如果是 auto mode：** 跳过，config 已在 Step 2a 收集。继续执行 Step 5.5。

**检查全局默认值** `~/.gsd/defaults.json`。如果文件存在，先读取并展示其内容，然后再提问：

```bash
DEFAULTS_RAW=$(cat ~/.gsd/defaults.json 2>/dev/null)
```

使用以下标签映射，将 JSON 格式化为易读的 bullets：
- `mode` → `"Mode"`
- `granularity` → `"Granularity"`
- `parallelization` → `"Execution"`（`true` → `"Parallel"`，`false` → `"Sequential"`）
- `commit_docs` → `"Git Tracking"`（`true` → `"Yes"`，`false` → `"No"`）
- `model_profile` → `"AI Models"`
- `workflow.research` → `"Research"`（`true` → `"Yes"`，`false` → `"No"`）
- `workflow.plan_check` → `"Plan Check"`（`true` → `"Yes"`，`false` → `"No"`）
- `workflow.verifier` → `"Verifier"`（`true` → `"Yes"`，`false` → `"No"`）

在提示上方展示：

```text
Your saved defaults (~/.gsd/defaults.json):
  • Mode: [value]
  • Granularity: [value]
  • Execution: [Parallel|Sequential]
  • Git Tracking: [Yes|No]
  • AI Models: [value]
  • Research: [Yes|No]
  • Plan Check: [Yes|No]
  • Verifier: [Yes|No]
```

然后提问：

```text
AskUserQuestion([
  {
    question: "Use these saved defaults?",
    header: "Defaults",
    multiSelect: false,
    options: [
      { label: "Use as-is (Recommended)", description: "Proceed with the defaults shown above" },
      { label: "Modify some settings", description: "Keep defaults, change a few" },
      { label: "Configure fresh", description: "Walk through all questions from scratch" }
    ]
  }
])
```

**如果选择 `"Use as-is"`：** 将 defaults 中的值用于 `config.json`，并直接跳到下方的 **Commit config.json**。

**如果选择 `"Modify some settings"`：** 展示每个 setting 及其当前保存值，供用户选择。

**如果启用了 TEXT_MODE**（非 Claude runtime）：显示一个编号列表，并要求用户输入想修改的 setting 编号（逗号分隔）。解析用户输入后继续。

```text
Which settings do you want to change? (enter numbers, comma-separated)

  1. Mode — Currently: [value]
  2. Granularity — Currently: [value]
  3. Execution — Currently: [Parallel|Sequential]
  4. Git Tracking — Currently: [Yes|No]
  5. AI Models — Currently: [value]
  6. Research — Currently: [Yes|No]
  7. Plan Check — Currently: [Yes|No]
  8. Verifier — Currently: [Yes|No]
```

**否则**（Claude runtime 且可用 AskUserQuestion）：使用 `multiSelect`：

```text
AskUserQuestion([
  {
    question: "Which settings do you want to change?",
    header: "Change Settings",
    multiSelect: true,
    options: [
      { label: "Mode", description: "Currently: [value]" },
      { label: "Granularity", description: "Currently: [value]" },
      { label: "Execution", description: "Currently: [Parallel|Sequential]" },
      { label: "Git Tracking", description: "Currently: [Yes|No]" },
      { label: "AI Models", description: "Currently: [value]" },
      { label: "Research", description: "Currently: [Yes|No]" },
      { label: "Plan Check", description: "Currently: [Yes|No]" },
      { label: "Verifier", description: "Currently: [Yes|No]" }
    ]
  }
])
```

对于每个选中的 setting，只提问该 setting 对应的问题，并使用下方 Round 1 / Round 2 中的选项。将用户答案覆盖到保存的 defaults 之上；未修改的 settings 保持原值。随后跳到 **Commit config.json**。

**如果选择 `"Configure fresh"`，或者 `~/.gsd/defaults.json` 不存在：** 继续执行下面的问题。

**Round 1 — Core workflow settings（4 个问题）：**

```
questions: [
  {
    header: "Mode",
    question: "How do you want to work?",
    multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "Auto-approve, just execute" },
      { label: "Interactive", description: "Confirm at each step" }
    ]
  },
  {
    header: "Granularity",
    question: "How finely should scope be sliced into phases?",
    multiSelect: false,
    options: [
      { label: "Coarse", description: "Fewer, broader phases (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced phase size (5-8 phases, 3-5 plans each)" },
      { label: "Fine", description: "Many focused phases (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
]
```

**Round 2 — Workflow agents：**

这些 agents 会在 planning/execution 期间额外启动。它们会增加 tokens 和时间成本，但能提升质量。

| Agent | 运行时机 | 作用 |
|-------|--------------|--------------|
| **Researcher** | 每个 phase 规划前 | 研究领域、寻找模式、暴露 gotchas |
| **Plan Checker** | plan 创建后 | 验证 plan 是否真的能达成 phase goal |
| **Verifier** | phase 执行后 | 确认 must-haves 是否已交付 |

重要项目建议全部开启。快速实验可以跳过。

```
questions: [
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" },
      { label: "Inherit", description: "Use the current session model for all agents (OpenCode /model)" }
    ]
  }
]
```

使用全部设置创建 `.planning/config.json`（CLI 会自动补全剩余默认值）：

```bash
mkdir -p .planning
gsd-sdk query config-new-project '{"mode":"[yolo|interactive]","granularity":"[selected]","parallelization":true|false,"commit_docs":true|false,"model_profile":"quality|balanced|budget|inherit","workflow":{"research":true|false,"plan_check":true|false,"verifier":true|false,"nyquist_validation":[false if granularity=coarse, true otherwise]}}'
```

**Note：** 随时可运行 `/gsd-settings` 更新 model profile、workflow agents、branching strategy 及其他偏好。

**如果 `commit_docs = No`：**

- 在 `config.json` 中设置 `commit_docs: false`
- 将 `.planning/` 加入 `.gitignore`（如有需要则创建该文件）

**如果 `commit_docs = Yes`：**

- 不需要额外添加 gitignore 条目

**Commit config.json：**

```bash
gsd-sdk query commit "chore: add project config" .planning/config.json
```

## 5.1. Sub-Repo Detection

**检测 multi-repo workspace：**

检查是否存在带有各自 `.git` 目录的子目录（即 workspace 内的独立 repos）：

```bash
find . -maxdepth 1 -type d -not -name ".*" -not -name "node_modules" -exec test -d "{}/.git" \; -print
```

**如果发现 sub-repos：**

去掉 `./` 前缀，得到目录名（例如 `./backend` → `backend`）。

使用 AskUserQuestion：

- header: `"Multi-Repo Workspace"`
- question: `"I detected separate git repos in this workspace. Which directories contain code that GSD should commit to?"`
- multiSelect: true
- options: 为每个检测到的目录提供一个选项
  - `"[directory name]"` — 独立 git repo

**如果用户选择了一个或多个目录：**

- 将 `planning.sub_repos` 设置为所选目录名数组（例如 `[...]`）
- 自动将 `planning.commit_docs` 设为 `false`（在 multi-repo workspace 中，planning docs 保持本地）
- 如果 `.planning/` 尚未加入 `.gitignore`，则添加进去

这些 config 修改只保存在本地，不需要 commit，因为 multi-repo mode 下 `commit_docs` 为 `false`。

**如果没有发现 sub-repos，或用户没有选择任何项：** 不做修改，继续后续步骤。

## 5.5. 解析 Model Profile

使用 init 中提供的 models：`researcher_model`、`synthesizer_model`、`roadmapper_model`。

## 6. Research Decision

**如果是 auto mode：** 不提问，默认选择 `"Research first"`。

使用 AskUserQuestion：

- header: `"Research"`
- question: `"Research the domain ecosystem before defining requirements?"`
- options:
  - `"Research first (Recommended)"` — 发现标准 stack、常见功能、架构模式
  - `"Skip research"` — 我很熟悉这个领域，直接进入 requirements

**如果选择 `"Research first"`：**

显示阶段横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Researching [domain] ecosystem...
```

创建 research 目录：

```bash
mkdir -p .planning/research
```

**确定 milestone 上下文：**

检查当前是 greenfield 还是后续 milestone：

- 如果 PROJECT.md 中没有 `Validated` requirements → Greenfield（从零开始构建）
- 如果存在 `Validated` requirements → Subsequent milestone（在现有 app 上继续扩展）

显示启动指示：

```
◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

使用路径引用并行启动 4 个 `gsd-project-researcher` agents：

```
Task(prompt="<research_type>
Project Research — Stack dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: Research the standard stack for building [domain] from scratch.
Subsequent: Research what's needed to add [target features] to an existing [domain] app. Don't re-research the existing system.
</milestone_context>

<question>
What's the standard 2025 stack for [domain]?
</question>

<files_to_read>
- {project_path} (Project context and goals)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>
Your STACK.md feeds into roadmap creation. Be prescriptive:
- Specific libraries with versions
- Clear rationale for each choice
- What NOT to use and why
</downstream_consumer>

<quality_gate>
- [ ] Versions are current (verify with Context7/official docs, not training data)
- [ ] Rationale explains WHY, not just WHAT
- [ ] Confidence levels assigned to each recommendation
</quality_gate>

<output>
Write to: .planning/research/STACK.md
Use template: ~/.claude/get-shit-done/templates/research-project/STACK.md
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Stack research")

Task(prompt="<research_type>
Project Research — Features dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What features do [domain] products have? What's table stakes vs differentiating?
Subsequent: How do [target features] typically work? What's expected behavior?
</milestone_context>

<question>
What features do [domain] products have? What's table stakes vs differentiating?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>
Your FEATURES.md feeds into requirements definition. Categorize clearly:
- Table stakes (must have or users leave)
- Differentiators (competitive advantage)
- Anti-features (things to deliberately NOT build)
</downstream_consumer>

<quality_gate>
- [ ] Categories are clear (table stakes vs differentiators vs anti-features)
- [ ] Complexity noted for each feature
- [ ] Dependencies between features identified
</quality_gate>

<output>
Write to: .planning/research/FEATURES.md
Use template: ~/.claude/get-shit-done/templates/research-project/FEATURES.md
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Features research")

Task(prompt="<research_type>
Project Research — Architecture dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: How are [domain] systems typically structured? What are major components?
Subsequent: How do [target features] integrate with existing [domain] architecture?
</milestone_context>

<question>
How are [domain] systems typically structured? What are major components?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>
Your ARCHITECTURE.md informs phase structure in roadmap. Include:
- Component boundaries (what talks to what)
- Data flow (how information moves)
- Suggested build order (dependencies between components)
</downstream_consumer>

<quality_gate>
- [ ] Components clearly defined with boundaries
- [ ] Data flow direction explicit
- [ ] Build order implications noted
</quality_gate>

<output>
Write to: .planning/research/ARCHITECTURE.md
Use template: ~/.claude/get-shit-done/templates/research-project/ARCHITECTURE.md
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Architecture research")

Task(prompt="<research_type>
Project Research — Pitfalls dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What do [domain] projects commonly get wrong? Critical mistakes?
Subsequent: What are common mistakes when adding [target features] to [domain]?
</milestone_context>

<question>
What do [domain] projects commonly get wrong? Critical mistakes?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>
Your PITFALLS.md prevents mistakes in roadmap/planning. For each pitfall:
- Warning signs (how to detect early)
- Prevention strategy (how to avoid)
- Which phase should address it
</downstream_consumer>

<quality_gate>
- [ ] Pitfalls are specific to this domain (not generic advice)
- [ ] Prevention strategies are actionable
- [ ] Phase mapping included where relevant
</quality_gate>

<output>
Write to: .planning/research/PITFALLS.md
Use template: ~/.claude/get-shit-done/templates/research-project/PITFALLS.md
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Pitfalls research")
```

4 个 agents 完成后，启动 synthesizer 生成 `SUMMARY.md`：

```
Task(prompt="
<task>
Synthesize research outputs into SUMMARY.md.
</task>

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>

${AGENT_SKILLS_SYNTHESIZER}

<output>
Write to: .planning/research/SUMMARY.md
Use template: ~/.claude/get-shit-done/templates/research-project/SUMMARY.md
Commit after writing.
</output>
", subagent_type="gsd-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

显示 research 完成横幅和关键发现：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Key Findings

**Stack:** [from SUMMARY.md]
**Table Stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]

Files: `.planning/research/`
```

**如果选择 `"Skip research"`：** 继续执行 Step 7。

## 7. 定义 Requirements

显示阶段横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**加载上下文：**

读取 PROJECT.md，并提取：

- Core value（必须成立的那一个核心点）
- 已说明的约束（预算、时间线、技术限制）
- 任何明确的 scope 边界

**如果存在 research：** 读取 `research/FEATURES.md` 并提取 feature categories。

**如果是 auto mode：**

- 自动纳入所有 table stakes features（用户会期待这些）
- 纳入提供文档中明确提到的功能
- 自动将文档中未提到的 differentiators 延后
- 跳过按 category 使用 AskUserQuestion 的循环
- 跳过 `"Any additions?"` 问题
- 跳过 requirements approval gate
- 直接生成并 commit REQUIREMENTS.md

**按 category 展示功能（仅 interactive mode）：**

```
Here are the features for [domain]:

## Authentication
**Table stakes:**
- Sign up with email/password
- Email verification
- Password reset
- Session management

**Differentiators:**
- Magic link login
- OAuth (Google, GitHub)
- 2FA

**Research notes:** [any relevant notes]

---

## [Next Category]
...
```

**如果没有 research：** 改为通过对话收集 requirements。

提问：`"What are the main things users need to be able to do?"`

对于提到的每项能力：

- 提出澄清问题，使其具体化
- 追问相关能力
- 将内容按 category 分组

**为每个 category 设定范围：**

对每个 category，使用 AskUserQuestion：

- header: `"[Category]"`（最长 12 个字符）
- question: `"Which [category] features are in v1?"`
- multiSelect: true
- options:
  - `"[Feature 1]"` — [简短描述]
  - `"[Feature 2]"` — [简短描述]
  - `"[Feature 3]"` — [简短描述]
  - `"None for v1"` — 整个 category 延后

跟踪用户选择：

- 选中的功能 → v1 requirements
- 未选中的 table stakes → v2（用户会期待这些）
- 未选中的 differentiators → out of scope

**识别缺口：**

使用 AskUserQuestion：

- header: `"Additions"`
- question: `"Any requirements research missed? (Features specific to your vision)"`
- options:
  - `"No, research covered it"` — 继续
  - `"Yes, let me add some"` — 记录补充项

**验证 core value：**

将 requirements 与 PROJECT.md 中的 Core Value 交叉检查。如果发现缺口，就把它们明确指出来。

**生成 REQUIREMENTS.md：**

创建 `.planning/REQUIREMENTS.md`，包含：

- 按 category 分组的 v1 Requirements（checkboxes、REQ-IDs）
- v2 Requirements（延期）
- Out of Scope（带理由的明确排除项）
- Traceability section（先留空，由 roadmap 填充）

**REQ-ID 格式：** `[CATEGORY]-[NUMBER]`（如 `AUTH-01`、`CONTENT-02`）

**Requirement 质量标准：**

好的 requirements 应该：

- **Specific and testable：** `"User can reset password via email link"`（而不是 `"Handle password reset"`）
- **User-centric：** `"User can X"`（而不是 `"System does Y"`）
- **Atomic：** 每条 requirement 只表达一个能力（而不是 `"User can login and manage profile"`）
- **Independent：** 对其他 requirements 的依赖尽量少

拒绝模糊 requirements。推动其具体化：

- `"Handle authentication"` → `"User can log in with email/password and stay logged in across sessions"`
- `"Support sharing"` → `"User can share post via link that opens in recipient's browser"`

**展示完整的 requirements 列表（仅 interactive mode）：**

向用户展示每一条 requirement（不是数量汇总），供其确认：

```
## v1 Requirements

### Authentication
- [ ] **AUTH-01**: User can create account with email/password
- [ ] **AUTH-02**: User can log in and stay logged in across sessions
- [ ] **AUTH-03**: User can log out from any page

### Content
- [ ] **CONT-01**: User can create posts with text
- [ ] **CONT-02**: User can edit their own posts

[... full list ...]

---

Does this capture what you're building? (yes / adjust)
```

如果选择 `"adjust"`：返回 scoping。

**Commit requirements：**

```bash
gsd-sdk query commit "docs: define v1 requirements" .planning/REQUIREMENTS.md
```

## 8. 创建 Roadmap

显示阶段横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

使用路径引用启动 `gsd-roadmapper` agent：

```
Task(prompt="
<planning_context>

<files_to_read>
- .planning/PROJECT.md (Project context)
- .planning/REQUIREMENTS.md (v1 Requirements)
- .planning/research/SUMMARY.md (Research findings - if exists)
- .planning/config.json (Granularity and mode settings)
</files_to_read>

${AGENT_SKILLS_ROADMAPPER}

</planning_context>

<instructions>
Create roadmap:
1. Derive phases from requirements (don't impose structure)
2. Map every v1 requirement to exactly one phase
3. Derive 2-5 success criteria per phase (observable user behaviors)
4. Validate 100% coverage
5. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
6. Return ROADMAP CREATED with summary

Write files first, then return. This ensures artifacts persist even if context is lost.
</instructions>
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**处理 roadmapper 返回结果：**

**如果返回 `## ROADMAP BLOCKED`：**

- 展示 blocker 信息
- 与用户一起解决
- 解决后重新启动

**如果返回 `## ROADMAP CREATED`：**

读取生成的 ROADMAP.md，并以内联形式清晰展示：

```
---

## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | [Name] | [Goal] | [REQ-IDs] | [count] |
| 2 | [Name] | [Goal] | [REQ-IDs] | [count] |
| 3 | [Name] | [Goal] | [REQ-IDs] | [count] |
...

### Phase Details

**Phase 1: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
3. [criterion]

**Phase 2: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]

[... continue for all phases ...]

---
```

**如果是 auto mode：** 跳过 approval gate，直接自动批准并 commit。

**CRITICAL：在 commit 前先请求批准（仅 interactive mode）：**

使用 AskUserQuestion：

- header: `"Roadmap"`
- question: `"Does this roadmap structure work for you?"`
- options:
  - `"Approve"` — Commit 并继续
  - `"Adjust phases"` — 告诉我需要修改什么
  - `"Review full file"` — 显示原始 ROADMAP.md

**如果选择 `"Approve"`：** 继续 commit。

**如果选择 `"Adjust phases"`：**

- 获取用户的调整意见
- 带着修订上下文重新启动 roadmapper：

  ```
  Task(prompt="
  <revision>
  User feedback on roadmap:
  [user's notes]

  <files_to_read>
  - .planning/ROADMAP.md (Current roadmap to revise)
  </files_to_read>

  ${AGENT_SKILLS_ROADMAPPER}

  Update the roadmap based on feedback. Edit files in place.
  Return ROADMAP REVISED with changes made.
  </revision>
  ", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Revise roadmap")
  ```

- 展示修订后的 roadmap
- 循环直到用户批准

**如果选择 `"Review full file"`：** 显示原始 `cat .planning/ROADMAP.md`，然后再次询问。

**在最终 commit 前生成或刷新项目 instruction file：**

```bash
gsd-sdk query generate-claude-md --output "$INSTRUCTION_FILE"
```

这样可确保新项目获得默认的 GSD workflow enforcement 指南，以及写入 `$INSTRUCTION_FILE` 的当前项目上下文。

**Commit roadmap（批准后或 auto mode 下）：**

```bash
gsd-sdk query commit "docs: create roadmap ([N] phases)" .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md "$INSTRUCTION_FILE"
```

## 9. 完成

展示完成摘要：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[Project Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Config         | `.planning/config.json`     |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |
| Project guide  | `$INSTRUCTION_FILE`         |

**[N] phases** | **[X] requirements** | Ready to build ✓
```

**如果是 auto mode：**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE 1        ║
╚══════════════════════════════════════════╝
```

退出 skill，并调用 `SlashCommand("/gsd-discuss-phase 1 --auto")`

**如果是 interactive mode：**

检查 Phase 1 是否带有 UI indicators（在 ROADMAP.md 的 Phase 1 详情 section 中查找 `**UI hint**: yes`）：

```bash
PHASE1_SECTION=$(gsd-sdk query roadmap.get-phase 1 2>/dev/null)
PHASE1_HAS_UI=$(echo "$PHASE1_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**如果 Phase 1 存在 UI（`PHASE1_HAS_UI` 为 `true`）：**

```
───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/clear then:

/gsd-discuss-phase 1 — 收集上下文并澄清实现思路

---

**Also available:**
- /gsd-ui-phase 1 — 生成 UI design contract（推荐用于 frontend phases）
- /gsd-plan-phase 1 — 跳过讨论，直接规划

───────────────────────────────────────────────────────────────
```

**如果 Phase 1 没有 UI：**

```
───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/clear then:

/gsd-discuss-phase 1 — 收集上下文并澄清实现思路

---

**Also available:**
- /gsd-plan-phase 1 — 跳过讨论，直接规划

───────────────────────────────────────────────────────────────
```

</process>

<output>

- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/research/`（如果选择了 research）
  - `STACK.md`
  - `FEATURES.md`
  - `ARCHITECTURE.md`
  - `PITFALLS.md`
  - `SUMMARY.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `$INSTRUCTION_FILE`（Codex 为 `AGENTS.md`，其他所有 runtime 为 `CLAUDE.md`）

</output>

<success_criteria>

- [ ] 已创建 `.planning/` 目录
- [ ] 已初始化 Git repo
- [ ] 已完成 brownfield detection
- [ ] 已完成深度提问（跟进了线索，而不是草草结束）
- [ ] PROJECT.md 已完整记录上下文 → **committed**
- [ ] config.json 包含 workflow mode、granularity、parallelization → **committed**
- [ ] 已完成 Research（如果用户选择）— 已启动 4 个并行 agents → **committed**
- [ ] 已从 research 或对话中收集 requirements
- [ ] 用户已为每个 category 划定范围（v1/v2/out of scope）
- [ ] 已创建带有 REQ-IDs 的 REQUIREMENTS.md → **committed**
- [ ] 已在上下文充分的前提下启动 gsd-roadmapper
- [ ] Roadmap 文件已立即写入（不是 draft）
- [ ] 已纳入用户反馈（如有）
- [ ] 已创建包含 phases、requirement mappings、success criteria 的 ROADMAP.md
- [ ] 已初始化 STATE.md
- [ ] 已更新 REQUIREMENTS.md traceability
- [ ] 已生成包含 GSD workflow 指南的 `$INSTRUCTION_FILE`（Codex 为 AGENTS.md，其他情况为 CLAUDE.md）
- [ ] 用户知道下一步是 `/gsd-discuss-phase 1`

**Atomic commits：** 每个阶段都会立即提交其产物。即使 context 丢失，产物仍然会保留。

</success_criteria>
