<purpose>

以自治方式推进 milestone phases：可以执行所有剩余 phases、通过 `--from N`/`--to N` 执行一段范围，或通过 `--only N` 只执行单个 phase。对每个未完成 phase：用 Skill() 的扁平调用依次进行 discuss → plan → execute。仅在需要用户明确决策时暂停（灰区接受、blockers、validation 请求）。每完成一个 phase 后重新读取 ROADMAP.md，以捕捉动态插入的 phases。

</purpose>

<required_reading>

开始前，读取调用 prompt 的 execution_context 中引用的所有文件。

</required_reading>

<process>

<step name="initialize" priority="first">

## 1. 初始化

解析 `$ARGUMENTS`，提取 `--from N`、`--to N`、`--only N` 和 `--interactive` flags：

```bash
FROM_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-from\s+[0-9]'; then
  FROM_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-from\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi

TO_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-to\s+[0-9]'; then
  TO_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-to\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi

ONLY_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-only\s+[0-9]'; then
  ONLY_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-only\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
  FROM_PHASE="$ONLY_PHASE"
fi

INTERACTIVE=""
if echo "$ARGUMENTS" | grep -q '\-\-interactive'; then
  INTERACTIVE="true"
fi
```

设置了 `--only` 时，同时把 `FROM_PHASE` 设为相同值，以复用现有过滤逻辑。

设置了 `--interactive` 时，discuss 会在当前上下文中内联运行并向用户提问（不自动代答），而 plan 和 execute 会作为后台 agents 派发。这样主上下文只累积 discuss 对话，更轻量，同时仍保留用户对所有设计决策的输入。

通过 milestone 级 init 完成 bootstrap：

```bash
INIT=$(gsd-sdk query init.milestone-op)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，提取：`milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `roadmap_exists`, `state_exists`, `commit_docs`。

**如果 `roadmap_exists` 为 false：** 报错："No ROADMAP.md found. Run `/gsd-new-milestone` first."
**如果 `state_exists` 为 false：** 报错："No STATE.md found. Run `/gsd-new-milestone` first."

显示启动横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} — {milestone_name}
 Phases: {phase_count} total, {completed_phases} complete
```

如果设置了 `ONLY_PHASE`，显示：`Single phase mode: Phase ${ONLY_PHASE}`
否则如果设置了 `FROM_PHASE`，显示：`Starting from phase ${FROM_PHASE}`
如果设置了 `TO_PHASE`，显示：`Stopping after phase ${TO_PHASE}`
如果设置了 `INTERACTIVE`，显示：`Mode: Interactive (discuss inline, plan+execute in background)`

</step>

<step name="discover_phases">

## 2. 发现 Phases

执行 phase 发现：

```bash
ROADMAP=$(gsd-sdk query roadmap.analyze)
```

解析 JSON `phases` 数组。

**过滤出未完成 phases：** 仅保留 `disk_status !== "complete"` 或 `roadmap_complete === false` 的 phases。

**应用 `--from N` 过滤：** 如果提供了 `FROM_PHASE`，进一步过滤掉 `number < FROM_PHASE` 的 phases（使用数值比较，支持像 "5.1" 这样的 decimal phases）。

**应用 `--to N` 过滤：** 如果提供了 `TO_PHASE`，进一步过滤掉 `number > TO_PHASE` 的 phases（使用数值比较）。这会把执行范围限制在目标 phase 及之前。

**应用 `--only N` 过滤：** 如果提供了 `ONLY_PHASE`，进一步过滤掉 `number != ONLY_PHASE` 的 phases。这样 phase 列表最终只会包含一个 phase（或零个，如果已完成）。

**如果设置了 `TO_PHASE` 且没有剩余 phases**（直到 N 的 phases 都已完成）：

```
All phases through ${TO_PHASE} are already completed. Nothing to do.
```

干净退出。

**如果设置了 `ONLY_PHASE` 且没有剩余 phases**（该 phase 已完成）：

```
Phase ${ONLY_PHASE} is already complete. Nothing to do.
```

干净退出。

**按 `number` 数值升序排序**。

**如果没有剩余未完成 phases：**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases complete! Nothing left to do.
```

干净退出。

**展示 phase 计划：**

```
## Phase Plan

| # | Phase | Status |
|---|-------|--------|
| 5 | Skill Scaffolding & Phase Discovery | In Progress |
| 6 | Smart Discuss | Not Started |
| 7 | Auto-Chain Refinements | Not Started |
| 8 | Lifecycle Orchestration | Not Started |
```

