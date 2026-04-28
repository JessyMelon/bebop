# Ultraplan Phase Workflow [BETA]

把 GSD 的 plan phase 卸载到 Claude Code 的 ultraplan 云基础设施上执行。

⚠ **BETA 功能。** Ultraplan 目前处于 research preview，后续可能变化。这个 workflow 被有意与 /gsd-plan-phase 隔离，这样上游对 ultraplan 的变更就不会影响核心规划流水线。

---

<step name="banner">

显示阶段横幅：

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► ULTRAPLAN PHASE  ⚠ BETA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ultraplan 目前处于 research preview（Claude Code v2.1.91+）。
稳定的本地规划请使用 /gsd-plan-phase。
```

</step>

---

<step name="runtime_gate">

检查当前 session 是否运行在 Claude Code 中：

```bash
echo "$CLAUDE_CODE_VERSION"
```

如果输出为空或未设置，显示以下错误并退出：

```text
╔══════════════════════════════════════════════════════════════╗
║  RUNTIME ERROR                                               ║
╚══════════════════════════════════════════════════════════════╝

/gsd-ultraplan-phase 需要 Claude Code。
当前 runtime 不支持 ultraplan。

请改用 /gsd-plan-phase 进行本地规划。
```

</step>

---

<step name="initialize">

从 `$ARGUMENTS` 解析 phase number。如果未提供，就从 roadmap 中检测下一个未规划的 phase（逻辑与 /gsd-plan-phase 相同）。

加载 GSD phase context：

```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，获取：`phase_found`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `phase_dir`, `roadmap_path`, `requirements_path`, `research_path`, `planning_exists`。

**如果 `planning_exists` 为 false：** 报错并退出：

```text
未找到 .planning 目录。请先初始化项目：

/gsd-new-project
```

**如果 `phase_found` 为 false：** 用用户提供的 phase number 报错并退出。

显示检测到的 phase：

```text
Phase {N}: {phase name}
```

</step>

---

<step name="build_prompt">

基于 GSD context 构建 ultraplan prompt。

1. 从 ROADMAP.md 读取 phase scope，提取目标 phase 的 goal、deliverables 和 scope。

2. 如果 REQUIREMENTS.md 存在（`requirements_path` 不为 null），读取并提取简明摘要（只保留与当前 phase 相关的关键 requirements，而不是整份文档）。

3. 如果 RESEARCH.md 存在（`research_path` 不为 null），读取并提取技术结论的简明摘要。加入这些内容可以减少云端重复 research。

构造 prompt：

```text
Plan phase {phase_number}: {phase_name}

## Phase Scope (from ROADMAP.md)

{phase scope block extracted from ROADMAP.md}

## Requirements Context

{requirements summary, or "No REQUIREMENTS.md found — infer from phase scope."}

## Existing Research

{research summary, or "No RESEARCH.md found — research from scratch."}

## Output Format

产出一个 GSD PLAN.md，并使用以下 YAML frontmatter：

---
phase: "{padded_phase}-{phase_slug}"
plan: "{padded_phase}-01"
type: "feature"
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths: []
  artifacts: []
---

然后提供一个 `## Plan` section，包含编号任务。每个任务都应具备：
- 清晰的祈使式标题
- 要创建或修改的文件
- 具体的实现步骤

保持计划聚焦且可执行。
```

</step>

---

<step name="return_path_card">

在触发 ultraplan **之前** 显示返程说明，确保 ultraplan 启动后，这些信息仍可在终端滚动历史中看到：

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WHEN THE PLAN IS READY — WHAT TO DO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

当终端中出现 ◆ ultraplan ready 时：

  1. 在浏览器中打开 session link
  2. 审阅计划，使用 inline comments 和 emoji reactions 提交反馈
  3. 让 Claude 持续修订，直到你满意为止
  4. 点击 "Approve plan and teleport back to terminal"
  5. 在终端对话框中选择 Cancel  ← 这样会把计划保存到文件
  6. 记下 Claude 打印出的 file path
  7. 运行：/gsd-import --from <the file path>

/gsd-import 会执行 conflict detection、转换为 GSD format、通过 plan-checker 校验、更新 ROADMAP.md，并提交。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Launching ultraplan for Phase {N}: {phase_name}...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</step>

---

<step name="trigger">

使用构建好的 prompt 触发 ultraplan：

```text
/ultraplan {constructed prompt from build_prompt step}
```

远端 session 工作时，你的终端会显示 `◇ ultraplan` 状态指示器。
可使用 `/tasks` 打开详情视图，查看 session link、agent activity，以及 stop action。

</step>
