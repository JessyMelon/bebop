<purpose>
通过多问题交互提示，配置 GSD 工作流 agents（research、plan_check、verifier）和 model profile 选择。根据用户偏好更新 `.planning/config.json`。可选地将设置保存为全局默认值（`~/.gsd/defaults.json`），供后续项目使用。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="ensure_and_load_config">
确保 config 存在并加载当前状态：

```bash
gsd-sdk query config-ensure-section
INIT=$(gsd-sdk query state.load)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# `state.load` returns STATE frontmatter JSON from the SDK — it does not include `config_path`. Orchestrators may set `GSD_CONFIG_PATH` from init phase-op JSON; otherwise resolve the same path gsd-tools uses for flat vs active workstream (#2282).
if [[ -z "${GSD_CONFIG_PATH:-}" ]]; then
  if [[ -f .planning/active-workstream ]]; then
    WS=$(tr -d '\n\r' < .planning/active-workstream)
    GSD_CONFIG_PATH=".planning/workstreams/${WS}/config.json"
  else
    GSD_CONFIG_PATH=".planning/config.json"
  fi
fi
```

如果缺失，就在解析出的路径创建带默认值的 `config.json`。`INIT` 仍保留 `state.load` 的输出，供任何需要 STATE 字段的步骤使用。
保存 `$GSD_CONFIG_PATH`；后续所有读取和写入都使用这个路径，而不是写死 `.planning/config.json`，这样 active-workstream 安装会写到正确文件（#2282）。
</step>

<step name="read_current">
```bash
cat "$GSD_CONFIG_PATH"
```

解析当前值（若不存在则默认为 `true`）：
- `workflow.research` — 在 plan-phase 期间启动 researcher
- `workflow.plan_check` — 在 plan-phase 期间启动 plan checker
- `workflow.verifier` — 在 execute-phase 期间启动 verifier
- `workflow.nyquist_validation` — 在 plan-phase 期间进行 validation 架构研究（若缺失则默认：true）
- `workflow.ui_phase` — 为 frontend phases 生成 UI-SPEC.md 设计约束（若缺失则默认：true）
- `workflow.ui_safety_gate` — 在规划 frontend phases 前提示运行 /gsd-ui-phase（若缺失则默认：true）
- `workflow.ai_integration_phase` — 为 AI phases 进行框架选择和 eval 策略设计（若缺失则默认：true）
- `model_profile` — 每个 agent 使用哪个 model（默认：`balanced`）
- `git.branching_strategy` — 分支策略（默认：`"none"`）
- `workflow.use_worktrees` — 并行 executor agents 是否在 worktree 隔离中运行（默认：`true`）
</step>

<step name="present_settings">

**文本模式（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。

**非 Claude 运行时说明：** 如果启用了 `TEXT_MODE`（即运行时不是 Claude），在 model profile 问题前加上以下提示：

```
Note: Quality, Balanced, and Budget profiles select Claude model tiers (Opus/Sonnet/Haiku).
On non-Claude runtimes (Codex, Gemini CLI, etc.) these profiles have no effect on actual
model selection — GSD agents will use the runtime's default model.
Choose "Inherit" to use the session model for all agents, or configure model_overrides
manually in .planning/config.json to target specific models for this runtime.
```

使用 `AskUserQuestion`，并将当前值预选：