**获取每个 phase 的详情：**

```bash
DETAIL=$(gsd-sdk query roadmap.get-phase ${PHASE_NUM})
```

提取每个 phase 的 `phase_name`、`goal`、`success_criteria`。存起来供 execute_phase 和过渡消息使用。

</step>

<step name="execute_phase">

## 3. 执行 Phase

针对当前 phase，显示进度横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ Phase {N}/{T}: {Name} [████░░░░] {P}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

其中 N = 当前 phase 编号（来自 ROADMAP，例如 63），T = 当前 milestone 的 phase 总数（来自 initialize 步骤中解析出的 `phase_count`，例如 67）。**重要：** T 必须是 `phase_count`（当前 milestone 的全部 phase 总数），而不是剩余/未完成 phases 的数量。当 phase 编号为 61-67 时，T=7，横幅应显示 `Phase 63/7`（phase 63，milestone 共 7 个），而不是 `Phase 63/3`（会把剩余 3 个误解为总数）。P = 当前 milestone 中已完成 phases 的百分比。计算方式：最近一次 `roadmap analyze` 里 `disk_status` 为 "complete" 的 phase 数量 / T × 100。进度条使用 █ 表示已完成段，░ 表示未完成段，总宽 8 个字符。

**当 phase 编号大于总数时的备用显示**（例如多 milestone 项目中 phase 编号是全局递增）：如果 N > T，改用 `Phase {N} ({position}/{T})` 格式，其中 `position` 是当前 phase 在待处理未完成 phases 中的 1-based 索引。这样能避免像 "Phase 63/5" 这种容易误解的显示。

**3a. Smart Discuss**

检查该 phase 是否已存在 CONTEXT.md：

```bash
PHASE_STATE=$(gsd-sdk query init.phase-op ${PHASE_NUM})
```

从 JSON 中解析 `has_context`。

**如果 has_context 为 true：** 跳过 discuss，说明上下文已收集。显示：

```
Phase ${PHASE_NUM}: Context exists — skipping discuss.
```

继续到 3b。

**如果 has_context 为 false：** 检查 settings 中是否禁用 discuss：

```bash
SKIP_DISCUSS=$(gsd-sdk query config-get workflow.skip_discuss 2>/dev/null || echo "false")
```

**如果 `SKIP_DISCUSS` 为 `true`：** 完全跳过 discuss，此时 ROADMAP 中的 phase 描述就是 spec。显示：

```
Phase ${PHASE_NUM}: Discuss skipped (workflow.skip_discuss=true) — using ROADMAP phase goal as spec.
```

写入一个最小 CONTEXT.md，保证下游 plan-phase 有有效输入。先取 phase 详情：

```bash
DETAIL=$(gsd-sdk query roadmap.get-phase ${PHASE_NUM})
```

从 JSON 提取 `goal` 和 `requirements`。写入 `${phase_dir}/${padded_phase}-CONTEXT.md`：

```markdown
# Phase {PHASE_NUM}: {Phase Name} - Context

**Gathered:** {date}
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

{goal from ROADMAP phase description}

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
```

提交这个最小 context：

```bash
gsd-sdk query commit "docs(${PADDED_PHASE}): auto-generated context (discuss skipped)" "${phase_dir}/${padded_phase}-CONTEXT.md"
```

继续到 3b。

**如果 `SKIP_DISCUSS` 为 `false`（或未设置）：**

**重要：自治模式下 discuss 必须单次完成。**
`--auto` 模式下的 discuss 步骤**不得循环**。如果 discuss 完成后 CONTEXT.md 已存在，就**不要**为同一 phase 再次调用 discuss。下面的 `has_context` 检查是最终判断标准；一旦为 true，无论上下文文件看起来是否仍有“空白”，都视为该 phase 的 discuss 已完成。

**如果设置了 `INTERACTIVE`：** 在当前上下文中内联运行标准 discuss-phase skill（会提出交互问题并等待用户回答）。这样能保留用户对所有设计决策的输入，同时把 plan+execute 留在主上下文之外：

```
Skill(skill="gsd:discuss-phase", args="${PHASE_NUM}")
```

**如果未设置 `INTERACTIVE`：** 对该 phase 执行 smart_discuss 步骤（批量表格提案、自动优化）。

