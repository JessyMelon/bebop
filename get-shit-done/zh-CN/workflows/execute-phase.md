<purpose>
使用基于 wave 的并行执行来执行某个 phase 中的所有计划。Orchestrator 保持精简，将计划执行委派给 subagent。
</purpose>

<core_principle>
Orchestrator 负责协调，不直接执行。每个 subagent 都会加载完整的 execute-plan 上下文。Orchestrator：发现 plans → 分析依赖 → 分组 waves → 启动 agents → 处理 checkpoints → 收集结果。
</core_principle>

<runtime_compatibility>
**Subagent 启动具有 runtime 差异：**
- **Claude Code:** 使用 `Task(subagent_type="gsd-executor", ...)`，会阻塞直到完成并返回结果
- **Copilot:** Subagent 启动无法可靠返回完成信号。**默认改用
  顺序内联执行**：直接为每个 plan 读取并遵循 execute-plan.md，
  而不是启动并行 agents。只有在用户
  明确要求时才尝试并行启动；若这样做，则依赖第 3 步中的 spot-check 回退机制
  来检测完成情况。
- **Other runtimes:** 如果 `Task`/`task` tool 不可用，则回退为顺序内联执行。
  应在运行时检查 tool 可用性，而不是根据 runtime 名称预设。

**回退规则：** 如果某个已启动的 agent 已完成工作（能看到 commits、SUMMARY.md 存在），但
orchestrator 没有收到完成信号，则基于 spot-check 将其视为成功
并继续下一 wave/plan。不要无限期等待信号，
始终通过文件系统和 git 状态进行确认。
</runtime_compatibility>

<required_reading>
在执行任何操作前先读取 STATE.md，以加载项目上下文。

@~/.claude/get-shit-done/references/agent-contracts.md
@~/.claude/get-shit-done/references/context-budget.md
@~/.claude/get-shit-done/references/gates.md
</required_reading>

<available_agent_types>
这些是在 .claude/agents/（或当前 runtime 的等价位置）中注册的有效 GSD subagent 类型。
始终使用此列表中的精确名称，不要回退到 `general-purpose` 或其他内置类型：

- gsd-executor — 执行计划任务、提交 commit、创建 SUMMARY.md
- gsd-verifier — 验证阶段完成情况，检查质量门禁
- gsd-planner — 根据 phase 范围创建详细计划
- gsd-phase-researcher — 研究某个 phase 的技术方案
- gsd-plan-checker — 在执行前评审计划质量
- gsd-debugger — 诊断并修复问题
- gsd-codebase-mapper — 映射项目结构与依赖
- gsd-integration-checker — 检查跨阶段集成
- gsd-nyquist-auditor — 验证核查覆盖率
- gsd-ui-researcher — 研究 UI/UX 方案
- gsd-ui-checker — 评审 UI 实现质量
- gsd-ui-auditor — 按设计要求审计 UI
</available_agent_types>

<process>

<step name="parse_args" priority="first">
在加载任何上下文之前先解析 `$ARGUMENTS`：

- 第一个位置参数 token → `PHASE_ARG`
- 可选 `--wave N` → `WAVE_FILTER`
- 可选 `--gaps-only` 保持当前含义不变
- 可选 `--cross-ai` → `CROSS_AI_FORCE=true`（强制所有 plans 走 cross-AI 执行）
- 可选 `--no-cross-ai` → `CROSS_AI_DISABLED=true`（本次运行禁用 cross-AI，覆盖 config 和 frontmatter）

如果没有 `--wave`，保留当前行为：执行该 phase 中所有未完成的 waves。
</step>

<step name="initialize" priority="first">
一次性加载全部上下文：

```bash
INIT=$(gsd-sdk query init.execute-phase "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS=$(gsd-sdk query agent-skills gsd-executor 2>/dev/null)
```

解析 JSON，获取：`executor_model`, `verifier_model`, `commit_docs`, `parallelization`, `branching_strategy`, `branch_name`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`, `response_language`。

**Model resolution：** 如果 `executor_model` 是 `"inherit"`，则在所有 `Task()` 调用中省略 `model=` 参数，不要把 `model="inherit"` 传给 Task。省略 `model=` 会让 Claude Code 自动继承当前 orchestrator 的 model。只有当 `executor_model` 是显式 model 名称时才设置 `model=`（例如 `"claude-sonnet-4-6"`、`"claude-opus-4-7"`）。

**如果设置了 `response_language`：** 在所有新启动的 subagent prompt 中加入 `response_language: {value}`，确保所有面向用户的输出保持为配置语言。

读取 worktree config：

```bash
USE_WORKTREES=$(gsd-sdk query config-get workflow.use_worktrees 2>/dev/null || echo "true")
```

如果项目使用 git submodules，则无论 `workflow.use_worktrees` 配置为何，都跳过 worktree 隔离，因为 executor 的 commit 协议无法在隔离 worktree 内正确处理 submodule commit。顺序执行可以透明处理 submodule。

```bash
if [ -f .gitmodules ]; then
  echo "[worktree] Submodule project detected (.gitmodules exists) — falling back to sequential execution"
  USE_WORKTREES=false
fi
```

当 `USE_WORKTREES` 为 `false` 时，所有 executor agents 都不使用 `isolation="worktree"`，而是在主 working tree 上顺序执行，而不是在并行 worktrees 中执行。

读取上下文窗口大小，用于自适应 prompt 增强：

```bash
CONTEXT_WINDOW=$(gsd-sdk query config-get context_window 2>/dev/null || echo "200000")
```

当 `CONTEXT_WINDOW >= 500000`（1M 级 models）时，subagent prompts 会包含更丰富的上下文：
- Executor agents 接收先前 wave 的 SUMMARY.md 文件，以及该 phase 的 CONTEXT.md/RESEARCH.md
- Verifier agents 接收所有 PLAN.md、SUMMARY.md、CONTEXT.md 文件以及 REQUIREMENTS.md
- 这样可以启用跨阶段感知与带历史上下文的验证

当 `CONTEXT_WINDOW < 200000`（小于 200K 的 models）时，会精简 subagent prompts 以降低静态开销：
- Executor agents 在内联 prompt 中省略扩展的 deviation rule 示例和 checkpoint 示例，按需通过 @~/.claude/get-shit-done/references/executor-examples.md 加载
- Planner agents 在内联 prompt 中省略扩展的 anti-pattern 列表和 specificity 示例，按需通过 @~/.claude/get-shit-done/references/planner-antipatterns.md 加载
- 核心规则和决策逻辑仍保留内联，仅提取冗长示例和边界情况列表
- 这样在保持行为正确性的同时，可将 executor 的静态开销降低约 40%

**如果 `phase_found` 为 false：** 报错，未找到 phase 目录。
**如果 `plan_count` 为 0：** 报错，该 phase 中未找到 plans。
**如果 `state_exists` 为 false 但存在 `.planning/`：** 提供 reconstruct 或 continue 选项。

当 `parallelization` 为 false 时，同一 wave 内的 plans 顺序执行。

**Copilot 的 runtime 检测：**
通过检测 `@gsd-executor` agent pattern
或 `Task()` subagent API 是否缺失，判断当前 runtime 是否为 Copilot。如果在 Copilot 下运行，则无论 `parallelization` 设置如何，都强制改为顺序内联
执行，因为 Copilot 的 subagent 完成信号
不可靠（见 `<runtime_compatibility>`）。在内部设置 `COPILOT_SEQUENTIAL=true`，
并跳过 `execute_waves` 步骤，改为对每个 plan 走 `check_interactive_mode` 的
内联路径。

**REQUIRED — 让 chain flag 与意图保持一致。** 如果是手动调用（没有 `--auto`），清除之前中断的 `--auto` chain 留下的临时 chain flag。这样可防止过期的 `_auto_chain_active: true` 造成意外自动推进。此操作**不会**影响 `workflow.auto_advance`（用户的持久设置偏好）。在任何 config 读取前，你都必须执行以下 bash 代码块：
```bash
# REQUIRED: prevents stale auto-chain from previous --auto runs
if [[ ! "$ARGUMENTS" =~ --auto ]]; then
  gsd-sdk query config-set workflow._auto_chain_active false 2>/dev/null