```
AskUserQuestion([
  {
    question: "Which model profile for agents?",
    header: "Model",
    multiSelect: false,
    options: [
      { label: "Quality", description: "Opus everywhere except verification (highest cost) — Claude only" },
      { label: "Balanced (Recommended)", description: "Opus for planning, Sonnet for research/execution/verification — Claude only" },
      { label: "Budget", description: "Sonnet for writing, Haiku for research/verification (lowest cost) — Claude only" },
      { label: "Inherit", description: "Use current session model for all agents (required for non-Claude runtimes: Codex, Gemini CLI, OpenRouter, local models)" }
    ]
  },
  {
    question: "Spawn Plan Researcher? (researches domain before planning)",
    header: "Research",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Research phase goals before planning" },
      { label: "No", description: "Skip research, plan directly" }
    ]
  },
  {
    question: "Spawn Plan Checker? (verifies plans before execution)",
    header: "Plan Check",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Verify plans meet phase goals" },
      { label: "No", description: "Skip plan verification" }
    ]
  },
  {
    question: "Spawn Execution Verifier? (verifies phase completion)",
    header: "Verifier",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Verify must-haves after execution" },
      { label: "No", description: "Skip post-execution verification" }
    ]
  },
  {
    question: "Auto-advance pipeline? (discuss → plan → execute automatically)",
    header: "Auto",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Manual /clear + paste between stages" },
      { label: "Yes", description: "Chain stages via Task() subagents (same isolation)" }
    ]
  },
  {
    question: "Enable Nyquist Validation? (researches test coverage during planning)",
    header: "Nyquist",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Research automated test coverage during plan-phase. Adds validation requirements to plans. Blocks approval if tasks lack automated verify." },
      { label: "No", description: "Skip validation research. Good for rapid prototyping or no-test phases." }
    ]
  },
  // Note: Nyquist validation depends on research output. If research is disabled,
  // plan-phase automatically skips Nyquist steps (no RESEARCH.md to extract from).
  {
    question: "Enable UI Phase? (generates UI-SPEC.md design contracts for frontend phases)",
    header: "UI Phase",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Generate UI design contracts before planning frontend phases. Locks spacing, typography, color, and copywriting." },
      { label: "No", description: "Skip UI-SPEC generation. Good for backend-only projects or API phases." }
    ]
  },
  {
    question: "Enable UI Safety Gate? (prompts to run /gsd-ui-phase before planning frontend phases)",
    header: "UI Gate",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "plan-phase asks to run /gsd-ui-phase first when frontend indicators detected." },
      { label: "No", description: "No prompt — plan-phase proceeds without UI-SPEC check." }
    ]
  },
  {
    question: "Enable AI Phase? (framework selection + eval strategy for AI phases)",
    header: "AI Phase",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Run /gsd-ai-phase before planning AI system phases. Surfaces the right framework, researches its docs, and designs the evaluation strategy." },
      { label: "No", description: "Skip AI design contract. Good for non-AI phases or when framework is already decided." }
    ]
  },
  {
    question: "Git branching strategy?",
    header: "Branching",
    multiSelect: false,
    options: [
      { label: "None (Recommended)", description: "Commit directly to current branch" },
      { label: "Per Phase", description: "Create branch for each phase (gsd/phase-{N}-{name})" },
      { label: "Per Milestone", description: "Create branch for entire milestone (gsd/{version}-{name})" }
    ]
  },
  {
    question: "Enable context window warnings? (injects advisory messages when context is getting full)",
    header: "Ctx Warnings",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Warn when context usage exceeds 65%. Helps avoid losing work." },
      { label: "No", description: "Disable warnings. Allows Claude to reach auto-compact naturally. Good for long unattended runs." }
    ]
  },
  {
    question: "Research best practices before asking questions? (web search during new-project and discuss-phase)",
    header: "Research Qs",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Ask questions directly. Faster, uses fewer tokens." },
      { label: "Yes", description: "Search web for best practices before each question group. More informed questions but uses more tokens." }
    ]
  },
  {
    question: "Skip discuss-phase in autonomous mode? (use ROADMAP phase goals as spec)",
    header: "Skip Discuss",
    multiSelect: false,
    options: [
      { label: "No (Recommended)", description: "Run smart discuss before each phase — surfaces gray areas and captures decisions." },
      { label: "Yes", description: "Skip discuss in /gsd-autonomous — chain directly to plan. Best for backend/pipeline work where phase descriptions are the spec." }
    ]
  },
  {
    question: "Use git worktrees for parallel agent isolation?",
    header: "Worktrees",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Each parallel executor runs in its own worktree branch — no conflicts between agents." },
      { label: "No", description: "Disable worktree isolation. Agents run sequentially on the main working tree. Use if EnterWorktree creates branches from wrong base (known cross-platform issue)." }
    ]
  }
])
```
</step>

