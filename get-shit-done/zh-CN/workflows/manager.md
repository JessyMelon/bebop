<purpose>

用于在单个终端中管理一个 milestone 的交互式命令中心。显示所有 phase 的 dashboard 和可视状态；以内联方式分发 discuss，以后台 agent 分发 plan/execute；并在每次操作后回到 dashboard。从一个终端支持并行 phase 工作。

</purpose>

<required_reading>

开始前，读取调用 prompt 的 execution_context 中引用的所有文件。

</required_reading>

<process>

<step name="initialize" priority="first">

## 1. Initialize

通过 manager init 启动：

```bash
INIT=$(gsd-sdk query init.manager)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，获取：`milestone_version`、`milestone_name`、`phase_count`、`completed_count`、`in_progress_count`、`phases`、`recommended_actions`、`all_complete`、`waiting_signal`、`manager_flags`。

`manager_flags` 包含来自 config、按步骤透传的 flags：
- `manager_flags.discuss` — 追加到 `/gsd-discuss-phase` 参数（例如 `"--auto --analyze"`）
- `manager_flags.plan` — 追加到 plan agent init 命令
- `manager_flags.execute` — 追加到 execute agent init 命令

这些值默认都是空字符串。通过以下命令设置：`gsd-sdk query config-set manager.flags.discuss "--auto --analyze"`

**如果出错：**显示错误消息并退出。

显示启动横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MANAGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 {milestone_version} — {milestone_name}
 {phase_count} phases · {completed_count} complete

 ✓ Discuss → inline    ◆ Plan/Execute → background
 Dashboard auto-refreshes when background work is active.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

继续进入 dashboard 步骤。

</step>

<step name="dashboard">

## 2. Dashboard (Refresh Point)

**每次到达此步骤时**，都要重新从磁盘读取状态，以获取后台 agent 带来的更新：

```bash
INIT=$(gsd-sdk query init.manager)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析完整 JSON。构建 dashboard 显示。

根据 JSON 构建 dashboard。符号：`✓` 已完成，`◆` 活动中，`○` 待处理，`·` 已排队。进度条：20 字符的 `█░`。

**Status mapping**（disk_status → D P E Status）：

- `complete` → `✓ ✓ ✓` `✓ Complete`
- `partial` → `✓ ✓ ◆` `◆ Executing...`
- `planned` → `✓ ✓ ○` `○ Ready to execute`
- `discussed` → `✓ ○ ·` `○ Ready to plan`
- `researched` → `◆ · ·` `○ Ready to plan`
- `empty`/`no_directory` + `is_next_to_discuss` → `○ · ·` `○ Ready to discuss`
- `empty`/`no_directory` 否则 → `· · ·` `· Up next`
- 如果 `is_active` 为真，用 `◆` 替换状态图标，并追加 `(active)`

如果存在任意 `is_active` phases，在网格上方显示：`◆ Background: {action} Phase {N}, ...`。

Phase 列使用 `display_name`（不要用 `name`），它已预截断到 20 个字符，超出时以 `…` 结尾。将所有 phase 名称 pad 到相同宽度，保持对齐。

Deps 列使用 init JSON 中的 `deps_display`，用于显示该 phase 依赖哪些 phase（如 `1,3`），若无则显示 `—`。

示例输出：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ████████████░░░░░░░░ 60%  (3/5 phases)
 ◆ Background: Planning Phase 4
 | # | Phase                | Deps | D | P | E | Status              |
 |---|----------------------|------|---|---|---|---------------------|
 | 1 | Foundation           | —    | ✓ | ✓ | ✓ | ✓ Complete          |
 | 2 | API Layer            | 1    | ✓ | ✓ | ◆ | ◆ Executing (active)|
 | 3 | Auth System          | 1    | ✓ | ✓ | ○ | ○ Ready to execute  |
 | 4 | Dashboard UI & Set…  | 1,2  | ✓ | ◆ | · | ◆ Planning (active) |
 | 5 | Notifications        | —    | ○ | · | · | ○ Ready to discuss  |
 | 6 | Polish & Final Mail… | 1-5  | · | · | · | · Up next           |
```

**Recommendations section：**

如果 `all_complete` 为 true：

```
╔══════════════════════════════════════════════════════════════╗
║  MILESTONE COMPLETE                                          ║
╚══════════════════════════════════════════════════════════════╝

All {phase_count} phases done. Ready for final steps:
  → /gsd-verify-work — run acceptance testing
  → /gsd-complete-milestone — archive and wrap up