无论哪种方式，discuss 完成后都要验证 context 已写入：

```bash
PHASE_STATE=$(gsd-sdk query init.phase-op ${PHASE_NUM})
```

检查 `has_context`。如果为 false → 转到 handle_blocker："Discuss for phase ${PHASE_NUM} did not produce CONTEXT.md."

**3a.5. UI Design Contract（Frontend Phases）**

检查该 phase 是否有 frontend 指示词，以及是否已存在 UI-SPEC：

```bash
PHASE_SECTION=$(gsd-sdk query roadmap.get-phase ${PHASE_NUM} 2>/dev/null)
echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget" > /dev/null 2>&1
HAS_UI=$?
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

检查是否启用 UI phase workflow：

```bash
UI_PHASE_CFG=$(gsd-sdk query config-get workflow.ui_phase 2>/dev/null || echo "true")
```

**如果 `HAS_UI` 为 0（检测到 frontend 指示词）且 `UI_SPEC_FILE` 为空（不存在 UI-SPEC）且 `UI_PHASE_CFG` 不为 `false`：**

显示：

```
Phase ${PHASE_NUM}: Frontend phase detected — generating UI design contract...
```

```
Skill(skill="gsd-ui-phase", args="${PHASE_NUM}")
```

验证 UI-SPEC 已创建：

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

**如果 `UI_SPEC_FILE` 在 ui-phase 之后仍为空：** 显示警告 `Phase ${PHASE_NUM}: UI-SPEC generation did not produce output — continuing without design contract.`，然后继续到 3b。

**如果 `HAS_UI` 为 1（未检测到 frontend 指示词）或 `UI_SPEC_FILE` 不为空（UI-SPEC 已存在）或 `UI_PHASE_CFG` 为 `false`：** 静默跳过，继续到 3b。

**3b. Plan**

**如果设置了 `INTERACTIVE`：** 将 plan 作为后台 agent 派发，保持主上下文精简。plan 运行时，workflow 可立即开始讨论下一个 phase（见第 4 步）。

```
Agent(
  description="Plan phase ${PHASE_NUM}: ${PHASE_NAME}",
  run_in_background=true,
  prompt="Run plan-phase for phase ${PHASE_NUM}: Skill(skill=\"gsd:plan-phase\", args=\"${PHASE_NUM}\")"
)
```

保存 agent 的 task_id。下一个 phase 的 discuss 完成后（或没有下一个 phase 时），在进入 execute 前等待 plan agent 完成。

**如果未设置 `INTERACTIVE`（默认）：** 和以前一样，内联运行 plan。

```
Skill(skill="gsd-plan-phase", args="${PHASE_NUM}")
```

验证 plan 已产出内容：重新运行 `init phase-op` 并检查 `has_plans`。如果为 false → 转到 handle_blocker："Plan phase ${PHASE_NUM} did not produce any plans."

**3c. Execute**

**如果设置了 `INTERACTIVE`：** 等待 plan agent 完成（如果还没完成），确认 plans 存在，然后把 execute 作为后台 agent 派发：

```
Agent(
  description="Execute phase ${PHASE_NUM}: ${PHASE_NAME}",
  run_in_background=true,
  prompt="Run execute-phase for phase ${PHASE_NUM}: Skill(skill=\"gsd:execute-phase\", args=\"${PHASE_NUM} --no-transition\")"
)
```

保存 agent 的 task_id。此时 workflow 可以开始讨论下一个 phase，同时当前 phase 在后台执行。在进入该 phase 的 post-execution 路由前，先等待 execute agent 完成。

**如果未设置 `INTERACTIVE`（默认）：** 和以前一样，内联运行 execute。

```
Skill(skill="gsd-execute-phase", args="${PHASE_NUM} --no-transition")
```

**3c.5. Code Review and Fix**

自动调用 code review 与 fix 链。autonomous mode 会把 review 和 fix 都串起来（不同于 execute-phase/quick，它们只会建议 fix）。

**配置开关：**
```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```
如果为 `"false"`：显示 "Code review skipped (workflow.code_review=false)"，然后继续到 3d。

```
Skill(skill="gsd:code-review", args="${PHASE_NUM}")
```

从 REVIEW.md frontmatter 解析状态。如果是 "clean" 或 "skipped"：继续到 3d。如果发现 findings，则自动调用：
```
Skill(skill="gsd:code-review-fix", args="${PHASE_NUM} --auto")
```

**错误处理：** 如果任一 Skill 失败，捕获错误，按非阻塞方式展示，然后继续到 3d。

**3d. Post-Execution Routing**

**如果设置了 `INTERACTIVE`：** 在读取验证结果前，先等待 execute agent 完成。

在 execute-phase 返回后（或 execute agent 完成后），读取验证结果：

```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

