<purpose>
通过带量化歧义评分的苏格拉底式访谈循环，澄清一个 phase 交付的 WHAT。
产出 SPEC.md，包含可证伪的 requirements，供 discuss-phase 视为已锁定决策。

这个 workflow 负责 "what" 和 "why"，而 discuss-phase 负责 "how"。
</purpose>

<ambiguity_model>
每个维度从 0.0（完全不清楚）到 1.0（极其清晰）打分：

| Dimension         | Weight | Minimum | What it measures                                  |
|-------------------|--------|---------|---------------------------------------------------|
| Goal Clarity      | 35%    | 0.75    | 结果是否具体且可衡量？                             |
| Boundary Clarity  | 25%    | 0.70    | 范围内和范围外分别是什么？                         |
| Constraint Clarity| 20%    | 0.65    | 性能、兼容性、数据要求是否清楚？                   |
| Acceptance Criteria| 20%   | 0.70    | 如何判断完成？                                     |

**Ambiguity score** = 1.0 − (0.35×goal + 0.25×boundary + 0.20×constraint + 0.20×acceptance)

**Gate：** ambiguity ≤ 0.20 且所有维度都达到各自 minimum，才算可以写 SPEC.md。

0.20 的分数意味着加权清晰度达到 80%，精度足以让 planner 不会默默做出错误假设。
</ambiguity_model>

<interview_perspectives>
轮换使用这些视角，它们会自然暴露不同盲点：

**Researcher（第 1-2 轮）：** 让讨论建立在当前现实基础上。
- "What exists in the codebase today related to this phase?"
- "What's the delta between today and the target state?"
- "What triggers this work — what's broken or missing?"

**Simplifier（第 2 轮）：** 暴露最小可行范围。
- "What's the simplest version that solves the core problem?"
- "If you had to cut 50%, what's the irreducible core?"
- "What would make this phase a success even without the nice-to-haves?"

**Boundary Keeper（第 3 轮）：** 锁定边界。
- "What explicitly will NOT be done in this phase?"
- "What adjacent problems is it tempting to solve but shouldn't?"
- "What does 'done' look like — what's the final deliverable?"

**Failure Analyst（第 4 轮）：** 找出会使 requirements 失效的边界情况。
- "What's the worst thing that could go wrong if we get the requirements wrong?"
- "What does a broken version of this look like?"
- "What would cause a verifier to reject the output?"

**Seed Closer（第 5-6 轮）：** 锁定仍未决定的区域。
- "We have [dimension] at [score] — what would make it completely clear?"
- "The remaining ambiguity is in [area] — can we make a decision now?"
- "Is there anything you'd regret not specifying before planning starts?"
</interview_perspectives>

<process>