fi
```
</step>

<step name="check_blocking_antipatterns" priority="first">
**MANDATORY — 在任何其他工作之前检查阻塞性 anti-pattern。**

在当前 phase 目录中查找 `.continue-here.md`：

```bash
ls ${phase_dir}/.continue-here.md 2>/dev/null || true
```

如果 `.continue-here.md` 存在，解析其中的 “Critical Anti-Patterns” 表，查找 `severity` = `blocking` 的行。

**如果找到一个或多个 `blocking` anti-pattern：**

此步骤不能跳过。在继续进入 `check_interactive_mode` 或任何其他步骤之前，agent 必须通过回答每个 anti-pattern 的以下三个问题来证明自己已理解：

1. **What is this anti-pattern?** — 用你自己的话描述，不要直接引用交接内容。
2. **How did it manifest?** — 解释导致其被记录下来的具体失败。
3. **What structural mechanism (not acknowledgment) prevents it?** — 指出能防止再次发生的具体步骤、checklist 条目或强制机制。

在继续前将这些回答直接写出。如果无法从 `.continue-here.md` 的上下文中回答某个阻塞性 anti-pattern，请停下并向用户请求澄清。

**如果不存在 `.continue-here.md`，或未找到 `blocking` 行：** 直接进入 `check_interactive_mode`。
</step>

<step name="check_interactive_mode">
**从 $ARGUMENTS 解析 `--interactive` flag。**

**如果存在 `--interactive` flag：** 切换到交互式执行模式。

交互模式会**内联**顺序执行计划（不启动 subagent），并在任务之间加入用户 checkpoint。用户可以在任意时刻审阅、修改或重定向工作。

**交互式执行流程：**

1. 正常加载 plan 清单（discover_and_group_plans）
2. 对每个 plan（按顺序执行，忽略 wave 分组）：

   a. **向用户展示该 plan：**
      ```
      ## Plan {plan_id}: {plan_name}

      Objective: {from plan file}
      Tasks: {task_count}

      Options:
      - Execute (proceed with all tasks)
      - Review first (show task breakdown before starting)
      - Skip (move to next plan)
      - Stop (end execution, save progress)
      ```

   b. **如果选择 “Review first”：** 读取并展示完整 plan 文件。然后再次询问：Execute、Modify、Skip。

   c. **如果选择 “Execute”：** **内联**读取并遵循 `~/.claude/get-shit-done/workflows/execute-plan.md`
      （不要启动 subagent）。一次执行一个任务。

   d. **每个任务之后：** 短暂停顿。如果用户介入（输入任意内容），先停下并处理
      他们的反馈，再继续。否则继续下一个任务。

   e. **plan 完成后：** 展示结果、提交 commit、创建 SUMMARY.md，然后展示下一个 plan。

3. 所有 plans 完成后：进入验证（与普通模式相同）。

**交互模式的优点：**
- 没有 subagent 开销，token 使用量显著更低
- 用户可以更早发现错误，节省昂贵的验证轮次
- 保持 GSD 的 planning/tracking 结构
- 最适合：小型 phases、bug fixes、verification gaps、学习 GSD

**跳转到 handle_branching 步骤**（交互式 plans 会在分组后内联执行）。
</step>

<step name="handle_branching">
检查 init 中的 `branching_strategy`：

**`"none"`：** 跳过，继续使用当前 branch。

**`"phase"` 或 `"milestone"`：** 使用 init 预先计算好的 `branch_name`：
```bash
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
```

后续所有 commits 都进入该 branch。合并由用户处理。
</step>

<step name="validate_phase">
从 init JSON 读取：`phase_dir`、`plan_count`、`incomplete_count`。

报告：`Found {plan_count} plans in {phase_dir} ({incomplete_count} incomplete)`

**在 phase 开始时更新 STATE.md：**
```bash
gsd-sdk query state.begin-phase --phase "${PHASE_NUMBER}" --name "${PHASE_NAME}" --plans "${PLAN_COUNT}"
```
这会更新 STATE.md 中的 Status、Last Activity、Current focus、Current Position 和 plan 计数，使 frontmatter 和正文文本能立即反映当前活跃 phase。
</step>

<step name="discover_and_group_plans">
一次性加载带有 wave 分组的 plan 清单：

```bash
PLAN_INDEX=$(gsd-sdk query phase-plan-index "${PHASE_NUMBER}")
```

解析 JSON，获取：`phase`、`plans[]`（每项包含 `id`, `wave`, `autonomous`, `objective`, `files_modified`, `task_count`, `has_summary`）、`waves`（wave number → plan IDs 的映射）、`incomplete`、`has_checkpoints`。

**过滤规则：** 跳过 `has_summary: true` 的 plans。如果有 `--gaps-only`，也跳过非 gap_closure plans。如果设置了 `WAVE_FILTER`，也跳过 `wave` 不等于 `WAVE_FILTER` 的 plans。

**Wave 安全检查：** 如果设置了 `WAVE_FILTER`，且更低 wave 中仍有与当前执行模式匹配的未完成 plans，则**停止**，并告知用户必须先完成更早的 waves。不要在前置较早 wave 的 plans 仍未完成时执行 Wave 2+。

如果过滤后全部为空：输出 `No matching incomplete plans` → 退出。

报告：
```
## Execution Plan

**Phase {X}: {Name}** — {total_plans} matching plans across {wave_count} wave(s)