这里的 `PHASE_DIR` 来自 step 3a 中已调用过的 `init phase-op`。如果变量不在当前作用域，重新获取：

```bash
PHASE_STATE=$(gsd-sdk query init.phase-op ${PHASE_NUM})
```

从 JSON 中解析 `phase_dir`。

**如果 `VERIFY_STATUS` 为空**（没有 VERIFICATION.md 或没有 status 字段）：

转到 handle_blocker："Execute phase ${PHASE_NUM} did not produce verification results."

**如果为 `passed`：**

显示：
```
Phase ${PHASE_NUM} ✅ ${PHASE_NAME} — Verification passed
```

继续到 iterate 步骤。

**如果为 `human_needed`：**

读取 VERIFICATION.md 中的 human_verification 小节，获取需要人工测试的条目和数量。


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。
先展示条目，然后通过 AskUserQuestion 向用户提问：
- **question:** "Phase ${PHASE_NUM} has items needing manual verification. Validate now or continue to next phase?"
- **options:** "Validate now" / "Continue without validation"

当选择 **"Validate now"**：展示 VERIFICATION.md 的 human_verification 小节中的具体条目。用户查看后再问：
- **question:** "Validation result?"
- **options:** "All good — continue" / "Found issues"

当选择 "All good — continue"：显示 `Phase ${PHASE_NUM} ✅ Human validation passed`，然后继续到 iterate 步骤。

当选择 "Found issues"：将用户报告的问题作为描述，转到 handle_blocker。

当选择 **"Continue without validation"**：显示 `Phase ${PHASE_NUM} ⏭ Human validation deferred`，然后继续到 iterate 步骤。

**如果为 `gaps_found`：**

从 VERIFICATION.md 读取 gap 摘要（分数与缺失项）。显示：
```
⚠ Phase ${PHASE_NUM}: ${PHASE_NAME} — Gaps Found
Score: {N}/{M} must-haves verified
```

通过 AskUserQuestion 询问用户：
- **question:** "Gaps found in phase ${PHASE_NUM}. How to proceed?"
- **options:** "Run gap closure" / "Continue without fixing" / "Stop autonomous mode"

当选择 **"Run gap closure"**：执行 gap closure 循环（上限：1 次）：

```
Skill(skill="gsd-plan-phase", args="${PHASE_NUM} --gaps")
```

验证 gap plans 已创建：重新运行 `init phase-op ${PHASE_NUM}` 并检查 `has_plans`。如果没有新的 gap plans → 转到 handle_blocker："Gap closure planning for phase ${PHASE_NUM} did not produce plans."

重新执行：
```
Skill(skill="gsd-execute-phase", args="${PHASE_NUM} --no-transition")
```