## Step 1: 初始化

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON：`phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `state_path`, `requirements_path`, `roadmap_path`, `planning_path`, `response_language`, `commit_docs`。

**如果设置了 `response_language`：** 本 workflow 中所有面向用户的文本都必须使用 `{response_language}`。技术术语、代码和文件路径保持英文。

**如果 `phase_found` 为 false：**
```
Phase [X] not found in roadmap.
Use /gsd-progress to see available phases.
```
退出。

**检查是否已有 SPEC.md：**
```bash
ls ${phase_dir}/*-SPEC.md 2>/dev/null | grep -v AI-SPEC | head -1 || true
```

如果 SPEC.md 已存在：

**如果传入 `--auto`：** 自动选择 "Update it"。记录：`[auto] SPEC.md exists — updating.`

**否则：** 使用 AskUserQuestion：
- header: "Spec"
- question: "Phase [X] already has a SPEC.md. What do you want to do?"
- options:
  - "Update it" — 修订并重新评分
  - "View it" — 显示当前 spec
  - "Skip" — 退出（保持现有 spec 不变）

如果选 "View"：显示 SPEC.md，然后再提供 Update/Skip。
如果选 "Skip"：退出并提示："Existing SPEC.md unchanged. Run /gsd-discuss-phase [X] to continue."
如果选 "Update"：加载现有 SPEC.md，继续 Step 3。

## Step 2: 侦察代码库

**在提问前先读取这些文件：**
- `{requirements_path}` — 项目 requirements
- `{state_path}` — 已做出的决策、当前 phase、阻塞项
- ROADMAP.md 对应 phase 条目 — phase 描述、目标、规范引用

**Grep 代码库**，查找与当前 phase 目标相关的代码/文件。关注：
- 类似功能的现有实现
- 新代码会接入的位置
- 与该 phase 相关的测试覆盖缺口
- 说明当前状态的前序 phase 产物（SUMMARY.md、VERIFICATION.md）

**综合当前状态**，作为访谈的落地基线：
- 当前和本 phase 相关的已有内容
- 当前状态与 phase 目标之间的差距
- 主要交付物：当前还不存在的文件/行为/能力是什么？

在内部确认你的当前状态综合结论。不要先展示给用户，后面用它来提出更精准、落地的问题。

## Step 3: 首次歧义评估

在开始提问前，仅根据 ROADMAP.md 和 REQUIREMENTS.md 对当前 phase 的歧义程度评分：

```
Goal Clarity:       [score 0.0–1.0]
Boundary Clarity:   [score 0.0–1.0]
Constraint Clarity: [score 0.0–1.0]
Acceptance Criteria:[score 0.0–1.0]

Ambiguity: [score] ([calculate])
```

**如果 `--auto` 且初始 ambiguity 已 ≤ 0.20，同时所有 minimum 达标：** 跳过访谈，直接基于 roadmap + requirements 生成 SPEC.md。记录：`[auto] Phase requirements are already sufficiently clear — generating SPEC.md from existing context.` 跳到 Step 6。

**否则：** 继续 Step 4。

## Step 4: 苏格拉底式访谈循环

**最多 6 轮。** 每轮最多 2-3 个问题。用户回复后结束该轮。

**按视角选择轮次：**
- 第 1 轮：Researcher
- 第 2 轮：Researcher + Simplifier
- 第 3 轮：Boundary Keeper
- 第 4 轮：Failure Analyst
- 第 5-6 轮：Seed Closer（聚焦最低分维度）

**每轮结束后：**
1. 根据用户回答更新 4 个维度的分数
2. 计算新的 ambiguity score
3. 展示更新后的评分：

```
After round [N]:
  Goal Clarity:       [score] (min 0.75) [✓ or ↑ needed]
  Boundary Clarity:   [score] (min 0.70) [✓ or ↑ needed]
  Constraint Clarity: [score] (min 0.65) [✓ or ↑ needed]
  Acceptance Criteria:[score] (min 0.70) [✓ or ↑ needed]
  Ambiguity: [score] (gate: ≤ 0.20)
```

**每轮后的 gate 检查：**

如果通过 gate（ambiguity ≤ 0.20 且所有 minimum 达标）：

**如果 `--auto`：** 跳到 Step 6。

**否则：** AskUserQuestion：
- header: "Spec Gate Passed"
- question: "Ambiguity is [score] — requirements are clear enough to write SPEC.md. Proceed?"
- options:
  - "Yes — write SPEC.md" → 跳到 Step 6
  - "One more round" → 继续访谈
  - "Done talking — write it" → 跳到 Step 6

**如果达到最大轮数（6）仍未过 gate：**

**如果 `--auto`：** 仍然写 SPEC.md，但标出未解决维度。记录：`[auto] Max rounds reached. Writing SPEC.md with [N] dimensions below minimum. Planner will need to treat these as assumptions.`

**否则：** AskUserQuestion：
- header: "Max Rounds"
- question: "After 6 rounds, ambiguity is [score]. [List dimensions still below minimum.] What would you like to do?"
- options:
  - "Write SPEC.md anyway — flag gaps" → 写 SPEC.md，并在 Ambiguity Report 中标记未解决维度
  - "Keep talking" → 继续（从这里开始不再限制轮数）
  - "Abandon" → 不写并退出

**如果全程使用 `--auto`：** 将上述所有 AskUserQuestion 替换为 Claude 推荐选项。内联记录决策。逻辑与 discuss-phase 中的 `--auto` 一致。

**文本模式（`workflow.text_mode: true` 或 `--text` flag）：** 用纯文本编号列表代替 AskUserQuestion TUI 菜单。

## Step 5:（已在上文覆盖，歧义评分按轮执行）

## Step 6: 生成 SPEC.md

使用 @~/.claude/get-shit-done/templates/spec.md 中的 SPEC.md 模板。

**每条 requirement 的要求：**
- 一条具体、可测试的陈述
- Current state（当前已存在什么）
- Target state（要变成什么）
- Acceptance criterion（如何验证已满足）

**拒绝模糊 requirement：**
- ✗ "The system should be fast"
- ✗ "Improve user experience"
- ✓ "API endpoint responds in < 200ms at p95 under 100 concurrent requests"
- ✓ "CLI command exits with code 1 and prints to stderr on invalid input"

**统计 requirement 数量。** discuss-phase 中会显示："Found SPEC.md — {N} requirements locked."

**边界必须是明确列表：**
- "In scope" — 本 phase 产出什么
- "Out of scope" — 明确不做什么（附简短原因）

**Acceptance criteria 必须是 pass/fail checkbox**，不能写成 "should feel good" 或 "looks reasonable"。

**如果有任何维度低于 minimum，** 在 Ambiguity Report 中标记：`⚠ Below minimum — planner must treat as assumption`

写入：`{phase_dir}/{padded_phase}-SPEC.md`

## Step 7: 提交

```bash
git add "${phase_dir}/${padded_phase}-SPEC.md"
git commit -m "spec(phase-${phase_number}): add SPEC.md for ${phase_name} — ${requirement_count} requirements (#2213)"
```

如果 `commit_docs` 为 false：跳过 commit，并说明 SPEC.md 已写入但未提交。

## Step 8: 收尾

显示：

```
SPEC.md written — {N} requirements locked.

  Phase {X}: {name}
  Ambiguity: {final_score} (gate: ≤ 0.20)

Next: /gsd-discuss-phase {X}
  discuss-phase will detect SPEC.md and focus on implementation decisions only.
```

</process>

<critical_rules>
- 每条 requirement 都必须包含 current state、target state 和 acceptance criterion
- Boundaries 部分是**必填项**，不能为空
- "In scope" 和 "Out of scope" 必须是明确列表，不能写成叙述性段落
- Acceptance criteria 必须是 pass/fail，不能是主观标准
- 如果用户选择 "Abandon"，绝不能写 SPEC.md
- 不要询问 HOW to implement，这属于 discuss-phase 的范围
- 第一个问题前必须先侦察代码库，只提有依据的问题
- 每轮最多 2-3 个问题，不要一次性把问题全抛出来
</critical_rules>

<success_criteria>
- 提问前已侦察代码库并理解当前状态
- 每轮后都为 4 个维度打分
- 已通过 gate，或用户明确选择带缺口也要写
- SPEC.md 只包含可证伪的 requirements
- 边界明确（in scope / out of scope，并带原因）
- acceptance criteria 为 pass/fail checkbox
- SPEC.md 原子提交（当 commit_docs 为 true 时）
- 已引导用户下一步使用 /gsd-discuss-phase
</success_criteria>