<step name="update_config">
将新设置合并到现有 `config.json`：

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget" | "adaptive" | "inherit",
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "auto_advance": true/false,
    "nyquist_validation": true/false,
    "ui_phase": true/false,
    "ui_safety_gate": true/false,
    "ai_integration_phase": true/false,
    "text_mode": true/false,
    "research_before_questions": true/false,
    "discuss_mode": "discuss" | "assumptions",
    "skip_discuss": true/false,
    "use_worktrees": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone",
    "quick_branch_template": <string|null>
  },
  "hooks": {
    "context_warnings": true/false,
    "workflow_guard": true/false
  }
}
```

将更新后的 config 写入 `$GSD_CONFIG_PATH`（即 `ensure_and_load_config` 中解析出的 workstream-aware 路径）。不要把 `.planning/config.json` 写死；workstream 安装应写到 `.planning/workstreams/<slug>/config.json`。
</step>

<step name="save_as_defaults">
询问是否把这些设置保存为后续项目的全局默认值：

```
AskUserQuestion([
  {
    question: "Save these as default settings for all new projects?",
    header: "Defaults",
    multiSelect: false,
    options: [
      { label: "Yes", description: "New projects start with these settings (saved to ~/.gsd/defaults.json)" },
      { label: "No", description: "Only apply to this project" }
    ]
  }
])
```

如果选 “Yes”：将相同的 config 对象（去掉 `brave_search` 等项目特定字段）写入 `~/.gsd/defaults.json`：

```bash
mkdir -p ~/.gsd
```

写入 `~/.gsd/defaults.json`，内容如下：
```json
{
  "mode": <current>,
  "granularity": <current>,
  "model_profile": <current>,
  "commit_docs": <current>,
  "parallelization": <current>,
  "branching_strategy": <current>,
  "quick_branch_template": <current>,
  "workflow": {
    "research": <current>,
    "plan_check": <current>,
    "verifier": <current>,
    "auto_advance": <current>,
    "nyquist_validation": <current>,
    "ui_phase": <current>,
    "ui_safety_gate": <current>,
    "ai_integration_phase": <current>,
    "skip_discuss": <current>
  }
}
```
</step>

<step name="confirm">
显示：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting              | Value |
|----------------------|-------|
| Model Profile        | {quality/balanced/budget/inherit} |
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |
| Auto-Advance         | {On/Off} |
| Nyquist Validation   | {On/Off} |
| UI Phase             | {On/Off} |
| UI Safety Gate       | {On/Off} |
| AI Integration Phase | {On/Off} |
| Git Branching        | {None/Per Phase/Per Milestone} |
| Skip Discuss         | {On/Off} |
| Context Warnings     | {On/Off} |
| Saved as Defaults    | {Yes/No} |

这些设置会应用到后续的 /gsd-plan-phase 和 /gsd-execute-phase 运行。

快捷命令：
- /gsd-set-profile <profile> — 切换 model profile
- /gsd-plan-phase --research — 强制执行 research
- /gsd-plan-phase --skip-research — 跳过 research
- /gsd-plan-phase --skip-verify — 跳过 plan check
```
</step>

</process>

<success_criteria>
- [ ] 已读取当前 config
- [ ] 已向用户展示 14 项设置（profile + 11 个 workflow 开关 + git branching + ctx warnings）
- [ ] 已用 model_profile、workflow 和 git sections 更新 config
- [ ] 已询问用户是否保存为全局默认值（`~/.gsd/defaults.json`）
- [ ] 已向用户确认变更
</success_criteria>
