<trigger>
在以下情况使用此 workflow：
- 在已有项目上开启新会话
- 用户说“continue”“what's next”“where were we”“resume”
- `.planning/` 已存在时的任何 planning 操作
- 用户离开项目一段时间后回来
</trigger>

<purpose>
立即恢复完整项目上下文，让“Where were we?” 能立刻得到完整答案。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/continuation-format.md
</required_reading>

<process>

<step name="initialize">
一次调用加载全部上下文：

```bash
INIT=$(gsd-sdk query init.resume)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，提取：`state_exists`, `roadmap_exists`, `project_exists`, `planning_exists`, `has_interrupted_agent`, `interrupted_agent_id`, `commit_docs`。

**如果 `state_exists` 为 true：** 继续执行 load_state
**如果 `state_exists` 为 false 但 `roadmap_exists` 或 `project_exists` 为 true：** 提供重建 STATE.md 的选项
**如果 `planning_exists` 为 false：** 这是一个新项目，转到 /gsd-new-project
</step>

<step name="load_state">

读取并解析 STATE.md，然后读取 PROJECT.md：

```bash
cat .planning/STATE.md
cat .planning/PROJECT.md
```

**从 STATE.md 提取：**

- **Project Reference**：核心价值与当前焦点
- **Current Position**：Phase X of Y、Plan A of B、Status
- **Progress**：可视化进度条
- **Recent Decisions**：影响当前工作的关键决策
- **Pending Todos**：会话中记录下来的想法
- **Blockers/Concerns**：延续下来的问题
- **Session Continuity**：上次停在哪里、是否有 resume 文件

**从 PROJECT.md 提取：**

- **What This Is**：当前准确描述
- **Requirements**：Validated、Active、Out of Scope
- **Key Decisions**：包含结果的完整决策记录
- **Constraints**：实现上的硬性限制

</step>

<step name="check_incomplete_work">
查找需要关注的未完成工作：

```bash
# Check for structured handoff (preferred — machine-readable)
cat .planning/HANDOFF.json 2>/dev/null || true

# Check for continue-here files (mid-plan resumption)
ls .planning/phases/*/.continue-here*.md 2>/dev/null || true

# Check for plans without summaries (incomplete execution)
for plan in .planning/phases/*/*-PLAN.md; do
  [ -e "$plan" ] || continue
  summary="${plan/PLAN/SUMMARY}"
  [ ! -f "$summary" ] && echo "Incomplete: $plan"
done 2>/dev/null || true

# Check for interrupted agents (use has_interrupted_agent and interrupted_agent_id from init)
if [ "$has_interrupted_agent" = "true" ]; then
  echo "Interrupted agent: $interrupted_agent_id"
fi
```

**如果 HANDOFF.json 存在：**

- 这是首选恢复来源，包含来自 `/gsd-pause-work` 的结构化数据
- 解析 `status`, `phase`, `plan`, `task`, `total_tasks`, `next_action`
- 检查 `blockers` 和 `human_actions_pending`，立即向用户呈现
- 检查 `completed_tasks` 中的 `in_progress` 项，这些要优先处理
- 将 `uncommitted_files` 与 `git status` 对照，标记偏差
- 使用 `context_notes` 恢复心智模型
- 标记："发现 structured handoff — 正在从 task {task}/{total_tasks} 恢复"
- **成功恢复后，删除 HANDOFF.json**（它是一次性产物）

**如果存在 .continue-here 文件（回退方案）：**

- 这是一个 plan 执行中的恢复点
- 读取该文件，获取具体恢复上下文
- 标记："发现 plan 中途 checkpoint"

**如果存在没有 SUMMARY 的 PLAN：**

- 执行已开始但未完成
- 标记："发现未完成的 plan 执行"

**如果发现 interrupted agent：**

- subagent 已启动，但会话在完成前结束
- 读取 agent-history.json 获取任务细节
- 标记："发现 interrupted agent"
  </step>

<step name="present_status">
向用户展示完整项目状态：

```
╔══════════════════════════════════════════════════════════════╗
║  项目状态                                                       ║
╠══════════════════════════════════════════════════════════════╣
║  正在构建: [PROJECT.md 中 "What This Is" 的单行描述]            ║
║                                                               ║
║  Phase: [X] / [Y] - [Phase name]                             ║
║  Plan:  [A] / [B] - [Status]                                 ║
║  Progress: [██████░░░░] XX%                                   ║
║                                                               ║
║  最近活动: [date] - [what happened]                           ║
╚══════════════════════════════════════════════════════════════╝

[如果发现未完成工作：]
⚠️  检测到未完成工作：
    - [.continue-here 文件或未完成 plan]

[如果发现 interrupted agent：]
⚠️  检测到 interrupted agent：
    Agent ID: [id]
    Task: [agent-history.json 中的任务描述]
    Interrupted: [timestamp]

    恢复方式: Task tool（使用带 agent ID 的 resume parameter）

[如果存在 pending todos：]
📋 有 [N] 个 pending todos — 使用 /gsd-check-todos 查看

[如果存在 blockers：]
⚠️  延续中的问题：
    - [blocker 1]
    - [blocker 2]