{If WAVE_FILTER is set: `Wave filter active: executing only Wave {WAVE_FILTER}`.}

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1 | 01-01, 01-02 | {from plan objectives, 3-8 words} |
| 2 | 01-03 | ... |
```
</step>

<step name="cross_ai_delegation">
**可选步骤 2.5 — 将 plans 委派给外部 AI runtime。**

此步骤在 plan 发现之后、正常 wave 执行之前运行。它会识别
应委派给外部 AI command 的 plans，并通过基于 stdin 的 prompt 传递方式执行。
在这里处理完成的 plans 会从 execute_waves 的 plan 列表中移除，
这样普通 executor 会跳过它们。

**激活逻辑：**

1. 如果 `CROSS_AI_DISABLED` 为 true（`--no-cross-ai` flag）：完全跳过此步骤。
2. 如果 `CROSS_AI_FORCE` 为 true（`--cross-ai` flag）：将所有未完成 plans 标记为 cross-AI 执行。
3. 否则：检查每个 plan 的 frontmatter 是否有 `cross_ai: true`，并验证 config
   `workflow.cross_ai_execution` 是否为 `true`。同时满足两者的 plans 才会被标记为 cross-AI。

```bash
CROSS_AI_ENABLED=$(gsd-sdk query config-get workflow.cross_ai_execution 2>/dev/null || echo "false")
CROSS_AI_CMD=$(gsd-sdk query config-get workflow.cross_ai_command 2>/dev/null || echo "")
CROSS_AI_TIMEOUT=$(gsd-sdk query config-get workflow.cross_ai_timeout 2>/dev/null || echo "300")
```

**如果没有任何 plan 被标记为 cross-AI：** 跳到 execute_waves。

**如果有 plans 被标记，但 `cross_ai_command` 为空：** 报错，提示用户通过 `gsd-sdk query config-set workflow.cross_ai_command "<command>"` 设置
`workflow.cross_ai_command`。

**对每个 cross-AI plan（顺序处理）：**

1. **从 plan 文件构造 task prompt：**
   - 提取 PLAN.md 中的 `<objective>` 和 `<tasks>` 部分
   - 追加 PROJECT.md 上下文（项目名称、描述、技术栈）
   - 格式化为自包含的执行 prompt

2. **执行前检查 working tree 是否脏：**
   ```bash
   if ! git diff --quiet HEAD 2>/dev/null; then
     echo "WARNING: dirty working tree detected — the external AI command may produce uncommitted changes that conflict with existing modifications"
   fi
   ```

3. **从项目根目录运行外部 command，并将 prompt 写入 stdin。**
   不要对 prompt 做 shell 插值，始终通过 stdin pipe 传入以防注入：
   ```bash
   echo "$TASK_PROMPT" | timeout "${CROSS_AI_TIMEOUT}s" ${CROSS_AI_CMD} > "$CANDIDATE_SUMMARY" 2>"$ERROR_LOG"
   EXIT_CODE=$?
   ```

4. **评估结果：**

   **成功（exit 0 + valid summary）：**
   - 读取 `$CANDIDATE_SUMMARY` 并验证其包含有意义的内容
     （非空，且至少包含标题和描述，即有效的 SUMMARY.md 结构）
   - 将其写为该 plan 的 SUMMARY.md 文件
   - 将 STATE.md 中该 plan 的状态更新为 complete
   - 更新 ROADMAP.md 进度
   - 将该 plan 标记为已处理，在 execute_waves 中跳过

   **失败（非零 exit 或 invalid summary）：**
   - 展示错误输出和 exit code
   - 警告：`The external command may have left uncommitted changes or partial edits
     in the working tree. Review git status and git diff before proceeding.`
   - 提供三个选项：
     - **retry** — 再次通过 cross-AI 运行同一个 plan
     - **skip** — 对该 plan 回退为普通 executor（重新加入 execute_waves 列表）
     - **abort** — 完全停止执行，保留状态以便恢复

5. **所有 cross-AI plans 处理完成后：** 将成功处理的 plans 从
   未完成 plan 列表中移除，使 execute_waves 跳过它们。任何选择 skip 回退的 plans
   会保留在列表中，交由普通 executor 处理。
</step>

<step name="execute_waves">
按顺序执行每个选中的 wave。单个 wave 内：若 `PARALLELIZATION=true` 则并行，否则顺序执行。

**对每个 wave：**

1. **Wave 内 files_modified 重叠检查（在启动前）：**

   在为当前 wave 启动任何 agents 之前，检查该 wave 中所有 plans 的 `files_modified` 列表。
   两两比较 wave 内的 plans，如果任意两个 plans 的 `files_modified` 列表中共享哪怕一个文件，
   就说明这些 plans 存在隐式依赖，**绝不能**并行运行。

   **检测算法（伪代码）：**
   ```
   seen_files = {}
   overlapping_plans = []
   for each plan in wave_plans:
     for each file in plan.files_modified:
       if file in seen_files:
         overlapping_plans.add(plan, seen_files[file])  # both plans overlap on this file
       else:
         seen_files[file] = plan
   ```

   **如果检测到重叠：**
   - 向用户警告：
     ```
     ⚠ Intra-wave files_modified overlap detected in Wave {N}:
       Plan {A} and Plan {B} both modify {file}
       Running these plans sequentially to avoid parallel worktree conflicts.
     ```
   - 仅对当前 wave 将 `PARALLELIZATION` 覆盖为 `false`，即无论全局 parallelization 设置如何，
     该 wave 中所有 plans 都顺序执行。
   - 这是对被错误分配到同一 wave 的 plans 的安全兜底。
     planner 本应捕获此问题；应将其标记为 planning defect，便于用户在需要时
     重新规划该 phase。

   **如果没有重叠：** 正常继续（若 `PARALLELIZATION=true` 则并行）。

2. **描述即将构建的内容（在启动前）：**

   读取每个 plan 的 `<objective>`。提取其要构建的内容及原因。

   ```
   ---
   ## Wave {N}

   **{Plan ID}: {Plan Name}**
   {2-3 sentences: what this builds, technical approach, why it matters}

   Spawning {count} agent(s)...
   ---
   ```

   - 不好：`Executing terrain generation plan`
   - 好：`Procedural terrain generator using Perlin noise — creates height maps, biome zones, and collision meshes. Required before vehicle physics can interact with ground.`

3. **启动 executor agents：**

   只传路径，executors 会在其全新的 context window 中自行读取文件。
   对 200k models，这能让 orchestrator 的上下文保持精简（约 10-15%）。
   对 1M+ models（Opus 4.6、Sonnet 4.6），可以直接传入更丰富的上下文。

   **Worktree 模式**（`USE_WORKTREES` 不为 `false`）：

   启动前，先记录当前 HEAD：
   ```bash
   EXPECTED_BASE=$(git rev-parse HEAD)
   ```

   **并行执行时采用顺序分发（wave 中有 2+ agents）：**
   当在同一 wave 中启动多个 agents 时，要**逐个**发起每个 `Task()` 调用，
   并设置 `run_in_background: true`，不要在同一条消息里发送所有 Task 调用。
   `git worktree add` 会独占 `.git/config.lock`，
   若同时调用会争抢这个锁并失败。顺序分发可确保每个 worktree 完成
   创建后再开始下一个（每次 tool call 的往返延迟本身就会形成自然间隔），
   同时所有 agents 在创建完成后仍会**并行运行**。

   ```
   # CORRECT: dispatch one Task() per message, each with run_in_background: true
   # → worktrees created sequentially, agents execute in parallel
   #
   # WRONG: multiple Task() calls in a single message
   # → simultaneous git worktree add → .git/config.lock contention → failures
   ```

   ```
   Task(
     subagent_type="gsd-executor",
     description="Execute plan {plan_number} of phase {phase_number}",
     # Only include model= when executor_model is an explicit model name.
     # When executor_model is "inherit", omit this parameter entirely so
     # Claude Code inherits the orchestrator model automatically.
     model="{executor_model}",  # omit this line when executor_model == "inherit"
     isolation="worktree",
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Create SUMMARY.md.
       Do NOT update STATE.md or ROADMAP.md — the orchestrator owns those writes after all worktree agents in the wave complete.
       </objective>

       <worktree_branch_check>
       FIRST ACTION before any other work: verify this worktree's branch is based on the correct commit.

       Run:
       ```bash
       ACTUAL_BASE=$(git merge-base HEAD {EXPECTED_BASE})
       ```

       If `ACTUAL_BASE` != `{EXPECTED_BASE}` (i.e. the worktree branch was created from an older
       base such as `main` instead of the feature branch HEAD), hard-reset to the correct base:
       ```bash
       # Safe: this runs before any agent work, so no uncommitted changes to lose
       git reset --hard {EXPECTED_BASE}
       # Verify correction succeeded
       if [ "$(git rev-parse HEAD)" != "{EXPECTED_BASE}" ]; then
         echo "ERROR: Could not correct worktree base — aborting to prevent data loss"
         exit 1
       fi
       ```

       `reset --hard` is safe here because this is a fresh worktree with no user changes. It
       resets both the HEAD pointer AND the working tree to the correct base commit (#2015).

       If `ACTUAL_BASE` == `{EXPECTED_BASE}`: the branch base is correct, proceed immediately.

       This check fixes a known issue where `EnterWorktree` creates branches from
       `main` instead of the current feature branch HEAD (affects all platforms).
       </worktree_branch_check>

       <parallel_execution>
       You are running as a PARALLEL executor agent in a git worktree.
       Use --no-verify on all git commits to avoid pre-commit hook contention
       with other agents. The orchestrator validates hooks once after all agents complete.
       For `gsd-sdk query commit` (or legacy `gsd-tools.cjs` commit): add --no-verify flag when needed.
       For direct git commits: use git commit --no-verify -m "..."

       IMPORTANT: Do NOT modify STATE.md or ROADMAP.md. execute-plan.md
       auto-detects worktree mode (`.git` is a file, not a directory) and skips
       shared file updates automatically. The orchestrator updates them centrally
       after merge.

       REQUIRED: SUMMARY.md MUST be committed before you return. In worktree mode the
       git_commit_metadata step in execute-plan.md commits SUMMARY.md and REQUIREMENTS.md
       only (STATE.md and ROADMAP.md are excluded automatically). Do NOT skip or defer
       this commit — the orchestrator force-removes the worktree after you return, and
       any uncommitted SUMMARY.md will be permanently lost (#2070).
       </parallel_execution>

       <execution_context>
       @~/.claude/get-shit-done/workflows/execute-plan.md
       @~/.claude/get-shit-done/templates/summary.md
       @~/.claude/get-shit-done/references/checkpoints.md
       @~/.claude/get-shit-done/references/tdd.md
       ${CONTEXT_WINDOW < 200000 ? '' : '@~/.claude/get-shit-done/references/executor-examples.md'}
       </execution_context>

       <files_to_read>
       Read these files at execution start using the Read tool:
       - {phase_dir}/{plan_file} (Plan)
       - .planning/PROJECT.md (Project context — core value, requirements, evolution rules)
       - .planning/STATE.md (State)
       - .planning/config.json (Config, if exists)
       ${CONTEXT_WINDOW >= 500000 ? `
       - ${phase_dir}/*-CONTEXT.md (User decisions from discuss-phase — honors locked choices)
       - ${phase_dir}/*-RESEARCH.md (Technical research — pitfalls and patterns to follow)
       - ${prior_wave_summaries} (SUMMARY.md files from earlier waves in this phase — what was already built)
       ` : ''}
       - ./CLAUDE.md (Project instructions, if exists — follow project-specific guidelines and coding conventions)
       - .claude/skills/ or .agents/skills/ (Project skills, if either exists — list skills, read SKILL.md for each, follow relevant rules during implementation)
       </files_to_read>

       ${AGENT_SKILLS}

       <mcp_tools>
       If CLAUDE.md or project instructions reference MCP tools (e.g. jCodeMunch, context7,
       or other MCP servers), prefer those tools over Grep/Glob for code navigation when available.
       MCP tools often save significant tokens by providing structured code indexes.
       Check tool availability first — if MCP tools are not accessible, fall back to Grep/Glob.
       </mcp_tools>

       <success_criteria>
       - [ ] All tasks executed
       - [ ] Each task committed individually
       - [ ] SUMMARY.md created in plan directory
       - [ ] No modifications to shared orchestrator artifacts (the orchestrator handles all post-wave shared-file writes)
       </success_criteria>
     "
   )
   ```

   **顺序模式**（`USE_WORKTREES` 为 `false`）：

   在 Task 调用中省略 `isolation="worktree"`。将 `<parallel_execution>` 区块替换为：

   ```
       <sequential_execution>
       You are running as a SEQUENTIAL executor agent on the main working tree.
       Use normal git commits (with hooks). Do NOT use --no-verify.
       </sequential_execution>
   ```

   顺序模式下的 Task prompt 结构与 worktree 模式相同，但 success_criteria 有这些差异：因为同一时刻只有一个 agent 在写入，因此不会发生 shared-file 冲突：

   ```
       <success_criteria>
       - [ ] All tasks executed
       - [ ] Each task committed individually
       - [ ] SUMMARY.md created in plan directory
       - [ ] STATE.md updated with position and decisions
       - [ ] ROADMAP.md updated with plan progress (via `roadmap update-plan-progress`)
       </success_criteria>
   ```

   当 worktrees 被禁用时，无论 `PARALLELIZATION` 设置如何，每个 wave 内的 plans 都必须**逐个执行**（顺序），因为多个 agents 并发写入同一个 working tree 会导致冲突。

4. **等待当前 wave 中所有 agents 完成。**

   **完成信号回退（适用于 Copilot 以及 Task() 可能不返回的 runtimes）：**

   如果已启动的 agent 没有返回完成信号，但看起来已经完成了
   工作，不要无限阻塞。改为通过 spot-check 验证是否完成：

   ```bash
   # For each plan in this wave, check if the executor finished:
   SUMMARY_EXISTS=$(test -f "{phase_dir}/{plan_number}-{plan_padded}-SUMMARY.md" && echo "true" || echo "false")
   COMMITS_FOUND=$(git log --oneline --all --grep="{phase_number}-{plan_padded}" --since="1 hour ago" | head -1)
   ```

   **如果 SUMMARY.md 存在且找到了 commits：** 该 agent 已成功完成，
   视为已完成并进入第 5 步。记录：`"✓ {Plan ID} completed (verified via spot-check — completion signal not received)"`

   **如果在合理等待后 SUMMARY.md 仍不存在：** 该 agent 可能仍在
   运行，也可能已静默失败。检查 `git log --oneline -5` 查看近期活动。
   如果 commits 仍在出现，则继续等待；如果没有活动，则将该
   plan 视为失败，并转到第 6 步的失败处理流程。

   **此回退机制会自动应用于所有 runtimes。** Claude Code 的 Task() 通常会同步
   返回，但该回退机制可在它不返回时保证弹性。

5. **Wave 后 hook 验证（仅并行模式）：**

   当 agents 使用 `--no-verify` 提交后，在该 wave 结束后统一运行一次 pre-commit hooks：
   ```bash
   # Run project's pre-commit hooks on the current state
   git diff --cached --quiet || git stash  # stash any unstaged changes
   git hook run pre-commit 2>&1 || echo "⚠ Pre-commit hooks failed — review before continuing"
   ```
   如果 hooks 失败：报告失败并询问 `Fix hook issues now?` 或 `Continue to next wave?`

5.5. **Worktree 清理（当使用了 `isolation="worktree"` 时）：**

   当 executor agents 在 worktree 隔离中运行时，它们的 commits 会落在临时 branches 上，位于单独的 working trees 中。wave 完成后，需要将这些更改合并回来并清理：

   ```bash
   # List worktrees created by this wave's agents
   WORKTREES=$(git worktree list --porcelain | grep "^worktree " | grep -v "$(pwd)$" | sed 's/^worktree //')

   for WT in $WORKTREES; do
     # Get the branch name for this worktree
     WT_BRANCH=$(git -C "$WT" rev-parse --abbrev-ref HEAD 2>/dev/null)
     if [ -n "$WT_BRANCH" ] && [ "$WT_BRANCH" != "HEAD" ]; then
       CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

       # --- Orchestrator file protection (#1756) ---
       # Snapshot orchestrator-owned files BEFORE merge. If the worktree
       # branch outlived a milestone transition, its versions of STATE.md
       # and ROADMAP.md are stale. Main always wins for these files.
       STATE_BACKUP=$(mktemp)
       ROADMAP_BACKUP=$(mktemp)
       [ -f .planning/STATE.md ] && cp .planning/STATE.md "$STATE_BACKUP" || true
       [ -f .planning/ROADMAP.md ] && cp .planning/ROADMAP.md "$ROADMAP_BACKUP" || true

       # Snapshot list of files on main BEFORE merge to detect resurrections
       PRE_MERGE_FILES=$(git ls-files .planning/)

       # Pre-merge deletion check: warn if the worktree branch deletes tracked files
       DELETIONS=$(git diff --diff-filter=D --name-only HEAD..."$WT_BRANCH" 2>/dev/null || true)
       if [ -n "$DELETIONS" ]; then
         echo "BLOCKED: Worktree branch $WT_BRANCH contains file deletions: $DELETIONS"
         echo "Review these deletions before merging. If intentional, remove this guard and re-run."
         rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"
         continue
       fi

       # Merge the worktree branch into the current branch (--no-ff ensures a merge commit so HEAD~1 is reliable)
       git merge "$WT_BRANCH" --no-ff --no-edit -m "chore: merge executor worktree ($WT_BRANCH)" 2>&1 || {
         echo "⚠ Merge conflict from worktree $WT_BRANCH — resolve manually"
         echo "  STATE.md backup:   $STATE_BACKUP"
         echo "  ROADMAP.md backup: $ROADMAP_BACKUP"
         echo "  Restore with: cp \$STATE_BACKUP .planning/STATE.md && cp \$ROADMAP_BACKUP .planning/ROADMAP.md"
         break
       }

       # Post-merge deletion audit: detect bulk file deletions in merge commit (#2384)
       # --diff-filter=D HEAD~1 HEAD shows files deleted by the merge commit itself.
       # Exclude .planning/ — orchestrator-owned deletions there are expected (resurrections
       # are handled below). Require ALLOW_BULK_DELETE=1 to bypass for intentional large refactors.
       MERGE_DEL_COUNT=$(git diff --diff-filter=D --name-only HEAD~1 HEAD 2>/dev/null | grep -vc '^\.planning/' || true)
       if [ "$MERGE_DEL_COUNT" -gt 5 ] && [ "${ALLOW_BULK_DELETE:-0}" != "1" ]; then
         MERGE_DELETIONS=$(git diff --diff-filter=D --name-only HEAD~1 HEAD 2>/dev/null | grep -v '^\.planning/' || true)
         echo "⚠ BLOCKED: Merge of $WT_BRANCH deleted $MERGE_DEL_COUNT files outside .planning/ — reverting to protect repository integrity (#2384)"
         echo "$MERGE_DELETIONS"
         echo "  If these deletions are intentional, re-run with ALLOW_BULK_DELETE=1"
         git reset --hard HEAD~1 2>/dev/null || true
         rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"
         continue
       fi

       # Restore orchestrator-owned files (main always wins)
       if [ -s "$STATE_BACKUP" ]; then
         cp "$STATE_BACKUP" .planning/STATE.md
       fi
       if [ -s "$ROADMAP_BACKUP" ]; then
         cp "$ROADMAP_BACKUP" .planning/ROADMAP.md
       fi
       rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"

       # Detect files deleted on main but re-added by worktree merge
       # (e.g., archived phase directories that were intentionally removed)
       # A "resurrected" file must have a deletion event in main's ancestry —
       # brand-new files (e.g. SUMMARY.md just created by the executor) have no
       # such history and must NOT be removed (#2501).
       DELETED_FILES=$(git diff --diff-filter=A --name-only HEAD~1 -- .planning/ 2>/dev/null || true)
       for RESURRECTED in $DELETED_FILES; do
         # Only delete if this file was previously tracked on main and then
         # deliberately removed (has a deletion event in git history).
         WAS_DELETED=$(git log --follow --diff-filter=D --name-only --format="" HEAD~1 -- "$RESURRECTED" 2>/dev/null | grep -c . || true)
         if [ "${WAS_DELETED:-0}" -gt 0 ]; then
           git rm -f "$RESURRECTED" 2>/dev/null || true
         fi
       done

       # Amend merge commit with restored files if any changed
       if ! git diff --quiet .planning/STATE.md .planning/ROADMAP.md 2>/dev/null || \
          [ -n "$DELETED_FILES" ]; then
         # Only amend the commit with .planning/ files if commit_docs is enabled (#1783)
         COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
         if [ "$COMMIT_DOCS" != "false" ]; then
           git add .planning/STATE.md .planning/ROADMAP.md 2>/dev/null || true
           git commit --amend --no-edit 2>/dev/null || true
         fi
       fi

       # Safety net: commit any uncommitted SUMMARY.md before force-removing the worktree.
       # This guards against executors that skipped the git_commit_metadata step (#2070).
       UNCOMMITTED_SUMMARY=$(git -C "$WT" ls-files --modified --others --exclude-standard -- "*SUMMARY.md" 2>/dev/null || true)
       if [ -n "$UNCOMMITTED_SUMMARY" ]; then
         echo "⚠ SUMMARY.md was not committed by executor — committing now to prevent data loss"
         git -C "$WT" add -- "*SUMMARY.md" 2>/dev/null || true
         git -C "$WT" commit --no-verify -m "docs(recovery): rescue uncommitted SUMMARY.md before worktree removal (#2070)" 2>/dev/null || true
         # Re-merge the recovery commit
         git merge "$WT_BRANCH" --no-edit -m "chore: merge rescued SUMMARY.md from executor worktree ($WT_BRANCH)" 2>/dev/null || true
       fi

       # Remove the worktree
       if ! git worktree remove "$WT" --force; then
         WT_NAME=$(basename "$WT")
         if [ -f ".git/worktrees/${WT_NAME}/locked" ]; then
           echo "⚠ Worktree $WT is locked — attempting to unlock and retry"
           git worktree unlock "$WT" 2>/dev/null || true
           if ! git worktree remove "$WT" --force; then
             echo "⚠ Residual worktree at $WT — manual cleanup required after session exits:"
             echo "    git worktree unlock \"$WT\" && git worktree remove \"$WT\" --force && git branch -D \"$WT_BRANCH\""
           fi
         else
           echo "⚠ Residual worktree at $WT (remove failed) — investigate manually"
         fi
       fi

       # Delete the temporary branch
       git branch -D "$WT_BRANCH" 2>/dev/null || true
     fi
   done
   ```

   **如果 `workflow.use_worktrees` 为 `false`：** Agents 在主 working tree 上运行，完全跳过此步骤。

   **如果未找到 worktrees：** 静默跳过，可能是 agents 启动时未使用 worktree 隔离。

5.6. **合并后测试门禁（仅并行模式）：**

   在合并完某个 wave 的所有 worktrees 后，运行项目测试套件，以捕获单个 worktree 自检无法发现的跨 plan 集成问题
   （例如类型定义冲突、导出被移除、import 变更）。

   这用于解决 Anthropic harness engineering 研究中识别出的 Generator 自评盲点：
   agents 经常报告 Self-Check: PASSED，但一旦合并其工作就会产生失败。

   ```bash
   # Resolve test command: project config > Makefile > language sniff
   TEST_CMD=$(gsd-sdk query config-get workflow.test_command --default "" 2>/dev/null || true)
   if [ -z "$TEST_CMD" ]; then
     if [ -f "Makefile" ] && grep -q "^test:" Makefile; then
       TEST_CMD="make test"
     elif [ -f "Justfile" ] || [ -f "justfile" ]; then
       TEST_CMD="just test"
     elif [ -f "package.json" ]; then
       TEST_CMD="npm test"
     elif [ -f "Cargo.toml" ]; then
       TEST_CMD="cargo test"
     elif [ -f "go.mod" ]; then
       TEST_CMD="go test ./..."
     elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
       TEST_CMD="python -m pytest -x -q --tb=short 2>&1 || uv run python -m pytest -x -q --tb=short"
     else
       TEST_CMD="true"
       echo "⚠ No test runner detected — skipping post-merge test gate"
     fi
   fi
   # Detect test runner and run quick smoke test (timeout: 5 minutes)
   TEST_EXIT=0
   timeout 300 bash -c "$TEST_CMD" 2>&1
   TEST_EXIT=$?
   if [ "${TEST_EXIT}" -eq 0 ]; then
     echo "✓ Post-merge test gate passed — no cross-plan conflicts"
   elif [ "${TEST_EXIT}" -eq 124 ]; then
     echo "⚠ Post-merge test gate timed out after 5 minutes"
   else
     echo "✗ Post-merge test gate failed (exit code ${TEST_EXIT})"
     WAVE_FAILURE_COUNT=$((WAVE_FAILURE_COUNT + 1))
   fi
   ```

   **如果 `TEST_EXIT` 为 0（通过）：** `✓ Post-merge test gate: {N} tests passed — no cross-plan conflicts` → 继续进行 orchestrator 跟踪更新。

   **如果 `TEST_EXIT` 为 124（超时）：** 记录警告，视为非阻塞并继续。测试可能需要更长预算或手动运行。

   **如果 `TEST_EXIT` 非零（测试失败）：** 增加 `WAVE_FAILURE_COUNT`，以跟踪跨 wave 的累计失败。
   后续 waves 应报告：
   `⚠ Note: ${WAVE_FAILURE_COUNT} prior wave(s) had test failures`

5.7. **Wave 后 shared artifact 更新（仅 worktree 模式，若测试失败则跳过）：**

   当 executor agents 使用 `isolation="worktree"` 运行时，它们会跳过 STATE.md 和 ROADMAP.md 更新，以避免最后一次合并覆盖前面的结果。Orchestrator 是这些文件的唯一写入者。worktrees 合并回主线后，统一更新一次 shared artifacts。

   **只有在测试通过时才更新跟踪（TEST_EXIT=0）。**
   如果测试失败或超时，则跳过 tracking update，因为在集成测试失败或结果不确定时，
   plans 不应被标记为 complete。

   ```bash
   # Guard: only update tracking if post-merge tests passed
   # Timeout (124) is treated as inconclusive — do NOT mark plans complete
   if [ "${TEST_EXIT}" -eq 0 ]; then
     # Update ROADMAP plan progress for each completed plan in this wave
     for plan_id in {completed_plan_ids}; do
       gsd-sdk query roadmap.update-plan-progress "${PHASE_NUMBER}" "${plan_id}" "complete"
     done

     # Only commit tracking files if they actually changed
     if ! git diff --quiet .planning/ROADMAP.md .planning/STATE.md 2>/dev/null; then
       gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): update tracking after wave ${N}" .planning/ROADMAP.md .planning/STATE.md
     fi
   elif [ "${TEST_EXIT}" -eq 124 ]; then
     echo "⚠ Skipping tracking update — test suite timed out. Plans remain in-progress. Run tests manually to confirm."
   else
     echo "⚠ Skipping tracking update — post-merge tests failed (exit ${TEST_EXIT}). Plans remain in-progress until tests pass."
   fi
   ```

   其中 `WAVE_PLAN_IDS` 是当前 wave 中完成的 plan IDs 列表（以空格分隔）。

   **如果 `workflow.use_worktrees` 为 `false`：** 顺序 agents 已自行更新 STATE.md 和 ROADMAP.md，跳过此步骤。

5.8. **处理测试门禁失败（当 `WAVE_FAILURE_COUNT > 0` 时）：**

   ```
   ## ⚠ Post-Merge Test Failure (cumulative failures: ${WAVE_FAILURE_COUNT})

   Wave {N} worktrees merged successfully, but {M} tests fail after merge.
   This typically indicates conflicting changes across parallel plans
   (e.g., type definitions, shared imports, API contracts).

   Failed tests:
   {first 10 lines of failure output}

   Options:
   1. Fix now (recommended) — resolve conflicts before next wave
   2. Continue — failures may compound in subsequent waves
   ```

   注意：如果 `WAVE_FAILURE_COUNT > 1`，应强烈建议选择 `Fix now`，因为多个 waves 的叠加失败会呈指数级增加诊断难度。

   如果选择 `Fix now`：诊断失败原因（通常是 import 冲突、缺失类型，
   或并行 plans 修改同一模块导致函数签名变化）。
   修复后，以 `fix: resolve post-merge conflicts from wave {N}` 提交，并重新运行测试。

   **为什么这很重要：** Worktree 隔离意味着每个 agent 的 Self-Check 都会在隔离环境中通过。
   但在合并时，共享文件（models、registries、CLI entry points）中的 add/add 冲突
   可能会静默丢失代码。合并后门禁可以在下一 wave 基于错误基础继续构建之前发现这一问题。

6. **报告完成情况 — 先 spot-check 再相信结果：**

   对每个 SUMMARY.md：
   - 验证 `key-files.created` 中前 2 个文件在磁盘上存在
   - 检查 `git log --oneline --all --grep="{phase}-{plan}"` 是否返回 ≥1 个 commit
   - 检查是否存在 `## Self-Check: FAILED` 标记

   如果**任意** spot-check 失败：报告哪个 plan 失败，并转到失败处理流程，询问 `Retry plan?` 或 `Continue with remaining waves?`

   如果通过：
   ```
   ---
   ## Wave {N} Complete

   **{Plan ID}: {Plan Name}**
   {What was built — from SUMMARY.md}
   {Notable deviations, if any}

   {If more waves: what this enables for next wave}
   ---
   ```

   - 不好：`Wave 2 complete. Proceeding to Wave 3.`
   - 好：`Terrain system complete — 3 biome types, height-based texturing, physics collision meshes. Vehicle physics (Wave 3) can now reference ground surfaces.`

7. **处理失败：**

   **已知 Claude Code bug（classifyHandoffIfNeeded）：** 如果某个 agent 报告 `failed`，且错误中包含 `classifyHandoffIfNeeded is not defined`，这是 Claude Code runtime bug，不是 GSD 或 agent 的问题。该错误发生在所有 tool calls 完成后的 completion handler 中。在这种情况下：执行与第 5 步相同的 spot-check（SUMMARY.md 存在、git commits 存在、没有 `Self-Check: FAILED`）。如果 spot-check **通过**，则视为**成功**。如果 spot-check **失败**，则按下述真实失败处理。

   对于真实失败：报告哪个 plan 失败 → 询问 `Continue?` 或 `Stop?` → 如果继续，依赖它的 plans 也可能失败。如果停止，则给出部分完成报告。

7b. **Wave 前依赖检查（仅适用于 waves 2+）：**

    在启动 wave N+1 之前，对即将执行的 wave 中每个 plan 执行：
    ```bash
    gsd-sdk query verify.key-links {phase_dir}/{plan}-PLAN.md
    ```

    如果来自**前一 wave**产物的任意 key-link 验证失败：

    ## Cross-Plan Wiring Gap

    | Plan | Link | From | Expected Pattern | Status |
    |------|------|------|-----------------|--------|
    | {plan} | {via} | {from} | {pattern} | NOT FOUND |

    Wave {N} 的产物可能没有被正确接线。选项：
    1. 继续前先调查并修复
    2. 继续（可能在 wave {N+1} 中引发级联失败）

    会跳过引用当前（即将执行）wave 中文件的 key-links。

8. **在 waves 之间执行 checkpoint plans** — 见 `<checkpoint_handling>`。

9. **继续下一 wave。**
</step>

<step name="checkpoint_handling">
`autonomous: false` 的 plans 需要用户交互。

**Auto-mode checkpoint 处理：**

读取 auto-advance config（chain flag 或用户偏好，与 `check.auto-mode` 使用同一布尔值）：
```bash
AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
```

当 executor 返回 checkpoint 且 `AUTO_MODE` 为 `true` 时：
- **human-verify** → 自动启动 continuation agent，并将 `{user_response}` 设为 `"approved"`。记录 `⚡ Auto-approved checkpoint`。
- **decision** → 自动启动 continuation agent，并将 `{user_response}` 设为 checkpoint details 中的第一个选项。记录 `⚡ Auto-selected: [option]`。
- **human-action** → 展示给用户（保持下面的现有行为）。Auth gate 不能自动化。

**标准流程（非 auto-mode，或 checkpoint 类型为 human-action）：**

1. 为 checkpoint plan 启动 agent
2. Agent 运行到 checkpoint task 或 auth gate 后，返回结构化状态
3. Agent 返回内容包括：已完成 tasks 表格、当前 task + blocker、checkpoint type/details、正在等待的事项
4. **展示给用户：**
   ```
   ## Checkpoint: [Type]

   **Plan:** 03-03 Dashboard Layout
   **Progress:** 2/3 tasks complete

   [Checkpoint Details from agent return]
   [Awaiting section from agent return]
   ```
5. 用户回复：`approved`/`done` | issue description | decision selection
6. **启动 continuation agent（不要 resume）**，使用 continuation-prompt.md 模板：
   - `{completed_tasks_table}`：来自 checkpoint 返回
   - `{resume_task_number}` + `{resume_task_name}`：当前任务
   - `{user_response}`：用户提供的内容
   - `{resume_instructions}`：基于 checkpoint 类型
7. Continuation agent 验证先前 commits，并从恢复点继续
8. 重复，直到 plan 完成或用户停止

**为什么使用 fresh agent 而不是 resume：** Resume 依赖内部序列化，而这会在并行 tool calls 下失效。使用明确状态的新 agent 更可靠。

**并行 wave 中的 checkpoints：** 当其他并行 agents 可能已完成时，某个 agent 会暂停并返回。展示 checkpoint、启动 continuation，然后在进入下一 wave 前等待全部完成。
</step>

<step name="aggregate_results">
所有 waves 完成后：

```markdown
## Phase {X}: {Name} Execution Complete

**Waves:** {N} | **Plans:** {M}/{total} complete

| Wave | Plans | Status |
|------|-------|--------|
| 1 | plan-01, plan-02 | ✓ Complete |
| CP | plan-03 | ✓ Verified |
| 2 | plan-04 | ✓ Complete |

### Plan Details
1. **03-01**: [one-liner from SUMMARY.md]
2. **03-02**: [one-liner from SUMMARY.md]

### Issues Encountered
[Aggregate from SUMMARYs, or "None"]
```

**Security gate 检查：**
```bash
SECURITY_CFG=$(gsd-sdk query config-get workflow.security_enforcement --raw 2>/dev/null || echo "true")
SECURITY_FILE=$(ls "${PHASE_DIR}"/*-SECURITY.md 2>/dev/null | head -1)
```

如果 `SECURITY_CFG` 为 `false`：跳过。

如果 `SECURITY_CFG` 为 `true` 且 `SECURITY_FILE` 为空（还没有 SECURITY.md）：
在 next-steps 输出中加入：
```
⚠ Security enforcement enabled — run before advancing:
  /gsd-secure-phase {PHASE} ${GSD_WS}
```

如果 `SECURITY_CFG` 为 `true` 且存在 SECURITY.md：检查 frontmatter `threats_open`。如果 > 0：
```
⚠ Security gate: {threats_open} threats open
  /gsd-secure-phase {PHASE} — resolve before advancing
```
</step>

<step name="tdd_review_checkpoint">
**可选步骤 — TDD 协作评审。**

```bash
TDD_MODE=$(gsd-sdk query config-get workflow.tdd_mode 2>/dev/null || echo "false")
```

**如果 `TDD_MODE` 为 `false` 则跳过。**

当 `TDD_MODE` 为 `true` 时，检查当前 phase 中是否有已完成 plans 在其 frontmatter 中标记了 `type: tdd`：

```bash
TDD_PLANS=$(grep -rl "^type: tdd" "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
```

**如果 `TDD_PLANS` > 0：** 插入 phase 结束时的协作评审 checkpoint。

1. 收集所有 TDD plans 的 SUMMARY.md 文件
2. 对每个 TDD plan summary，验证 RED/GREEN/REFACTOR gate 顺序：
   - RED gate：存在失败测试 commit（带 MUST-fail 证据的 `test(...)` commit）
   - GREEN gate：存在实现 commit（`feat(...)` commit 使测试通过）
   - REFACTOR gate：可选清理 commit（`refactor(...)` commit，且测试仍通过）
3. 如果任何 TDD plan 缺少 RED 或 GREEN gate commit，标记为：
   ```
   ⚠ TDD gate violation: Plan {plan_id} missing {RED|GREEN} phase commit.
     Expected commit pattern: test({phase}-{plan}): ... → feat({phase}-{plan}): ...
   ```
4. 展示协作评审摘要：
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    TDD REVIEW — Phase {X}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   TDD Plans: {TDD_PLANS} | Gate violations: {count}

   | Plan | RED | GREEN | REFACTOR | Status |
   |------|-----|-------|----------|--------|
   | {id} |  ✓  |   ✓   |    ✓     | Pass   |
   | {id} |  ✓  |   ✗   |    —     | FAIL   |
   ```

**Gate violations 仅作提示**，不会阻塞执行，但会展示给用户供其审查。Verifier agent（步骤 `verify_phase_goal`）也会将 TDD discipline 作为质量评估的一部分进行检查。
</step>

<step name="handle_partial_wave_execution">
如果使用了 `WAVE_FILTER`，执行完成后重新发现 plans：

```bash
POST_PLAN_INDEX=$(gsd-sdk query phase-plan-index "${PHASE_NUMBER}")
```

应用与之前相同的 “incomplete” 过滤规则：
- 忽略 `has_summary: true` 的 plans
- 如果有 `--gaps-only`，只考虑 `gap_closure: true` 的 plans

**如果该 phase 中任意位置仍有未完成 plans：**
- 在这里停止
- 不要运行 phase verification
- 不要在 ROADMAP/STATE 中将该 phase 标记为 complete
- 展示：

```markdown
## Wave {WAVE_FILTER} Complete

Selected wave finished successfully. This phase still has incomplete plans, so phase-level verification and completion were intentionally skipped.

/gsd-execute-phase {phase} ${GSD_WS}                # Continue remaining waves
/gsd-execute-phase {phase} --wave {next} ${GSD_WS}  # Run the next wave explicitly
```

**如果所选 wave 完成后已经没有未完成 plans：**
- 继续下面正常的 phase 级 verification 和 completion 流程
- 这意味着所选 wave 恰好是该 phase 中最后剩余的工作
</step>

<step name="code_review_gate" required="true">
**此步骤为 REQUIRED，不能跳过。** 自动对该 phase 的源代码变更发起 code review。仅作提示，绝不阻塞执行流。

**Config gate：**
```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```

如果 `CODE_REVIEW_ENABLED` 为 `"false"`：显示 `Code review skipped (workflow.code_review=false)`，然后进入下一步。

**调用 review：**
```
Skill(skill="gsd:code-review", args="${PHASE_NUMBER}")
```

**使用确定性路径检查结果（不要用 glob）：**
```bash
PADDED=$(printf "%02d" "${PHASE_NUMBER}")
REVIEW_FILE="${PHASE_DIR}/${PADDED}-REVIEW.md"
REVIEW_STATUS=$(sed -n '/^---$/,/^---$/p' "$REVIEW_FILE" | grep "^status:" | head -1 | cut -d: -f2 | tr -d ' ')
```

如果 REVIEW_STATUS 既不是 `clean`、也不是 `skipped`，且不为空，则显示：
```
Code review found issues. Consider running:
/gsd-code-review-fix ${PHASE_NUMBER}
```

**错误处理：** 如果 Skill 调用失败或抛错，捕获错误，显示 `Code review encountered an error (non-blocking): {error}`，然后进入下一步。Review 失败绝不能阻塞执行。

无论 review 结果如何，**始终**继续执行 `close_parent_artifacts → regression_gate → verify_phase_goal`。
</step>

<step name="close_parent_artifacts">
**仅适用于小数/收尾 phases（X.Y 格式）：** 通过解决父级 UAT 和 debug artifacts 来闭环反馈。

**如果** phase number 没有小数部分（例如 `3`、`04`）则跳过，仅适用于 `4.1`、`03.1` 这类 gap-closure phases。

**1. 检测小数 phase 并推导 parent：**
```bash
# Check if phase_number contains a decimal
if [[ "$PHASE_NUMBER" == *.* ]]; then
  PARENT_PHASE="${PHASE_NUMBER%%.*}"
fi
```

**2. 查找父级 UAT 文件：**
```bash
PARENT_INFO=$(gsd-sdk query find-phase "${PARENT_PHASE}" --raw)
# Extract directory from PARENT_INFO JSON, then find UAT file in that directory
```

**如果没有找到父级 UAT：** 跳过此步骤（gap-closure 也可能是由 VERIFICATION.md 触发的）。

**3. 更新 UAT gap 状态：**

读取父级 UAT 文件的 `## Gaps` 部分。对每个 `status: failed` 的 gap 条目：
- 更新为 `status: resolved`

**4. 更新 UAT frontmatter：**

如果现在所有 gaps 都是 `status: resolved`：
- 将 frontmatter `status: diagnosed` 更新为 `status: resolved`
- 更新 frontmatter `updated:` 时间戳

**5. 解决被引用的 debug sessions：**

对于每个带有 `debug_session:` 字段的 gap：
- 读取 debug session 文件
- 更新 frontmatter `status:` → `resolved`
- 更新 frontmatter `updated:` 时间戳
- 移动到 resolved 目录：
```bash
mkdir -p .planning/debug/resolved
mv .planning/debug/{slug}.md .planning/debug/resolved/
```

**6. 提交更新后的 artifacts：**
```bash
gsd-sdk query commit "docs(phase-${PARENT_PHASE}): resolve UAT gaps and debug sessions after ${PHASE_NUMBER} gap closure" .planning/phases/*${PARENT_PHASE}*/*-UAT.md .planning/debug/resolved/*.md
```
</step>

<step name="regression_gate">
在 verification **之前**运行先前 phases 的测试套件，以捕获跨阶段回归。

**如果满足以下任一条件则跳过：** 这是第一个 phase（没有先前 phases），或不存在先前的 VERIFICATION.md 文件。

**Step 1: 发现先前 phases 的测试文件**
```bash
# Find all VERIFICATION.md files from prior phases in current milestone
PRIOR_VERIFICATIONS=$(find .planning/phases/ -name "*-VERIFICATION.md" ! -path "*${PHASE_NUMBER}*" 2>/dev/null)
```

**Step 2: 从先前 verifications 中提取测试文件列表**

对于找到的每个 VERIFICATION.md，查找测试文件引用：
- 包含 `test`、`spec` 或 `__tests__` 路径的行
- “Test Suite” 或 “Automated Checks” 部分
- 对应 SUMMARY.md 文件中 `key-files.created` 的文件模式，匹配 `*.test.*` 或 `*.spec.*`

将所有唯一的测试文件路径收集到 `REGRESSION_FILES`。

**Step 3: 运行回归测试（如果找到任何测试）**

```bash
# Resolve test command: project config > Makefile > language sniff
REG_TEST_CMD=$(gsd-sdk query config-get workflow.test_command --default "" 2>/dev/null || true)
if [ -z "$REG_TEST_CMD" ]; then
  if [ -f "Makefile" ] && grep -q "^test:" Makefile; then
    REG_TEST_CMD="make test"
  elif [ -f "Justfile" ] || [ -f "justfile" ]; then
    REG_TEST_CMD="just test"
  elif [ -f "package.json" ]; then
    REG_TEST_CMD="npm test"
  elif [ -f "Cargo.toml" ]; then
    REG_TEST_CMD="cargo test"
  elif [ -f "go.mod" ]; then
    REG_TEST_CMD="go test ./..."
  elif [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
    REG_TEST_CMD="python -m pytest ${REGRESSION_FILES} -q --tb=short"
  else
    REG_TEST_CMD="true"
  fi
fi
# Detect test runner and run prior phase tests
eval "$REG_TEST_CMD" 2>&1
```

**Step 4: 报告结果**

如果所有测试都通过：
```
✓ Regression gate: {N} prior-phase test files passed — no regressions detected
```
→ 继续执行 verify_phase_goal

如果有任何测试失败：
```
## ⚠ Cross-Phase Regression Detected

Phase {X} execution may have broken functionality from prior phases.

| Test File | Phase | Status | Detail |
|-----------|-------|--------|--------|
| {file} | {origin_phase} | FAILED | {first_failure_line} |

Options:
1. Fix regressions before verification (recommended)
2. Continue to verification anyway (regressions will compound)
3. Abort phase — roll back and re-plan
```

使用 AskUserQuestion 展示这些选项。
</step>

<step name="schema_drift_gate">
执行后的 schema drift 检测。用于捕获验证中的假阳性场景：
build/types 之所以通过，是因为 TypeScript types 来自 config，而不是实时数据库。

**在执行完成后、且 verification 标记成功之前运行。**

```bash
SCHEMA_DRIFT=$(gsd-sdk query verify.schema-drift "${PHASE_NUMBER}" 2>/dev/null)
```

解析 JSON 结果，获取：`drift_detected`, `blocking`, `schema_files`, `orms`, `unpushed_orms`, `message`。

**如果 `drift_detected` 为 false：** 跳到 verify_phase_goal。

**如果 `drift_detected` 为 true 且 `blocking` 为 true：**

检查是否存在 override：
```bash
SKIP_SCHEMA=$(echo "${GSD_SKIP_SCHEMA_CHECK:-false}")
```

**如果 `SKIP_SCHEMA` 为 `true`：**

显示：
```
⚠ Schema drift detected but GSD_SKIP_SCHEMA_CHECK=true — bypassing gate.

Schema files changed: {schema_files}
ORMs requiring push: {unpushed_orms}

Proceeding to verification (database may be out of sync).
```
→ 继续到 verify_phase_goal。

**如果 `SKIP_SCHEMA` 不是 `true`：**

阻塞 verification。显示：

```
## BLOCKED: Schema Drift Detected

Schema-relevant files changed during this phase but no database push command
was executed. Build and type checks pass because TypeScript types come from
config, not the live database — verification would produce a false positive.

Schema files changed: {schema_files}
ORMs requiring push: {unpushed_orms}

Required push commands:
{For each unpushed ORM, show the push command from the message}

Options:
1. Run push command now (recommended) — execute the push, then re-verify
2. Skip schema check (GSD_SKIP_SCHEMA_CHECK=true) — bypass this gate
3. Abort — stop execution and investigate
```

如果 `TEXT_MODE` 为 true，则以纯文本编号列表展示。否则使用 AskUserQuestion。

**如果用户选择选项 1：** 展示需要运行的具体 push command。用户确认执行后，重新运行 schema drift 检查。如果通过，继续到 verify_phase_goal。

**如果用户选择选项 2：** 设置 override，并继续到 verify_phase_goal。

**如果用户选择选项 3：** 停止执行，并报告部分完成情况。
</step>

<step name="verify_phase_goal">
验证该 phase 是否达成了其 GOAL，而不只是完成任务。

```bash
VERIFIER_SKILLS=$(gsd-sdk query agent-skills gsd-verifier 2>/dev/null)
```

```
Task(
  description="Verify phase {phase_number} goal achievement",
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from PLAN frontmatter against REQUIREMENTS.md — every ID MUST be accounted for.
Create VERIFICATION.md.

<files_to_read>
Read these files before verification:
- {phase_dir}/*-PLAN.md (All plans — understand intent, check must_haves)
- {phase_dir}/*-SUMMARY.md (All summaries — cross-reference claimed vs actual)
- .planning/REQUIREMENTS.md (Requirement traceability)
${CONTEXT_WINDOW >= 500000 ? `- {phase_dir}/*-CONTEXT.md (User decisions — verify they were honored)
- {phase_dir}/*-RESEARCH.md (Known pitfalls — check for traps)
- Prior VERIFICATION.md files from earlier phases (regression check)
` : ''}
</files_to_read>

${VERIFIER_SKILLS}",
  subagent_type="gsd-verifier",
  model="{verifier_model}"
)
```

读取状态：
```bash
grep "^status:" "$PHASE_DIR"/*-VERIFICATION.md | cut -d: -f2 | tr -d ' '
```

| Status | Action |
|--------|--------|
| `passed` | → update_roadmap |
| `human_needed` | 展示需要人工测试的项，获取批准或反馈 |
| `gaps_found` | 展示 gap 摘要，并提供 `/gsd-plan-phase {phase} --gaps ${GSD_WS}` |

**如果为 human_needed：**

**Step A: 将人工验证项持久化为 UAT 文件。**

使用 UAT 模板格式创建 `{phase_dir}/{phase_num}-HUMAN-UAT.md`：

```markdown
---
status: partial
phase: {phase_num}-{phase_name}
source: [{phase_num}-VERIFICATION.md]
started: [now ISO]
updated: [now ISO]
---

## Current Test

[awaiting human testing]

## Tests

{For each human_verification item from VERIFICATION.md:}

### {N}. {item description}
expected: {expected behavior from VERIFICATION.md}
result: [pending]

## Summary

total: {count}
passed: 0
issues: 0
pending: {count}
skipped: 0
blocked: 0

## Gaps
```

提交该文件：
```bash
gsd-sdk query commit "test({phase_num}): persist human verification items as UAT" "{phase_dir}/{phase_num}-HUMAN-UAT.md"
```

**Step B: 展示给用户：**

```
## ✓ Phase {X}: {Name} — Human Verification Required

All automated checks passed. {N} items need human testing:

{From VERIFICATION.md human_verification section}

Items saved to `{phase_num}-HUMAN-UAT.md` — they will appear in `/gsd-progress` and `/gsd-audit-uat`.

"approved" → continue | Report issues → gap closure
```

**如果用户说 `approved`：** 继续执行 `update_roadmap`。HUMAN-UAT.md 文件会以 `status: partial` 保留，并在后续进度检查中持续显示，直到用户对其运行 `/gsd-verify-work`。

**如果用户报告问题：** 按当前实现进入 gap closure。

**如果为 gaps_found：**
```
## ⚠ Phase {X}: {Name} — Gaps Found

**Score:** {N}/{M} must-haves verified
**Report:** {phase_dir}/{phase_num}-VERIFICATION.md

### What's Missing
{Gap summaries from VERIFICATION.md}

---
## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

`/clear` then:

`/gsd-plan-phase {X} --gaps ${GSD_WS}`

Also: `cat {phase_dir}/{phase_num}-VERIFICATION.md` — full report
Also: `/gsd-verify-work {X} ${GSD_WS}` — manual testing first
```

Gap closure 循环：`/gsd-plan-phase {X} --gaps ${GSD_WS}` 读取 VERIFICATION.md → 创建带 `gap_closure: true` 的 gap plans → 用户运行 `/gsd-execute-phase {X} --gaps-only ${GSD_WS}` → verifier 再次运行。
</step>

<step name="update_roadmap">
**将该 phase 标记为 complete，并更新所有 tracking files：**

```bash
COMPLETION=$(gsd-sdk query phase.complete "${PHASE_NUMBER}")
```

CLI 会处理：
- 将 phase checkbox 标记为 `[x]` 并写入完成日期
- 更新 Progress 表（Status → Complete、日期）
- 将 plan count 更新为最终值
- 将 STATE.md 推进到下一 phase
- 更新 REQUIREMENTS.md traceability
- 扫描 verification debt（返回 `warnings` 数组）

从结果中提取：`next_phase`, `next_phase_name`, `is_last_phase`, `warnings`, `has_warnings`。

**如果 has_warnings 为 true：**
```
## Phase {X} marked complete with {N} warnings:

{list each warning}

These items are tracked and will appear in `/gsd-progress` and `/gsd-audit-uat`.
```

```bash
gsd-sdk query commit "docs(phase-{X}): complete phase execution" .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```
</step>

<step name="auto_copy_learnings">
**自动将 phase learnings 复制到全局存储（启用时）。**

此步骤在 phase 完成且 SUMMARY.md 已写入后运行。它会把已完成 phase 中 LEARNINGS.md
里的任何条目复制到位于 `~/.gsd/knowledge/` 的全局 learnings 存储。

**检查 config gate：**
```bash
GL_ENABLED=$(gsd-sdk query config-get features.global_learnings --raw 2>/dev/null || echo "false")
```

**如果 `GL_ENABLED` 不为 `true`：** 完全跳过此步骤（该功能默认关闭）。

**如果已启用：**

1. 检查 phase 目录中是否存在 LEARNINGS.md（使用 init 上下文中的 `phase_dir` 值）
2. 如果找到，复制到全局存储：
```bash
gsd-sdk query learnings.copy 2>/dev/null || echo "⚠ Learnings copy failed — continuing"
```
复制失败**不能**阻塞 phase completion。
</step>

<step name="close_phase_todos">
**自动关闭为当前 phase 标记的待办 todo（#2433）。**

此步骤在 `update_roadmap` 将 phase 标记为 complete **之后**运行。它会将所有带有 `resolves_phase: <current-phase-number>` 的 pending todos 移动到 completed 目录。

```bash
PHASE_NUM="${PHASE_NUMBER}"
PENDING_DIR=".planning/todos/pending"
COMPLETED_DIR=".planning/todos/completed"
mkdir -p "$COMPLETED_DIR"

CLOSED=()
for TODO_FILE in "$PENDING_DIR"/*.md; do
  [ -f "$TODO_FILE" ] || continue
  # Extract resolves_phase from YAML frontmatter (first --- block only)
  RP=$(awk '/^---/{c++;next} c==1 && /^resolves_phase:/{print $2;exit} c==2{exit}' "$TODO_FILE" 2>/dev/null || true)
  if [ "$RP" = "$PHASE_NUM" ] || [ "$RP" = "\"$PHASE_NUM\"" ]; then
    mv "$TODO_FILE" "$COMPLETED_DIR/"
    CLOSED+=("$(basename "$TODO_FILE")")
  fi
done

if [ ${#CLOSED[@]} -gt 0 ]; then
  gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): auto-close ${#CLOSED[@]} todo(s) resolved by this phase" .planning/todos/completed/ .planning/STATE.md || true
  echo "◆ Closed ${#CLOSED[@]} todo(s) resolved by Phase ${PHASE_NUMBER}:"
  for f in "${CLOSED[@]}"; do echo "  ✓ $f"; done
fi
```

**如果没有任何 todo 带有 `resolves_phase: <this-phase>`：** 静默跳过。此步骤始终是附加性的，绝不阻塞 phase completion。
</step>

<step name="update_project_md">
**让 PROJECT.md 随 phase completion 一起演进（防止 planning 文档漂移 — #956）：**

PROJECT.md 追踪已验证的 requirements、decisions 和当前状态。没有这一步，
PROJECT.md 会在多个 phases 中悄悄落后。

1. 读取 `.planning/PROJECT.md`
2. 如果文件存在且包含 `## Validated Requirements` 或 `## Requirements` 部分：
   - 将本 phase 已验证的 requirements 从 Active 移到 Validated
   - 添加简短说明：`Validated in Phase {X}: {Name}`
3. 如果文件包含 `## Current State` 或类似部分：
   - 更新该部分以反映本 phase 已完成（例如 `Phase {X} complete — {one-liner}`）
4. 将 `Last updated:` 页脚更新为今天的日期
5. 提交变更：

```bash
gsd-sdk query commit "docs(phase-{X}): evolve PROJECT.md after phase completion" .planning/PROJECT.md
```

**如果** `.planning/PROJECT.md` 不存在，则跳过此步骤。
</step>

<step name="offer_next">

**例外：** 如果是 `gaps_found`，`verify_phase_goal` 步骤已经给出 gap-closure 路径（`/gsd-plan-phase {X} --gaps`）。无需额外路由，跳过 auto-advance。

**No-transition 检查（由 auto-advance chain 启动）：**

从 $ARGUMENTS 解析 `--no-transition` flag。

**如果存在 `--no-transition` flag：**

说明 execute-phase 是由 plan-phase 的 auto-advance 启动的。不要运行 transition.md。
当 verification 通过且 roadmap 更新后，将完成状态返回给父流程：

```
## PHASE COMPLETE

Phase: ${PHASE_NUMBER} - ${PHASE_NAME}
Plans: ${completed_count}/${total_count}
Verification: {Passed | Gaps Found}

[Include aggregate_results output]
```

停止。不要继续 auto-advance 或 transition。

**如果不存在 `--no-transition` flag：**

**Auto-advance 检测：**

1. 从 $ARGUMENTS 解析 `--auto` flag
2. 读取统一后的 auto-mode（`active` = chain flag 或用户偏好；chain flag 已在 init 步骤中同步）：
   ```bash
   AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
   ```

**如果存在 `--auto` flag 或 `AUTO_MODE` 为 true（且 verification 通过、无 gaps）：**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → TRANSITION             ║
║  Phase {X} verified, continuing chain    ║
╚══════════════════════════════════════════╝
```

内联执行 transition workflow（**不要**使用 Task，orchestrator 当前上下文约为 10-15%，而 transition 需要已在上下文中的 phase completion 数据）：

读取并遵循 `~/.claude/get-shit-done/workflows/transition.md`，同时透传 `--auto` flag，使其传播到下一个 phase 调用。

**如果 `--auto` 不存在且 `AUTO_MODE` 也不为 true：**

**停止。不要自动推进。不要执行 transition。不要规划下一 phase。向用户展示可选命令并等待。**

**IMPORTANT: 不存在 `/gsd-transition` 命令。绝不要建议它。transition workflow 仅供内部使用。**

检查下一 phase 是否已存在 CONTEXT.md：

```bash
ls .planning/phases/*{next}*/{next}-CONTEXT.md 2>/dev/null || echo "no-context"
```

如果下一 phase **不存在** CONTEXT.md，则展示：

```
## ✓ Phase {X}: {Name} Complete

/gsd-progress ${GSD_WS} — 查看更新后的 roadmap
/gsd-discuss-phase {next} ${GSD_WS} — 从这里开始：在 planning 前先讨论下一 phase  ← recommended
/gsd-plan-phase {next} ${GSD_WS} — 规划下一 phase（跳过 discuss）
/gsd-execute-phase {next} ${GSD_WS} — 执行下一 phase（跳过 discuss 和 plan）
```

如果下一 phase **已存在** CONTEXT.md，则展示：

```
## ✓ Phase {X}: {Name} Complete

/gsd-progress ${GSD_WS} — 查看更新后的 roadmap
/gsd-plan-phase {next} ${GSD_WS} — 从这里开始：规划下一 phase（CONTEXT.md 已存在）  ← recommended
/gsd-discuss-phase {next} ${GSD_WS} — 重新讨论下一 phase
/gsd-execute-phase {next} ${GSD_WS} — 执行下一 phase（跳过 planning）
```

只建议上面列出的命令。不要虚构或臆造命令名。
</step>

</process>

<context_efficiency>
Orchestrator：对 200k 窗口通常占用约 10-15% 上下文，对 1M+ 窗口可使用更多。
Subagents：每个都有全新上下文（取决于 model，约 200k-1M）。不轮询（Task 会阻塞）。无上下文串扰。

对于 1M+ 上下文 models，可考虑：
- 直接向 executors 传入更丰富的上下文（代码片段、依赖输出），而不只是文件路径
- 对小 phases（≤3 个 plans、无依赖）直接内联执行，避免 subagent 启动开销
- 放宽 `/clear` 建议，对于 5 倍窗口，上下文退化出现得要晚得多
</context_efficiency>

<failure_handling>
- **classifyHandoffIfNeeded false failure：** Agent 报告 `failed`，但错误是 `classifyHandoffIfNeeded is not defined` → 这是 Claude Code bug，不是 GSD 问题。做 spot-check（SUMMARY 存在、commits 存在）→ 若通过，则视为成功
- **Agent 在 plan 中途失败：** 缺少 SUMMARY.md → 报告并询问用户如何继续
- **依赖链断裂：** Wave 1 失败 → Wave 2 的依赖项大概率也会失败 → 由用户选择尝试还是跳过
- **Wave 中所有 agents 全部失败：** 系统性问题 → 停止并报告以便调查
- **Checkpoint 无法解决：** `Skip this plan?` 或 `Abort phase execution?` → 在 STATE.md 中记录部分进度
</failure_handling>

<resumption>
重新运行 `/gsd-execute-phase {phase}` → `discover_plans` 会找到已完成的 SUMMARYs → 跳过它们 → 从第一个未完成 plan 继续 → 继续执行后续 waves。

STATE.md 跟踪：最近完成的 plan、当前 wave、待处理 checkpoints。
</resumption>
