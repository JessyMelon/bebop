<purpose>
跨 AI 计划收敛循环，自动化手动链路：
gsd-plan-phase N → gsd-review N --codex → gsd-plan-phase N --reviews → gsd-review N --codex → ...
每一步都在调用对应 Skill 的隔离 Agent 内运行。
Orchestrator 只负责：初始化、循环控制、HIGH 计数检查、停滞检测、升级处理。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 引用的所有文件。

@$HOME/.claude/get-shit-done/references/revision-loop.md
@$HOME/.claude/get-shit-done/references/gates.md
@$HOME/.claude/get-shit-done/references/agent-contracts.md
</required_reading>

<process>

## 1. 解析并规范化参数

从 $ARGUMENTS 中提取：阶段编号、reviewer flags（`--codex`、`--gemini`、`--claude`、`--opencode`、`--all`）、`--max-cycles N`、`--text`、`--ws`。

```bash
PHASE=$(echo "$ARGUMENTS" | grep -oE '[0-9]+\.?[0-9]*' | head -1)

REVIEWER_FLAGS=""
echo "$ARGUMENTS" | grep -q '\-\-codex' && REVIEWER_FLAGS="$REVIEWER_FLAGS --codex"
echo "$ARGUMENTS" | grep -q '\-\-gemini' && REVIEWER_FLAGS="$REVIEWER_FLAGS --gemini"
echo "$ARGUMENTS" | grep -q '\-\-claude' && REVIEWER_FLAGS="$REVIEWER_FLAGS --claude"
echo "$ARGUMENTS" | grep -q '\-\-opencode' && REVIEWER_FLAGS="$REVIEWER_FLAGS --opencode"
echo "$ARGUMENTS" | grep -q '\-\-all' && REVIEWER_FLAGS="$REVIEWER_FLAGS --all"
if [ -z "$REVIEWER_FLAGS" ]; then REVIEWER_FLAGS="--codex"; fi

MAX_CYCLES=$(echo "$ARGUMENTS" | grep -oE '\-\-max-cycles\s+[0-9]+' | awk '{print $2}')
if [ -z "$MAX_CYCLES" ]; then MAX_CYCLES=3; fi

GSD_WS=""
echo "$ARGUMENTS" | grep -qE '\-\-ws\s+\S+' && GSD_WS=$(echo "$ARGUMENTS" | grep -oE '\-\-ws\s+\S+')
```

## 2. 初始化

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，获取：`phase_dir`、`phase_number`、`padded_phase`、`phase_name`、`has_plans`、`plan_count`、`commit_docs`、`text_mode`、`response_language`。

**如果设置了 `response_language`：** 所有面向用户的输出都应使用 `{response_language}`。

如果 $ARGUMENTS 中存在 `--text`，或者 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 `TEXT_MODE` 激活时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并让用户输入所选编号。

## 3. 验证阶段 + 预检 Gate

```bash
PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
```

**如果 `found` 为 false：** 报错并显示可用阶段。退出。

显示启动横幅：

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLAN CONVERGENCE — Phase {phase_number}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Reviewers: {REVIEWER_FLAGS}
 Max cycles: {MAX_CYCLES}
```

## 4. 初始规划（如果尚无 plans）

**如果 `has_plans` 为 true：** 跳到步骤 5。显示：`Plans found: {plan_count} PLAN.md files — skipping initial planning.`

**如果 `has_plans` 为 false：**

显示：`◆ No plans found — spawning initial planning agent...`

```text
Agent(
  description="Initial planning Phase {PHASE}",
  prompt="Run /gsd-plan-phase for Phase {PHASE}.

Execute: Skill(skill='gsd-plan-phase', args='{PHASE} {GSD_WS}')

Complete the full planning workflow. Do NOT return until planning is complete and PLAN.md files are committed.",
  mode="auto"
)
```

Agent 返回后，验证是否已创建 plans：
```bash
PLAN_COUNT=$(ls ${phase_dir}/${padded_phase}-*-PLAN.md 2>/dev/null | wc -l)
```

如果 PLAN_COUNT == 0：报错，初始规划失败。退出。

显示：`Initial planning complete: ${PLAN_COUNT} PLAN.md files created.`

## 5. 收敛循环

初始化循环变量：

```text
cycle = 0
prev_high_count = Infinity
```

### 5a. Review（启动 Agent）

递增 `cycle`。

显示：`◆ Cycle {cycle}/{MAX_CYCLES} — spawning review agent...`

```text
Agent(
  description="Cross-AI review Phase {PHASE} cycle {cycle}",
  prompt="Run /gsd-review for Phase {PHASE}.

Execute: Skill(skill='gsd-review', args='--phase {PHASE} {REVIEWER_FLAGS} {GSD_WS}')

Complete the full review workflow. Do NOT return until REVIEWS.md is committed.",
  mode="auto"
)
```

Agent 返回后，验证 REVIEWS.md 是否存在：
```bash
REVIEWS_FILE=$(ls ${phase_dir}/${padded_phase}-REVIEWS.md 2>/dev/null)
```

如果 REVIEWS_FILE 为空：报错，review agent 未生成 REVIEWS.md。退出。

### 5b. 检查 HIGH 问题

```bash
HIGH_COUNT=$(grep -c '\*\*HIGH' "${REVIEWS_FILE}" 2>/dev/null || true)
HIGH_COUNT=${HIGH_COUNT:-0}
HIGH_LINES=$(grep -B0 -A1 '\*\*HIGH' "${REVIEWS_FILE}" 2>/dev/null)
```

**如果 HIGH_COUNT == 0（已收敛）：**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state planned-phase --phase "${PHASE}" --name "${phase_name}" --plans "${PLAN_COUNT}"
```