```


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对 `AskUserQuestion` 不可用的非 Claude runtime（OpenAI Codex、Gemini CLI 等）是必须的。
通过 AskUserQuestion 询问用户：
- **question:** "All phases complete. What next?"
- **options:** "Verify work" / "Complete milestone" / "Exit manager"

处理回复：
- "Verify work": `Skill(skill="gsd-verify-work")`，然后回到 dashboard。
- "Complete milestone": `Skill(skill="gsd-complete-milestone")`，然后退出。
- "Exit manager": 进入 exit 步骤。

**如果不是 all_complete**，根据 `recommended_actions` 构建复合选项：

**Compound option logic：** 将后台动作（plan/execute）组合在一起，并在存在时与唯一的内联动作（discuss）配对。目标是尽量减少选项数量，一个选项可以同时分发多个后台 agent，并附带一个内联动作。

**Building options：**

1. 收集所有后台动作（execute 和 plan 推荐项），每种都可能有多个。
2. 收集内联动作（如果有 discuss 推荐项；由于 discuss 是顺序执行，所以最多一个）。
3. 构建复合选项：

   **如果存在任意推荐动作（后台、内联或两者都有）：**
   创建一个主要的 "Continue" 选项，将它们全部一起分发：
   - Label: `"Continue"` — 必须始终使用这个精确单词
   - 在 label 下方列出将发生的每个动作。枚举**所有**推荐动作，不要截断：
     ```
     Continue:
       → Execute Phase 32 (background)
       → Plan Phase 34 (background)
       → Discuss Phase 35 (inline)
     ```
   - 它会先分发所有后台 agent，再运行内联 discuss（如果有）。
   - 如果没有内联 discuss，则在启动后台 agent 后刷新 dashboard。

   **重要：**Continue 选项必须包含 `recommended_actions` 中的**所有**动作，而不只是 2 个。3 个就列 3 个，5 个就列 5 个。

4. 始终再添加：
   - `"Refresh dashboard"`
   - `"Exit manager"`

紧凑显示 recommendations：

```
───────────────────────────────────────────────────────────────
▶ Next Steps
───────────────────────────────────────────────────────────────

Continue:
  → Execute Phase 32 (background)
  → Plan Phase 34 (background)
  → Discuss Phase 35 (inline)
