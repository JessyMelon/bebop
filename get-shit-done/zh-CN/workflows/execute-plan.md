<purpose>
执行阶段提示（PLAN.md）并创建结果摘要（SUMMARY.md）。
</purpose>

<required_reading>
在执行任何操作之前先阅读 STATE.md，以加载项目上下文。
阅读 config.json 以获取规划行为设置。

@~/.claude/get-shit-done/references/git-integration.md
</required_reading>

<available_agent_types>
有效的 GSD 子代理类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-executor — 执行计划任务、提交，并创建 SUMMARY.md
</available_agent_types>

<process>

<step name="init_context" priority="first">
加载执行上下文（仅路径，以尽量减少编排器上下文）：

```bash
INIT=$(gsd-sdk query init.execute-phase "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 中提取：`executor_model`、`commit_docs`、`sub_repos`、`phase_dir`、`phase_number`、`plans`、`summaries`、`incomplete_plans`、`state_path`、`config_path`。

如果缺少 `.planning/`：报错。
</step>

<step name="identify_plan">
```bash
# Use plans/summaries from INIT JSON, or list files
(ls .planning/phases/XX-name/*-PLAN.md 2>/dev/null || true) | sort
(ls .planning/phases/XX-name/*-SUMMARY.md 2>/dev/null || true) | sort
```

找到第一个没有匹配 SUMMARY 的 PLAN。支持小数阶段（`01.1-hotfix/`）：

```bash
PHASE=$(echo "$PLAN_PATH" | grep -oE '[0-9]+(\.[0-9]+)?-[0-9]+')
# config settings can be fetched via gsd-sdk query config-get if needed
```

<if mode="yolo">
自动批准：`⚡ Execute {phase}-{plan}-PLAN.md [Plan X of Y for Phase Z]` → parse_segments。
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
展示识别出的计划，并等待确认。
</if>
</step>

<step name="record_start_time">
```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```
</step>

<step name="parse_segments">
```bash
# Count tasks — match <task tag at any indentation level
TASK_COUNT=$(grep -cE '^\s*<task[[:space:]>]' .planning/phases/XX-name/{phase}-{plan}-PLAN.md 2>/dev/null || echo "0")
INLINE_THRESHOLD=$(gsd-sdk query config-get workflow.inline_plan_threshold 2>/dev/null || echo "2")
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

**主要路由：任务数量阈值（#1979）**

如果 `INLINE_THRESHOLD > 0` 且 `TASK_COUNT <= INLINE_THRESHOLD`：无论 checkpoint 类型如何，都使用 Pattern C（内联）。小计划以内联方式执行更快，可避免约 14K token 的子代理启动开销，并保留提示缓存。可通过 `workflow.inline_plan_threshold` 配置阈值（默认：2，设为 `0` 表示始终启动子代理）。

否则：应用下面基于 checkpoint 的路由。

**基于 checkpoint 的路由（任务数大于阈值的计划）：**

| Checkpoints | Pattern | Execution |
|-------------|---------|-----------|
| None | A (autonomous) | 单个子代理：完整计划 + SUMMARY + commit |
| Verify-only | B (segmented) | 按 checkpoint 之间的分段执行。none/human-verify 之后 → SUBAGENT。decision/human-action 之后 → MAIN |
| Decision | C (main) | 完全在主上下文中执行 |

**Pattern A：** init_agent_tracking → 捕获 `EXPECTED_BASE=$(git rev-parse HEAD)` → 使用提示启动 Task(subagent_type="gsd-executor", model=executor_model)：在 [path] 执行计划，自主完成，包含所有任务 + SUMMARY + commit，遵循偏差/auth 规则，并报告：计划名称、任务、SUMMARY 路径、commit hash → 跟踪 agent_id → 等待 → 更新跟踪 → 报告。**仅当 `workflow.use_worktrees` 不为 `false` 时才包含 `isolation="worktree"`**（通过 `config-get workflow.use_worktrees` 读取）。**使用 `isolation="worktree"` 时，在提示中包含 `<worktree_branch_check>` 块**，指示执行器运行 `git merge-base HEAD {EXPECTED_BASE}`，如果结果不同于 `{EXPECTED_BASE}`，则在开始前使用 `git reset --hard {EXPECTED_BASE}` 硬重置该分支（安全，因为发生在任何代理工作之前），然后用 `[ "$(git rev-parse HEAD)" != "{EXPECTED_BASE}" ] && exit 1` 验证。这用于修复一个已知问题：`EnterWorktree` 会从 `main` 而不是功能分支 HEAD 创建分支（影响所有平台）。

**Pattern B：** 逐段执行。自主段：仅为分配的任务启动子代理（不生成 SUMMARY/commit）。checkpoint：在主上下文中处理。所有分段完成后：聚合、创建 SUMMARY、提交。参见 segment_execution。

**Pattern C：** 在主上下文中使用标准流程执行（step name="execute"）。

每个子代理使用全新上下文可保持最佳质量。主上下文保持精简。
</step>

<step name="init_agent_tracking">
```bash
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
rm -f .planning/current-agent-id.txt
if [ -f .planning/current-agent-id.txt ]; then
  INTERRUPTED_ID=$(cat .planning/current-agent-id.txt)
  echo "Found interrupted agent: $INTERRUPTED_ID"
fi
```

如果存在中断项：询问用户是恢复（Task `resume` parameter）还是重新开始。

**跟踪协议：** 启动时：将 agent_id 写入 `current-agent-id.txt`，并向 agent-history.json 追加：`{"agent_id":"[id]","task_description":"[desc]","phase":"[phase]","plan":"[plan]","segment":[num|null],"timestamp":"[ISO]","status":"spawned","completion_timestamp":null}`。完成时：status → "completed"，设置 completion_timestamp，并删除 current-agent-id.txt。清理：如果条目数 > max_entries，移除最旧的 "completed"（绝不移除 "spawned"）。

在 Pattern A/B 中启动前运行。Pattern C：跳过。
</step>

<step name="segment_execution">
仅用于 Pattern B（仅 verify-only checkpoints）。A/C 跳过。

1. 解析分段映射：checkpoint 位置和类型
2. 对每个分段：
   - 子代理路线：仅为分配的任务启动 gsd-executor。提示包括：任务范围、计划路径、为获取上下文读取完整计划、执行分配任务、跟踪偏差、不生成 SUMMARY/commit。通过代理协议跟踪。
   - 主路线：使用标准流程执行任务（step name="execute"）
3. 在 **所有** 分段完成后：聚合文件/偏差/决策 → 创建 SUMMARY.md → 提交 → 自检：
   - 使用 `[ -f ]` 验证 key-files.created 在磁盘上存在
   - 检查 `git log --oneline --all --grep="{phase}-{plan}"` 返回 ≥1 个 commit
   - 重新运行每个任务中的 **全部** `<acceptance_criteria>` —— 如果任何项失败，在最终确定 SUMMARY 之前修复
   - 重新运行计划级别的 `<verification>` 命令 —— 将结果记录到 SUMMARY 中
   - 向 SUMMARY 追加 `## Self-Check: PASSED` 或 `## Self-Check: FAILED`

   **已知 Claude Code bug（classifyHandoffIfNeeded）：** 如果任何分段代理报告 "failed" 且提示 `classifyHandoffIfNeeded is not defined`，这是 Claude Code 运行时 bug，不是真实失败。执行抽查；如果通过，则视为成功。




</step>

<step name="load_prompt">
```bash
cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```
这就是执行指令。必须严格遵循。如果计划引用 CONTEXT.md：始终遵从用户愿景。

**如果计划包含 `<interfaces>` 块：** 这些是预先提取好的类型定义和契约。直接使用它们，不要重新读取源文件来发现类型。规划器已经提取了你需要的内容。
</step>

<step name="previous_phase_check">
```bash
gsd-sdk query phases.list --type summaries --raw
# Extract the second-to-last summary from the JSON result
```

**文本模式（config 中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 TEXT_MODE 启用时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）所必需的，因为这些环境中不可用 `AskUserQuestion`。
如果上一个 SUMMARY 的 "Issues Encountered" 或 "Next Phase Readiness" 中存在未解决的阻塞项：AskUserQuestion(header="Previous Issues", options: "Proceed anyway" | "Address first" | "Review previous")。
</step>

<step name="execute">
偏差是正常情况，按下面规则处理。

1. 读取提示中的 @context 文件
2. **MCP 工具：** 如果 CLAUDE.md 或项目说明提到 MCP 工具（例如用于代码导航的 jCodeMunch），在可用时优先于 Grep/Glob 使用。若无法访问 MCP 工具，则回退到 Grep/Glob。
3. 对每个任务：
   - **强制 read_first gate：** 如果任务有 `<read_first>` 字段，你 **必须** 在做任何编辑之前读取其中列出的每个文件。这不是可选项。不要因为“已经知道”内容就跳过这些文件，必须读取。read_first 文件为任务建立事实基础。
   - `type="auto"`：如果 `tdd="true"` → 按 TDD 执行。根据偏差规则 + auth gates 实现。验证 done criteria。提交（见 task_commit）。为 Summary 记录 hash。
   - `type="checkpoint:*"`：停止 → checkpoint_protocol → 等待用户 → 仅在确认后继续。
   - **硬门禁 — acceptance_criteria 验证：** 每个任务完成后，如果它包含 `<acceptance_criteria>`，你 **必须** 在继续前执行验证循环：
     1. 对每条 criteria：执行能证明其通过的 grep、文件检查或 CLI 命令
     2. 将每个结果记录为 PASS 或 FAIL，并附上命令输出
     3. 如果 **任一** criteria 失败：立即修复实现，然后重新运行 **全部** criteria
     4. 重复直到全部通过；在此 gate 清除前，你被 **阻止** 开始下一个任务
     5. 如果一条 criteria 在 2 次修复尝试后仍无法满足，将其作为偏差并附原因记录，不要悄悄跳过
     这不是建议。存在失败 acceptance criteria 的任务属于未完成任务。
3. 运行 `<verification>` 检查
4. 确认满足 `<success_criteria>`
5. 在 Summary 中记录偏差
</step>

<authentication_gates>

## 身份验证关卡

执行期间出现 auth 错误不是失败，而是预期中的交互点。

**指示信号：** "Not authenticated"、"Unauthorized"、401/403、"Please run {tool} login"、"Set {ENV_VAR}"

**协议：**
1. 识别 auth gate（不是 bug）
2. 停止任务执行
3. 创建动态 checkpoint:human-action，并写明精确的认证步骤
4. 等待用户完成认证
5. 验证凭证可用
6. 重试原始任务
7. 正常继续

**示例：** `vercel --yes` → "Not authenticated" → checkpoint 提示用户执行 `vercel login` → 使用 `vercel whoami` 验证 → 重试部署 → 继续

**在 Summary 中：** 作为正常流程记录到 "## Authentication Gates" 下，而不是作为偏差。

</authentication_gates>

<deviation_rules>

## 偏差规则

应用 gsd-executor 代理定义中的偏差规则（单一事实来源）：
- **Rules 1-3**（bug、缺失关键项、阻塞项）：自动修复、测试、验证，并作为偏差记录
- **Rule 4**（架构变更）：停止，向用户展示决策，等待批准
- **范围边界**：不要自动修复与当前任务无关的既有问题
- **修复尝试上限**：每个偏差最多重试 3 次，之后升级处理
- **优先级**：Rule 4（STOP）> Rules 1-3（auto）> 不确定时 → Rule 4

</deviation_rules>

<deviation_documentation>

## 记录偏差

Summary **必须** 包含偏差部分。若无偏差：→ `## Deviations from Plan\n\nNone - plan executed exactly as written.`

每个偏差：**[Rule N - Category] Title** — Found during: Task X | Issue | Fix | Files modified | Verification | Commit hash

结尾写：**Total deviations:** N auto-fixed（附分类）。**Impact:** 影响评估。

</deviation_documentation>

<tdd_plan_execution>
## TDD 执行

对于 `type: tdd` 计划，使用 RED-GREEN-REFACTOR：

1. **基础设施**（仅首个 TDD 计划）：检测项目、安装框架、配置，并验证空测试套件
2. **RED：** 读取 `<behavior>` → 编写失败测试 → 运行（**必须失败**）→ commit: `test({phase}-{plan}): add failing test for [feature]`
3. **GREEN：** 读取 `<implementation>` → 实现最小代码 → 运行（**必须通过**）→ commit: `feat({phase}-{plan}): implement [feature]`
4. **REFACTOR：** 清理代码 → 测试 **必须通过** → commit: `refactor({phase}-{plan}): clean up [feature]`

错误处理：RED 未失败 → 调查测试/现有功能。GREEN 未通过 → 调试并迭代。REFACTOR 破坏功能 → 撤销。

结构参见 `~/.claude/get-shit-done/references/tdd.md`。
</tdd_plan_execution>

<precommit_failure_handling>
## Pre-commit Hook 失败处理

你的提交可能会触发 pre-commit hooks。自动修复型 hook 会自行透明处理，文件会被自动修复并重新暂存。

**如果作为并行执行代理运行（由 execute-phase 启动）：**
对所有 commit 使用 `--no-verify`。当多个代理同时提交时，pre-commit hooks 会导致构建锁竞争（例如 Rust 项目中的 cargo 锁冲突）。编排器会在所有代理完成后统一验证一次。

**如果作为唯一执行器运行（顺序模式）：**
如果 commit 被 hook **阻止**：

1. `git commit` 命令因 hook 错误输出而失败
2. 读取错误信息，它会准确告诉你是哪个 hook、什么失败了
3. 修复问题（类型错误、lint 违规、secret 泄露等）
4. `git add` 已修复文件
5. 重试 commit
6. 每个 commit 预算 1-2 次重试循环
</precommit_failure_handling>

<task_commit>
## 任务提交协议

规范性的逐任务 commit 规则位于 **`agents/gsd-executor.md`**（`<task_commit_protocol>`）。关于暂存、`{type}({phase}-{plan})` 消息、`sub_repos` 存在时的 `commit-to-subrepo`、提交后检查、以及未跟踪文件处理，遵循该部分，不要在这里重复或转述完整协议（单一事实来源）。

**编排器说明：** 每个任务结束后，启动的执行器会回报 commit hashes；除指向执行器外，此工作流不再重新说明提交语义。

</task_commit>

<step name="checkpoint_protocol">
当遇到 `type="checkpoint:*"`：先尽可能自动化完成所有事情。checkpoint 只用于验证/决策。

显示：`CHECKPOINT: [Type]` 框 → 进度 {X}/{Y} → 任务名 → 特定类型内容 → `YOUR ACTION: [signal]`

| Type | Content | Resume signal |
|------|---------|---------------|
| human-verify (90%) | 已构建内容 + 验证步骤（命令/URLs） | "approved" 或描述问题 |
| decision (9%) | 所需决策 + 上下文 + 带利弊的选项 | "Select: option-id" |
| human-action (1%) | 已自动化内容 + **一个** 手动步骤 + 验证计划 | "done" |

收到响应后：如有指定则执行验证。通过 → 继续。失败 → 告知并等待。**等待用户**，不要臆造完成结果。

详情参见 ~/.claude/get-shit-done/references/checkpoints.md。
</step>

<step name="checkpoint_return_for_orchestrator">
当通过 Task 启动且遇到 checkpoint 时：返回结构化状态（无法直接与用户交互）。

**必需返回：** 1) Completed Tasks 表（hashes + files）2) Current Task（阻塞点）3) Checkpoint Details（面向用户的内容）4) Awaiting（需要用户提供什么）

编排器会解析 → 展示给用户 → 用你已完成任务状态启动新的续跑。你 **不会** 被恢复。在主上下文中：使用上面的 checkpoint_protocol。
</step>

<step name="verification_failure_gate">
如果验证失败：

**检查是否启用了 node repair**（默认：开启）：
```bash
NODE_REPAIR=$(gsd-sdk query config-get workflow.node_repair 2>/dev/null || echo "true")
```

如果 `NODE_REPAIR` 为 `true`：调用 `@./.claude/get-shit-done/workflows/node-repair.md`，并传入：
- FAILED_TASK：任务编号、名称、done-criteria
- ERROR：期望结果 vs 实际结果
- PLAN_CONTEXT：相邻任务名称 + 阶段目标
- REPAIR_BUDGET：来自 config 的 `workflow.node_repair_budget`（默认：2）

Node repair 会自主尝试 RETRY、DECOMPOSE 或 PRUNE。只有在修复预算耗尽时才会再次到达此 gate（ESCALATE）。

如果 `NODE_REPAIR` 为 `false`，或修复返回 ESCALATE：停止。展示："Verification failed for Task [X]: [name]. Expected: [criteria]. Actual: [result]. Repair attempted: [summary of what was tried]." 选项：Retry | Skip (mark incomplete) | Stop (investigate)。如果跳过 → 在 SUMMARY 的 "Issues Encountered" 中记录。
</step>

<step name="record_completion_time">
```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))

if [[ $DURATION_MIN -ge 60 ]]; then
  HRS=$(( DURATION_MIN / 60 ))
  MIN=$(( DURATION_MIN % 60 ))
  DURATION="${HRS}h ${MIN}m"
else
  DURATION="${DURATION_MIN} min"
fi
```
</step>

<step name="generate_user_setup">
```bash
grep -A 50 "^user_setup:" .planning/phases/XX-name/{phase}-{plan}-PLAN.md | head -50
```

如果存在 user_setup：使用模板 `~/.claude/get-shit-done/templates/user-setup.md` 创建 `{phase}-USER-SETUP.md`。按服务填写：环境变量表、账户设置清单、仪表盘配置、本地开发说明、验证命令。状态写为 "Incomplete"。设置 `USER_SETUP_CREATED=true`。如果为空/缺失：跳过。
</step>

<step name="create_summary">
在 `.planning/phases/XX-name/` 创建 `{phase}-{plan}-SUMMARY.md`。使用 `~/.claude/get-shit-done/templates/summary.md`。

**Frontmatter：** phase、plan、subsystem、tags | requires/provides/affects | tech-stack.added/patterns | key-files.created/modified | key-decisions | requirements-completed（**必须** 原样复制 PLAN.md frontmatter 中的 `requirements` 数组）| duration（`$DURATION`）、completed（`$PLAN_END_TIME` 日期）。

标题：`# Phase [X] Plan [Y]: [Name] Summary`

一句话总结必须有**实质内容**：例如 "JWT auth with refresh rotation using jose library"，而不是 "Authentication implemented"

包含：持续时间、开始/结束时间、任务数、文件数。

接下来：若还有更多计划 → "Ready for {next-plan}" | 若为最后一个 → "Phase complete, ready for next step"。
</step>

<step name="update_current_position">
**如果在并行模式下运行，则跳过此步骤**（`execute-phase.md` 中的编排器会在合并 worktrees 后集中处理 STATE.md/ROADMAP.md 更新，以避免冲突）。

使用 gsd-sdk query（或旧版 gsd-tools）state mutations 更新 STATE.md：

```bash
# Auto-detect parallel mode: .git is a file in worktrees, a directory in main repo
IS_WORKTREE=$([ -f .git ] && echo "true" || echo "false")

# Skip in parallel mode — orchestrator handles STATE.md centrally
if [ "$IS_WORKTREE" != "true" ]; then
  # Advance plan counter (handles last-plan edge case)
  gsd-sdk query state.advance-plan

  # Recalculate progress bar from disk state
  gsd-sdk query state.update-progress

  # Record execution metrics
  gsd-sdk query state.record-metric \
    --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}" \
    --tasks "${TASK_COUNT}" --files "${FILE_COUNT}"
fi
```
</step>

<step name="extract_decisions_and_issues">
从 SUMMARY 中提取决策并添加到 STATE.md：

```bash
# Add each decision from SUMMARY key-decisions
# Prefer file inputs for shell-safe text (preserves `$`, `*`, etc. exactly)
gsd-sdk query state.add-decision \
  --phase "${PHASE}" --summary-file "${DECISION_TEXT_FILE}" --rationale-file "${RATIONALE_FILE}"

# Add blockers if any found
gsd-sdk query state.add-blocker --text-file "${BLOCKER_TEXT_FILE}"
```
</step>

<step name="update_session_continuity">
使用 gsd-sdk query（或旧版 gsd-tools）更新会话信息：

```bash
gsd-sdk query state.record-session \
  --stopped-at "Completed ${PHASE}-${PLAN}-PLAN.md" \
  --resume-file "None"
```

将 STATE.md 控制在 150 行以内。
</step>

<step name="issues_review_gate">
如果 SUMMARY 中的 "Issues Encountered" ≠ "None"：yolo → 记录后继续。Interactive → 展示问题并等待确认。
</step>

<step name="update_roadmap">
**如果在并行模式下运行，则跳过此步骤**（编排器会在合并 worktrees 后集中更新 ROADMAP.md）。

```bash
# Auto-detect parallel mode: .git is a file in worktrees, a directory in main repo
IS_WORKTREE=$([ -f .git ] && echo "true" || echo "false")

# Skip in parallel mode — orchestrator handles ROADMAP.md centrally
if [ "$IS_WORKTREE" != "true" ]; then
  gsd-sdk query roadmap.update-plan-progress "${PHASE}"
fi
```
统计磁盘上的 PLAN 与 SUMMARY 文件数量。用正确的计数和状态（`In Progress` 或 `Complete` 加日期）更新进度表行。
</step>

<step name="update_requirements">
根据 PLAN.md frontmatter 的 `requirements:` 字段标记已完成需求：

```bash
gsd-sdk query requirements.mark-complete ${REQ_IDS}
```

从计划的 frontmatter 中提取 requirement IDs（例如 `requirements: [AUTH-01, AUTH-02]`）。如果没有 requirements 字段，则跳过。
</step>

<step name="git_commit_metadata">
任务代码已按任务完成提交。接下来提交计划元数据：

```bash
# Auto-detect parallel mode: .git is a file in worktrees, a directory in main repo
IS_WORKTREE=$([ -f .git ] && echo "true" || echo "false")

# In parallel mode: exclude STATE.md and ROADMAP.md (orchestrator commits these)
if [ "$IS_WORKTREE" = "true" ]; then
  gsd-sdk query commit "docs({phase}-{plan}): complete [plan-name] plan" .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/REQUIREMENTS.md
else
  gsd-sdk query commit "docs({phase}-{plan}): complete [plan-name] plan" .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
fi
```
</step>

<step name="update_codebase_map">
如果不存在 .planning/codebase/：跳过。

```bash
FIRST_TASK=$(git log --oneline --grep="feat({phase}-{plan}):" --grep="fix({phase}-{plan}):" --grep="test({phase}-{plan}):" --reverse | head -1 | cut -d' ' -f1)
git diff --name-only ${FIRST_TASK}^..HEAD 2>/dev/null || true
```

仅更新结构性变更：新的 src/ 目录 → STRUCTURE.md | 依赖 → STACK.md | 文件模式 → CONVENTIONS.md | API client → INTEGRATIONS.md | config → STACK.md | 重命名 → 更新路径。跳过纯代码/bugfix/内容变更。

```bash
gsd-sdk query commit "" .planning/codebase/*.md --amend
```
</step>

<step name="offer_next">
如果 `USER_SETUP_CREATED=true`：在顶部显示 `⚠️ USER SETUP REQUIRED`，并附路径及 env/config 任务。

```bash
(ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null || true) | wc -l
```

| Condition | Route | Action |
|-----------|-------|--------|
| summaries < plans | **A: More plans** | 找到下一个没有 SUMMARY 的 PLAN。Yolo：自动继续。Interactive：展示下一个计划，建议 `/gsd-execute-phase {phase}` + `/gsd-verify-work`。到此停止。 |
| summaries = plans, current < highest phase | **B: Phase done** | 显示已完成，建议 `/gsd-plan-phase {Z+1}` + `/gsd-verify-work {Z}` + `/gsd-discuss-phase {Z+1}` |
| summaries = plans, current = highest phase | **C: Milestone done** | 显示横幅，建议 `/gsd-complete-milestone` + `/gsd-verify-work` + `/gsd-add-phase` |

所有路线：先执行 `/clear` 以获得全新上下文。
</step>

</process>

<success_criteria>

- PLAN.md 中的所有任务均已完成
- 所有验证均通过
- 如果 frontmatter 中有 user_setup，则已生成 USER-SETUP.md
- 已创建包含实质内容的 SUMMARY.md
- 已更新 STATE.md（位置、决策、问题、会话）—— 除非为并行模式（由 orchestrator 处理）
- 已更新 ROADMAP.md —— 除非为并行模式（由 orchestrator 处理）
- 如果代码库映射存在：已用执行变更更新映射（或在无重大变更时跳过）
- 如果创建了 USER-SETUP.md：在完成输出中显著提示
</success_criteria>