显示：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CONVERGENCE COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Phase {phase_number} converged in {cycle} cycle(s).
 No HIGH concerns remaining.

 REVIEWS.md: {REVIEWS_FILE}
 Next: /gsd-execute-phase {PHASE}
```

退出，已达成收敛。

**如果 HIGH_COUNT > 0：** 继续到 5c。

### 5c. 停滞检测 + 升级检查

显示：`◆ Cycle {cycle}/{MAX_CYCLES} — found {HIGH_COUNT} HIGH concerns`

**停滞检测：** 如果 `HIGH_COUNT >= prev_high_count`：
```text
⚠ Convergence stalled — HIGH concern count not decreasing
  ({HIGH_COUNT} HIGH concerns, previous cycle had {prev_high_count})
```

**最大循环次数检查：** 如果 `cycle >= MAX_CYCLES`：

如果 `TEXT_MODE` 为 true，则以纯文本编号列表展示：
```text
Plan convergence did not complete after {MAX_CYCLES} cycles.
{HIGH_COUNT} HIGH concerns remain:

{HIGH_LINES}

How would you like to proceed?

1. Proceed anyway — Accept plans with remaining HIGH concerns and move to execution
2. Manual review — Stop here, review REVIEWS.md and address concerns manually

Enter number:
```

否则使用 AskUserQuestion：
```js
AskUserQuestion([
  {
    question: "Plan convergence did not complete after {MAX_CYCLES} cycles. {HIGH_COUNT} HIGH concerns remain:\n\n{HIGH_LINES}\n\nHow would you like to proceed?",
    header: "Convergence",
    multiSelect: false,
    options: [
      { label: "Proceed anyway", description: "Accept plans with remaining HIGH concerns and move to execution" },
      { label: "Manual review", description: "Stop here — review REVIEWS.md and address concerns manually" }
    ]
  }
])
```

如果选择 "Proceed anyway"：显示最终状态并退出。
如果选择 "Manual review"：
```text
Review the concerns in: {REVIEWS_FILE}

To replan manually:  /gsd-plan-phase {PHASE} --reviews
To restart loop:     /gsd-plan-review-convergence {PHASE} {REVIEWER_FLAGS}
```
退出 workflow。

### 5d. Replan（启动 Agent）

**如果尚未达到最大循环次数：**

更新 `prev_high_count = HIGH_COUNT`。

显示：`◆ Spawning replan agent with review feedback...`

```text
Agent(
  description="Replan Phase {PHASE} with review feedback cycle {cycle}",
  prompt="Run /gsd-plan-phase with --reviews for Phase {PHASE}.

Execute: Skill(skill='gsd-plan-phase', args='{PHASE} --reviews --skip-research {GSD_WS}')

This will replan incorporating cross-AI review feedback from REVIEWS.md.
Do NOT return until replanning is complete and updated PLAN.md files are committed.

IMPORTANT: When gsd-plan-phase outputs '## PLANNING COMPLETE', that means replanning is done. Return at that point.",
  mode="auto"
)
```

Agent 返回后 → 回到 **step 5a**（再次 review）。

</process>

<success_criteria>
- [ ] 如果不存在 plans，则通过 Agent → Skill("gsd-plan-phase") 完成初始规划
- [ ] 通过 Agent → Skill("gsd-review") 完成 review，隔离执行，不内联
- [ ] 通过 Agent → Skill("gsd-plan-phase --reviews") 完成 replan，隔离执行，不内联
- [ ] Orchestrator 只负责：初始化、循环控制、grep HIGH、停滞检测、升级处理
- [ ] 每个 Agent 都会在返回前完整完成其 Skill
- [ ] 循环在以下情况退出：没有 HIGH concerns（已收敛）或达到最大循环次数（升级）
- [ ] 当 HIGH 计数未减少时报告停滞检测
- [ ] 收敛完成时更新 STATE.md
</success_criteria>