```

**Auto-refresh：**如果后台 agent 正在运行（任意 phase 的 `is_active` 为 true），设置 60 秒自动刷新周期。呈现动作菜单后，如果 60 秒内未收到用户输入，则自动刷新 dashboard。该间隔可通过 GSD config 中的 `manager_refresh_interval` 配置（默认 60 秒，设为 0 则禁用）。

通过 AskUserQuestion 展示：
- **question:** "What would you like to do?"
- **options:**（按上面构建的复合选项 + refresh + exit，AskUserQuestion 会自动附加 "Other"）

**当用户选择 "Other"（自由输入）时：**解析意图。如果提到了 phase 编号和动作，就按此分发。若不清楚，则显示可用动作并回到 action_menu。

带着选中的动作进入 handle_action 步骤。

</step>

<step name="handle_action">

## 4. Handle Action

### Refresh Dashboard

回到 dashboard 步骤。

### Exit Manager

进入 exit 步骤。

### Compound Action (background + inline)

当用户选择复合选项时：

1. **先启动所有后台 agent**（plan/execute）—— 使用下面的 Plan Phase N / Execute Phase N handlers 并行分发。
2. **然后运行内联 discuss：**

```
Skill(skill="gsd-discuss-phase", args="{PHASE_NUM} {manager_flags.discuss}")
```

discuss 完成后，回到 dashboard（后台 agent 会继续运行）。

### Discuss Phase N

讨论是交互式的，需要用户输入。带上任何已配置的 flags 内联运行：

```
Skill(skill="gsd-discuss-phase", args="{PHASE_NUM} {manager_flags.discuss}")
```

discuss 完成后，回到 dashboard。

### Plan Phase N

规划是自治执行的。启动一个后台 agent，并带上已配置的 flags 委派给 Skill pipeline：

```
Task(
  description="Plan phase {N}: {phase_name}",
  run_in_background=true,
  prompt="You are running the GSD plan-phase workflow for phase {N} of the project.

Working directory: {cwd}
Phase: {N} — {phase_name}
Goal: {goal}
Manager flags: {manager_flags.plan}

Run the plan-phase Skill with any configured manager flags:
Skill(skill=\"gsd-plan-phase\", args=\"{N} --auto {manager_flags.plan}\")

This delegates to the full plan-phase pipeline including local patches, research, plan-checker, and all quality gates.

Important: You are running in the background. Do NOT use AskUserQuestion — make autonomous decisions based on project context. If you hit a blocker, write it to STATE.md as a blocker and stop. Do NOT silently work around permission or file access errors — let them fail so the manager can surface them with resolution hints. Do NOT use --no-verify on git commits."
)
```

显示：

```
◆ Spawning planner for Phase {N}: {phase_name}...
```

回到 dashboard 步骤。

### Execute Phase N

执行是自治进行的。启动一个后台 agent，并带上已配置的 flags 委派给 Skill pipeline：

```
Task(
  description="Execute phase {N}: {phase_name}",
  run_in_background=true,
  prompt="You are running the GSD execute-phase workflow for phase {N} of the project.

Working directory: {cwd}
Phase: {N} — {phase_name}
Goal: {goal}
Manager flags: {manager_flags.execute}

Run the execute-phase Skill with any configured manager flags:
Skill(skill=\"gsd-execute-phase\", args=\"{N} {manager_flags.execute}\")

This delegates to the full execute-phase pipeline including local patches, branching, wave-based execution, verification, and all quality gates.

Important: You are running in the background. Do NOT use AskUserQuestion — make autonomous decisions. Do NOT use --no-verify on git commits — let pre-commit hooks run normally. If you hit a permission error, file lock, or any access issue, do NOT work around it — let it fail and write the error to STATE.md as a blocker so the manager can surface it with resolution guidance."
)
```

显示：

```
◆ Spawning executor for Phase {N}: {phase_name}...
```

回到 dashboard 步骤。

</step>

<step name="background_completion">

## 5. Background Agent Completion

当收到后台 agent 完成通知时：

1. 读取 agent 的结果消息。
2. 显示简短通知：

```
✓ {description}
  {brief summary from agent result}
```

3. 回到 dashboard 步骤。

**如果 agent 报告了错误或 blocker：**

对错误进行分类：

**Permission / tool access error**（例如 tool 不允许、permission denied、sandbox restriction）：
- 解析错误，找出被阻止的是哪个 tool 或命令。
- 清楚显示错误，然后提供修复选项：
  - **question:** "Phase {N} failed — permission denied for `{tool_or_command}`. Want me to add it to settings.local.json so it's allowed?"
  - **options:** "Add permission and retry" / "Run this phase inline instead" / "Skip and continue"
  - "Add permission and retry"：使用 `Skill(skill="update-config")` 将权限加入 `settings.local.json`，然后重新启动后台 agent。回到 dashboard。
  - "Run this phase inline instead"：通过相应 Skill 以内联方式分发相同动作——若失败动作是 planning，则用 `Skill(skill="gsd-plan-phase", args="{N}")`；若是 execution，则用 `Skill(skill="gsd-execute-phase", args="{N}")`。之后回到 dashboard。
  - "Skip and continue"：回到 dashboard（phase 保持当前状态）。

**Other errors**（git lock、文件冲突、逻辑错误等）：
- 显示错误，然后通过 AskUserQuestion 提供选项：
  - **question:** "Background agent for Phase {N} encountered an issue: {error}. What next?"
  - **options:** "Retry" / "Run inline instead" / "Skip and continue" / "View details"
  - "Retry"：重新启动同一个后台 agent。回到 dashboard。
  - "Run inline instead"：通过相应 Skill 以内联方式分发动作——若失败动作是 planning，则用 `Skill(skill="gsd-plan-phase", args="{N}")`；若是 execution，则用 `Skill(skill="gsd-execute-phase", args="{N}")`。之后回到 dashboard。
  - "Skip and continue"：回到 dashboard（phase 保持当前状态）。
  - "View details"：读取 STATE.md 的 blockers 部分并展示，然后再次给出选项。

</step>

<step name="exit">

## 6. Exit

显示带进度条的最终状态：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SESSION END
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 {milestone_version} — {milestone_name}
 {PROGRESS_BAR} {progress_pct}%  ({completed_count}/{phase_count} phases)

 Resume anytime: /gsd-manager
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**注意：**任何仍在运行的后台 agent 都会继续执行直至完成。它们的结果会在下次调用 `/gsd-manager` 或 `/gsd-progress` 时可见。

</step>

</process>

<success_criteria>
- [ ] Dashboard 正确显示所有 phases 及状态指示（D/P/E/V columns）
- [ ] 进度条显示准确的完成百分比
- [ ] 依赖解析正确：被阻塞的 phase 会显示缺失的依赖
- [ ] Recommendations 按 execute > plan > discuss 排序
- [ ] Discuss phase 通过 `Skill()` 内联运行，交互问题可正常工作
- [ ] Plan phase 启动后台 Task agents，并立即返回 dashboard
- [ ] Execute phase 启动后台 Task agents，并立即返回 dashboard
- [ ] Dashboard 刷新可通过磁盘状态获取后台 agent 的变更
- [ ] 后台 agent 完成后会触发通知并刷新 dashboard
- [ ] 后台 agent 错误会提供 retry/skip 选项
- [ ] 全部完成状态会提供 verify-work 和 complete-milestone
- [ ] Exit 会显示最终状态和恢复指引
- [ ] 能解析 "Other" 自由输入中的 phase 编号和动作
- [ ] Manager 循环持续到用户退出或 milestone 完成
</success_criteria>