[如果 alignment 不是 ✓：]
⚠️  简要 alignment： [status] - [assessment]
```

</step>

<step name="determine_next_action">
基于项目状态，确定最合适的下一步操作：

**如果存在 interrupted agent：**
→ 首选：恢复 interrupted agent（Task tool 配合 resume parameter）
→ 可选：重新开始（放弃 agent 工作）

**如果存在 HANDOFF.json：**
→ 首选：从 structured handoff 恢复（最高优先级，包含具体 task/blocker 上下文）
→ 可选：丢弃 handoff，改为根据文件重新评估

**如果存在 .continue-here 文件：**
→ 回退方案：从 checkpoint 恢复
→ 可选：在当前 plan 上重新开始

**如果存在 incomplete plan（PLAN without SUMMARY）：**
→ 首选：完成这个未完成的 plan
→ 可选：放弃并继续后续工作

**如果 phase 进行中且所有 plans 已完成：**
→ 首选：推进到下一个 phase（通过内部 transition workflow）
→ 可选：回顾已完成工作

**如果 phase 已准备好进入 planning：**
→ 先检查此 phase 是否存在 CONTEXT.md：

- 如果缺少 CONTEXT.md：
  → 首选：讨论 phase 愿景（用户设想它应如何工作）
  → 次选：直接规划（跳过上下文收集）
- 如果存在 CONTEXT.md：
  → 首选：规划该 phase
  → 可选：查看 roadmap

**如果 phase 已准备好执行：**
→ 首选：执行下一个 plan
→ 可选：先查看该 plan
</step>

<step name="offer_options">
根据项目状态提供上下文相关选项：

```
你想做什么？

[基于当前状态的首选动作，例如：]
1. 恢复 interrupted agent [如果发现 interrupted agent]
   OR
1. 执行 phase (/gsd-execute-phase {phase} ${GSD_WS})
   OR
1. 讨论 Phase 3 的上下文 (/gsd-discuss-phase 3 ${GSD_WS}) [如果缺少 CONTEXT.md]
   OR
1. 规划 Phase 3 (/gsd-plan-phase 3 ${GSD_WS}) [如果存在 CONTEXT.md，或用户放弃 discuss 选项]

[次要选项：]
2. 查看当前 phase 状态
3. 检查 pending todos（[N] pending）
4. 查看 brief alignment
5. 其他
```

**注意：** 在提供 phase planning 选项时，先检查 CONTEXT.md 是否存在：

```bash
ls .planning/phases/XX-name/*-CONTEXT.md 2>/dev/null || true
```

如果缺失，先建议 discuss-phase；如果存在，直接提供 plan 选项。

等待用户选择。
</step>

<step name="route_to_workflow">
根据用户选择，路由到相应 workflow：

- **Execute plan** → 向用户展示在清屏后运行的命令：
  ```
  ---

  ## ▶ 下一步 — [${PROJECT_CODE}] ${PROJECT_TITLE}

  **{phase}-{plan}: [Plan Name]** — [PLAN.md 中的 objective]

  `/clear` 然后：

  `/gsd-execute-phase {phase} ${GSD_WS}`

  ---
  ```
- **Plan phase** → 向用户展示在清屏后运行的命令：
  ```
  ---

  ## ▶ 下一步 — [${PROJECT_CODE}] ${PROJECT_TITLE}

  **Phase [N]: [Name]** — [ROADMAP.md 中的 Goal]

  `/clear` 然后：

  `/gsd-plan-phase [phase-number] ${GSD_WS}`

  ---

  **也可使用：**
  - `/gsd-discuss-phase [N] ${GSD_WS}` — 先收集上下文
  - `/gsd-research-phase [N] ${GSD_WS}` — 调查未知项

  ---
  ```
- **Advance to next phase** → ./transition.md（内部 workflow，内联调用，不是用户命令）
- **Check todos** → 读取 .planning/todos/pending/，展示摘要
- **Review alignment** → 读取 PROJECT.md，与当前状态比较
- **Something else** → 询问用户需要什么
</step>

<step name="update_session">
在继续执行路由后的 workflow 之前，更新 session continuity：

更新 STATE.md：

```markdown
## Session Continuity

Last session: [now]
Stopped at: Session resumed, proceeding to [action]
Resume file: [updated if applicable]
```

这样如果会话意外结束，下次 resume 就能知道当前状态。
</step>

</process>

<reconstruction>
如果 STATE.md 缺失但其他产物仍在：

"STATE.md 缺失。正在从现有产物重建..."

1. 读取 PROJECT.md → 提取 "What This Is" 和 Core Value
2. 读取 ROADMAP.md → 确定 phases，并找出当前位置
3. 扫描 `*-SUMMARY.md` 文件 → 提取 decisions、concerns
4. 统计 .planning/todos/pending/ 中的 pending todos
5. 检查 .continue-here 文件 → Session continuity

重建并写入 STATE.md，然后照常继续。

这能处理以下情况：

- 项目早于 STATE.md 引入时间
- 文件被意外删除
- clone repo 时没有完整的 .planning/ 状态
  </reconstruction>

<quick_resume>
如果用户说“continue”或“go”：
- 静默加载 state
- 确定首选动作
- 直接执行，不展示选项

"正在从 [state] 继续... [action]"
</quick_resume>

<success_criteria>
在以下条件满足时，resume 完成：

- [ ] 已加载 STATE.md（或已重建）
- [ ] 已检测并标记未完成工作
- [ ] 已向用户展示清晰状态
- [ ] 已提供与上下文匹配的下一步动作
- [ ] 用户已清楚了解项目当前所处位置
- [ ] 已更新 session continuity
      </success_criteria>