重新读取验证状态：
```bash
VERIFY_STATUS=$(grep "^status:" "${PHASE_DIR}"/*-VERIFICATION.md 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

如果为 `passed` 或 `human_needed`：按前述常规路由处理（继续或询问用户）。

如果本次重试后仍是 `gaps_found`：显示 "Gaps persist after closure attempt."，并通过 AskUserQuestion 询问：
- **question:** "Gap closure did not fully resolve issues. How to proceed?"
- **options:** "Continue anyway" / "Stop autonomous mode"

当选择 "Continue anyway"：继续到 iterate 步骤。
当选择 "Stop autonomous mode"：转到 handle_blocker。

这样把 gap closure 限制为 1 次自动重试，避免无限循环。

当选择 **"Continue without fixing"**：显示 `Phase ${PHASE_NUM} ⏭ Gaps deferred`，然后继续到 iterate 步骤。

当选择 **"Stop autonomous mode"**：用 "User stopped — gaps remain in phase ${PHASE_NUM}" 转到 handle_blocker。

**3d.5. UI Review（Frontend Phases）**

> 任何执行成功的路由之后都要运行（passed、接受 human_needed、或 deferred/accepted gaps），且在进入 iterate 步骤前执行。

检查该 phase 是否有 UI-SPEC（在 step 3a.5 创建或原本已存在）：

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

检查是否启用 UI review：

```bash
UI_REVIEW_CFG=$(gsd-sdk query config-get workflow.ui_review 2>/dev/null || echo "true")
```

**如果 `UI_SPEC_FILE` 不为空且 `UI_REVIEW_CFG` 不为 `false`：**

显示：

```
Phase ${PHASE_NUM}: Frontend phase with UI-SPEC — running UI review audit...
```

```
Skill(skill="gsd-ui-review", args="${PHASE_NUM}")
```

展示 review 结果摘要（如果生成了 UI-REVIEW.md，则取其中 score）。无论分数如何，都继续到 iterate 步骤，因为 UI review 仅提供建议，不阻塞流程。

**如果 `UI_SPEC_FILE` 为空或 `UI_REVIEW_CFG` 为 `false`：** 静默跳过，直接进入 iterate 步骤。

</step>

<step name="smart_discuss">

## Smart Discuss

> 完整说明位于 `get-shit-done/references/autonomous-smart-discuss.md`。现在读取该文件并严格按其执行。

Smart discuss 是为 autonomous 优化的 `gsd-discuss-phase` 变体。它会用批量表格提出灰区答案，用户可按 area 接受或覆盖；最终写出的 CONTEXT.md 与 discuss-phase 产物完全一致。

**输入：** 来自 execute_phase 的 `PHASE_NUM`。

读取并执行：`$HOME/.claude/get-shit-done/references/autonomous-smart-discuss.md`

</step>

<step name="iterate">

## 4. 迭代

**如果设置了 `ONLY_PHASE`：** 不进行迭代。直接进入 lifecycle 步骤（在那里会按单 phase 模式干净退出）。

**如果设置了 `TO_PHASE` 且当前 phase 编号 >= `TO_PHASE`：** 说明目标 phase 已到达。不再继续迭代。显示：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ --to ${TO_PHASE} REACHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Completed through phase ${TO_PHASE} as requested.
 Remaining phases were not executed.

 Resume with: /gsd-autonomous --from ${next_incomplete_phase}
```

直接进入 lifecycle 步骤（它会处理部分完成状态，不会执行 audit/complete/cleanup，因为并非所有 phases 都完成了）。随后干净退出。

**否则：** 每个 phase 完成后，重新读取 ROADMAP.md，以捕捉执行中途插入的 phases（如 5.1 这种 decimal phases）：

```bash
ROADMAP=$(gsd-sdk query roadmap.analyze)
```

按 discover_phases 中相同的逻辑重新过滤未完成 phases：
- 保留 `disk_status !== "complete"` 或 `roadmap_complete === false` 的 phases
- 如果最初提供了 `--from N`，则应用 `--from N` 过滤
- 如果最初提供了 `--to N`，则应用 `--to N` 过滤
- 按 number 升序排序

重新读取 STATE.md：

```bash
cat .planning/STATE.md
```

检查 Blockers/Concerns 小节是否有 blockers。如果发现 blockers，则带着 blocker 描述转到 handle_blocker。

如果仍有未完成 phases：继续下一个 phase，回到 execute_phase。

**Interactive mode 的并行重叠：** 设置了 `INTERACTIVE` 时，iterate 步骤会启用流水线并行：
1. Phase N 的 discuss 完成后，把 plan+execute 派发到后台 agents
2. 立即开始讨论 Phase N+1（下一个未完成 phase），同时让 Phase N 在后台构建
3. 在开始为 Phase N+1 做 plan 之前，先等待 Phase N 的 execute agent 完成，并处理其 post-execution 路由（verification、gap closure 等）

这样用户始终只在回答 discuss 问题（轻量、交互式），而重活（planning、代码生成）在后台运行。主上下文只积累 discuss 对话，因此更轻量。

如果所有 phases 都完成，则进入 lifecycle 步骤。

</step>

<step name="lifecycle">

## 5. 生命周期

**如果设置了 `ONLY_PHASE`：** 跳过 lifecycle。单个 phase 不会触发 audit/complete/cleanup。显示：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ PHASE ${ONLY_PHASE} COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phase ${ONLY_PHASE}: ${PHASE_NAME} — Done
 Mode: Single phase (--only)

 Lifecycle skipped — run /gsd-autonomous without --only
 after all phases complete to trigger audit/complete/cleanup.
```

干净退出。

**否则：** 当所有 phases 都完成后，执行 milestone 生命周期序列：audit → complete → cleanup。

显示生命周期切换横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ LIFECYCLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases complete → Starting lifecycle: audit → complete → cleanup
 Milestone: {milestone_version} — {milestone_name}
```

**5a. Audit**

```
Skill(skill="gsd-audit-milestone")
```

Audit 完成后，检测结果：

```bash
AUDIT_FILE=".planning/v${milestone_version}-MILESTONE-AUDIT.md"
AUDIT_STATUS=$(grep "^status:" "${AUDIT_FILE}" 2>/dev/null | head -1 | cut -d: -f2 | tr -d ' ')
```

**如果 AUDIT_STATUS 为空**（没有 audit file 或没有 status 字段）：

转到 handle_blocker："Audit did not produce results — audit file missing or malformed."

**如果为 `passed`：**

显示：
```
Audit ✅ passed — proceeding to complete milestone
```

继续到 5b（不暂停等待用户，符合 CTRL-01）。

**如果为 `gaps_found`：**

读取 audit file 中的 gaps 摘要。显示：
```
⚠ Audit: Gaps Found
```

通过 AskUserQuestion 询问用户：
- **question:** "Milestone audit found gaps. How to proceed?"
- **options:** "Continue anyway — accept gaps" / "Stop — fix gaps manually"

当选择 **"Continue anyway"**：显示 `Audit ⏭ Gaps accepted — proceeding to complete milestone`，然后继续到 5b。

当选择 **"Stop"**：转到 handle_blocker，提示为 "User stopped — audit gaps remain. Run /gsd-audit-milestone to review, then /gsd-complete-milestone when ready."

**如果为 `tech_debt`：**

读取 audit file 中的 tech debt 摘要。显示：
```
⚠ Audit: Tech Debt Identified
```

展示摘要，然后通过 AskUserQuestion 询问用户：
- **question:** "Milestone audit found tech debt. How to proceed?"
- **options:** "Continue with tech debt" / "Stop — address debt first"

当选择 **"Continue with tech debt"**：显示 `Audit ⏭ Tech debt acknowledged — proceeding to complete milestone`，然后继续到 5b。

当选择 **"Stop"**：转到 handle_blocker，提示为 "User stopped — tech debt to address. Run /gsd-audit-milestone to review details."

**5b. Complete Milestone**

```
Skill(skill="gsd-complete-milestone", args="${milestone_version}")
```

complete-milestone 返回后，验证其是否产出结果：

```bash
ls .planning/milestones/v${milestone_version}-ROADMAP.md 2>/dev/null || true
```

如果 archive file 不存在，则转到 handle_blocker："Complete milestone did not produce expected archive files."

**5c. Cleanup**

```
Skill(skill="gsd-cleanup")
```

Cleanup 会自行展示 dry-run，并在内部向用户请求确认。这种暂停是允许的，符合 CTRL-01，因为它是关于文件删除的明确决策。

**5d. 最终完成**

显示最终完成横幅：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} — {milestone_name}
 Status: Complete ✅
 Lifecycle: audit ✅ → complete ✅ → cleanup ✅

 Ship it! 🚀
```

</step>

<step name="handle_blocker">

## 6. 处理 Blocker

当任意 phase 操作失败或检测到 blocker 时，通过 AskUserQuestion 提供 3 个选项：

**Prompt：** "Phase {N} ({Name}) encountered an issue: {description}"

**Options：**
1. **"Fix and retry"** — 重新运行该 phase 失败的步骤（discuss、plan 或 execute）
2. **"Skip this phase"** — 将该 phase 标记为 skipped，并继续下一个未完成 phase
3. **"Stop autonomous mode"** — 展示当前进度摘要并干净退出

**当选择 "Fix and retry"：** 回到 execute_phase 中失败的那个步骤继续。如果重试后同一步骤再次失败，再次展示这些选项。

**当选择 "Skip this phase"：** 记录 `Phase {N} ⏭ {Name} — Skipped by user`，然后继续到 iterate。

**当选择 "Stop autonomous mode"：** 展示进度摘要：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ STOPPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Completed: {list of completed phases}
 Skipped: {list of skipped phases}
 Remaining: {list of remaining phases}

 Resume with: /gsd-autonomous ${ONLY_PHASE ? "--only " + ONLY_PHASE : "--from " + next_phase}${TO_PHASE ? " --to " + TO_PHASE : ""}
```

</step>

</process>

<success_criteria>
- [ ] 所有未完成 phases 均按顺序执行（每个都经过 smart discuss → ui-phase → plan → execute → ui-review）
- [ ] Smart discuss 以表格形式批量提出灰区答案，用户可按 area 接受或覆盖
- [ ] 各 phase 之间会显示进度横幅
- [ ] execute-phase 以 --no-transition 调用（transition 由 autonomous 管理）
- [ ] 执行后会读取 VERIFICATION.md，并按 status 路由
- [ ] passed 验证后会自动继续到下一个 phase
- [ ] human-needed 验证时会提示用户选择验证或跳过
- [ ] gaps-found 时会向用户提供 gap closure、继续或停止选项
- [ ] gap closure 最多自动重试 1 次（避免无限循环）
- [ ] plan-phase 和 execute-phase 失败时会路由到 handle_blocker
- [ ] 每个 phase 后都会重新读取 ROADMAP.md（捕捉插入的 phases）
- [ ] 每个 phase 前都会检查 STATE.md 中的 blockers
- [ ] blockers 通过用户选择处理（retry / skip / stop）
- [ ] 最终会显示完成或停止摘要
- [ ] 所有 phases 完成后，会调用 lifecycle 步骤（而不是只给手动建议）
- [ ] 在 audit 前会显示 lifecycle transition 横幅
- [ ] 通过 Skill(skill="gsd-audit-milestone") 调用 audit
- [ ] Audit 结果路由：passed → 自动继续，gaps_found → 用户决定，tech_debt → 用户决定
- [ ] Audit 技术失败（无文件/无状态）会路由到 handle_blocker
- [ ] 通过带 `${milestone_version}` 参数的 Skill() 调用 complete-milestone
- [ ] 通过 Skill() 调用 cleanup，允许其内部确认（CTRL-01）
- [ ] lifecycle 完成后会显示最终完成横幅
- [ ] 进度条使用 phase 编号 / milestone 总 phase 数（不是未完成位置），且在 phase 编号超过总数时有备用显示
- [ ] Smart discuss 会通过 CTRL-03 说明其与 discuss-phase 的关系
- [ ] Frontend phases 若尚无 UI-SPEC，会在 planning 前生成（step 3a.5）
- [ ] Frontend phases 若存在 UI-SPEC，会在成功执行后运行 UI review audit（step 3d.5）
- [ ] UI phase 和 UI review 都遵守 `workflow.ui_phase` 与 `workflow.ui_review` 配置开关
- [ ] UI review 为建议性（不阻塞），无论分数如何 phase 都会继续到 iterate
- [ ] `--only N` 将执行严格限制为单个 phase
- [ ] `--only N` 会跳过 lifecycle 步骤（audit/complete/cleanup）
- [ ] `--only N` 在单个 phase 完成后干净退出
- [ ] 对已完成 phase 使用 `--only N` 时，会直接提示并退出
- [ ] `--only N` 的 handle_blocker resume message 会使用 --only flag
- [ ] `--to N` 会在 phase N 完成后停止执行（在 iterate 步骤停下）
- [ ] `--to N` 在发现阶段会过滤掉编号大于 N 的 phases
- [ ] `--to N` 会在启动横幅中显示 "Stopping after phase N"
- [ ] 对已完成目标使用 `--to N` 时，会以 "already completed" message 退出
- [ ] `--to N` 可与 `--from N` 兼容（执行从 M 到 N 的 phases）
- [ ] `--to N` 的 handle_blocker resume message 会保留 --to flag
- [ ] 当并非所有 milestone phases 都完成时，`--to N` 会跳过 lifecycle
- [ ] `--interactive` 会通过 gsd:discuss-phase 内联运行 discuss（提问并等待用户）
- [ ] `--interactive` 会把 plan 和 execute 派发为后台 agents（上下文隔离）
- [ ] `--interactive` 支持流水线并行：Phase N 构建时讨论 Phase N+1
- [ ] `--interactive` 的主上下文只累积 discuss 对话（保持轻量）
- [ ] `--interactive` 会在 post-execution 路由前等待后台 agents 完成
- [ ] `--interactive` 与 `--only`、`--from`、`--to` flags 兼容
</success_criteria>
