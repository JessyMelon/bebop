<purpose>
检查项目进度，汇总近期工作和接下来的事项，然后智能路由到下一步操作：要么执行现有计划，要么创建下一份计划。在继续工作前提供态势感知。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="init_context">
**加载进度上下文（仅路径）：**

```bash
INIT=$(gsd-sdk query init.progress)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 中提取：`project_exists`, `roadmap_exists`, `state_exists`, `phases`, `current_phase`, `next_phase`, `milestone_version`, `completed_count`, `phase_count`, `paused_at`, `state_path`, `roadmap_path`, `project_path`, `config_path`。

```bash
DISCUSS_MODE=$(gsd-sdk query config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

如果 `project_exists` 为 false（不存在 `.planning/` 目录）：

```
No planning structure found.

Run /gsd-new-project to start a new project.
```

退出。

如果缺少 STATE.md：建议使用 `/gsd-new-project`。

**如果缺少 ROADMAP.md 但存在 PROJECT.md：**

这表示一个 milestone 已完成并归档。转到 **Route F**（milestones 之间）。

如果 ROADMAP.md 和 PROJECT.md 都缺失：建议使用 `/gsd-new-project`。
</step>

<step name="load">
**使用 `gsd-sdk query` 的结构化提取（或旧版 gsd-tools.cjs）：**

不要读取完整文件，而是使用定向工具仅获取报告所需的数据：
- `ROADMAP=$(gsd-sdk query roadmap.analyze)`
- `STATE=$(gsd-sdk query state-snapshot)`

这样可以尽量减少 orchestrator 的上下文占用。
</step>

<step name="analyze_roadmap">
**获取完整的 roadmap 分析（替代手动解析）：**

```bash
ROADMAP=$(gsd-sdk query roadmap.analyze)
```

这会返回结构化 JSON，包含：
- 所有 phase 及其磁盘状态（complete/partial/planned/empty/no_directory）
- 每个 phase 的 goal 和 dependencies
- 每个 phase 的 plan 和 summary 数量
- 聚合统计：总 plans、summaries、progress percent
- 当前和下一 phase 的识别结果

使用它，而不是手动读取/解析 ROADMAP.md。
</step>

<step name="recent">
**收集近期工作上下文：**

- 找到最近的 2-3 个 SUMMARY.md 文件
- 使用 `summary-extract` 进行高效解析：
  ```bash
  gsd-sdk query summary-extract <path> --fields one_liner
  ```
- 这会展示“我们最近在做什么”
  </step>

<step name="position">
**从 init context 和 roadmap analysis 解析当前位置：**

- 使用 `$ROADMAP` 中的 `current_phase` 和 `next_phase`
- 如果工作曾暂停，记录 `paused_at`（来自 `$STATE`）
- 统计待办 todos：使用 `init todos` 或 `list-todos`
- 检查活跃的 debug sessions：`(ls .planning/debug/*.md 2>/dev/null || true) | grep -v resolved | wc -l`
  </step>

<step name="report">
**根据 `gsd-sdk query progress` / `progress.json` 生成进度条，然后展示详细状态报告：**

```bash
# Get formatted progress bar
PROGRESS_BAR=$(gsd-sdk query progress.bar --raw)
```

展示：

```
# [Project Name]

**Progress:** {PROGRESS_BAR}
**Profile:** [quality/balanced/budget/inherit]
**Discuss mode:** {DISCUSS_MODE}

## Recent Work
- [Phase X, Plan Y]: [完成了什么 - 来自 summary-extract 的 1 行]
- [Phase X, Plan Z]: [完成了什么 - 来自 summary-extract 的 1 行]

## Current Position
Phase [N] of [total]: [phase-name]
Plan [M] of [phase-total]: [status]
CONTEXT: [✓ if has_context | - if not]

## Key Decisions Made
- [从 $STATE.decisions[] 提取]
- [例如从 state-snapshot 使用 jq -r '.decisions[].decision']

## Blockers/Concerns
- [从 $STATE.blockers[] 提取]
- [例如从 state-snapshot 使用 jq -r '.blockers[].text']

## Pending Todos
- [count] pending — /gsd-check-todos to review

## Active Debug Sessions
- [count] active — /gsd-debug to continue
(仅当 count > 0 时显示此部分)

## What's Next
[来自 roadmap analyze 的下一 phase/plan 目标]
```

</step>

<step name="route">
**根据已核实的计数决定下一步操作。**

**第 1 步：统计当前 phase 中的 plans、summaries 和 issues**

列出当前 phase 目录中的文件：

```bash
(ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null || true) | wc -l
(ls -1 .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null || true) | wc -l
```

说明："This phase has {X} plans, {Y} summaries."

**第 1.5 步：检查未处理的 UAT gaps**

检查 status 为 "diagnosed" 的 UAT.md 文件（表示存在需要修复的 gaps）。

```bash
# Check for diagnosed UAT with gaps or partial (incomplete) testing
grep -l "status: diagnosed\|status: partial" .planning/phases/[current-phase-dir]/*-UAT.md 2>/dev/null || true
```

跟踪：
- `uat_with_gaps`：status 为 "diagnosed" 的 UAT.md 文件（gaps 需要修复）
- `uat_partial`：status 为 "partial" 的 UAT.md 文件（测试未完成）

**第 1.6 步：跨 phase 健康检查**

使用 CLI 扫描当前 milestone 中的**所有** phases，检查未完成的验证债务（CLI 会通过 `getMilestonePhaseFilter` 遵守 milestone 边界）：

```bash
DEBT=$(gsd-sdk query audit-uat --raw 2>/dev/null)
```

解析 JSON 中的 `summary.total_items` 和 `summary.total_files`。

跟踪：`outstanding_debt` —— 审计结果中的 `summary.total_items`。

**如果 outstanding_debt > 0：** 在进度报告输出（`report` 步骤）中添加警告部分，位置放在 "## What's Next" 和路由建议之间：

```markdown
## Verification Debt ({N} files across prior phases)

| Phase | File | Issue |
|-------|------|-------|
| {phase} | {filename} | {pending_count} pending, {skipped_count} skipped, {blocked_count} blocked |
| {phase} | {filename} | human_needed — {count} items |

Review: `/gsd-audit-uat ${GSD_WS}` — full cross-phase audit
Resume testing: `/gsd-verify-work {phase} ${GSD_WS}` — retest specific phase
```

这是一个 WARNING，不是 blocker，路由照常继续。之所以展示这部分债务，是为了让用户能做出知情决策。

**第 2 步：根据计数进行路由**

| Condition | Meaning | Action |
|-----------|---------|--------|
| uat_partial > 0 | UAT 测试未完成 | 转到 **Route E.2** |
| uat_with_gaps > 0 | UAT gaps 需要修复计划 | 转到 **Route E** |
| summaries < plans | 存在未执行的 plans | 转到 **Route A** |
| summaries = plans AND plans > 0 | Phase 已完成 | 转到第 3 步 |
| plans = 0 | Phase 尚未规划 | 转到 **Route B** |

---

**Route A: 存在未执行的 plan**

找到第一个没有匹配 SUMMARY.md 的 PLAN.md。
读取其 `<objective>` section。

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**{phase}-{plan}: [Plan Name]** — [来自 PLAN.md 的 objective 摘要]

`/clear` then:

`/gsd-execute-phase {phase} ${GSD_WS}`

---
```

---

**Route B: Phase 需要规划**

检查 phase 目录中是否存在 `{phase_num}-CONTEXT.md`。

检查当前 phase 是否带有 UI indicators：

```bash
PHASE_SECTION=$(gsd-sdk query roadmap.get-phase "${CURRENT_PHASE}" 2>/dev/null)
PHASE_HAS_UI=$(echo "$PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**如果存在 CONTEXT.md：**

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase {N}: {Name}** — {来自 ROADMAP.md 的 Goal}
<sub>✓ 上下文已收集，可直接开始规划</sub>

`/clear` then:

`/gsd-plan-phase {phase-number} ${GSD_WS}`

---
```

**如果不存在 CONTEXT.md，且 phase 有 UI（`PHASE_HAS_UI` 为 `true`）：**

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase {N}: {Name}** — {来自 ROADMAP.md 的 Goal}

`/clear` then:

`/gsd-discuss-phase {phase}` — 收集上下文并澄清方案

---

**Also available:**
- `/gsd-ui-phase {phase}` — 生成 UI design contract（推荐用于 frontend phases）
- `/gsd-plan-phase {phase}` — 跳过讨论，直接规划
- `/gsd-list-phase-assumptions {phase}` — 查看 Claude 的假设

---
```

**如果不存在 CONTEXT.md，且 phase 没有 UI：**

```
---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase {N}: {Name}** — {来自 ROADMAP.md 的 Goal}

`/clear` then:

`/gsd-discuss-phase {phase} ${GSD_WS}` — 收集上下文并澄清方案

---

**Also available:**
- `/gsd-plan-phase {phase} ${GSD_WS}` — 跳过讨论，直接规划
- `/gsd-list-phase-assumptions {phase} ${GSD_WS}` — 查看 Claude 的假设

---
```

---

**Route E: UAT gaps 需要修复计划**

存在带 gaps 的 UAT.md（已诊断出问题）。用户需要先规划修复。

```
---

## ⚠ UAT Gaps Found

**{phase_num}-UAT.md** 有 {N} 个 gaps 需要修复。

`/clear` then:

`/gsd-plan-phase {phase} --gaps ${GSD_WS}`

---

**Also available:**
- `/gsd-execute-phase {phase} ${GSD_WS}` — 执行 phase plans
- `/gsd-verify-work {phase} ${GSD_WS}` — 运行更多 UAT 测试

---
```

---

**Route E.2: UAT 测试未完成（partial）**

存在 `status: partial` 的 UAT.md，表示测试会话在所有条目解决前就结束了。

```
---

## Incomplete UAT Testing

**{phase_num}-UAT.md** 有 {N} 个未解决测试（pending、blocked 或 skipped）。

`/clear` then:

`/gsd-verify-work {phase} ${GSD_WS}` — 从上次中断处继续测试

---

**Also available:**
- `/gsd-audit-uat ${GSD_WS}` — 完整的跨 phase UAT 审计
- `/gsd-execute-phase {phase} ${GSD_WS}` — 执行 phase plans

---
```

---

**第 3 步：检查 milestone 状态（仅当 phase 完成时）**

读取 ROADMAP.md 并识别：
1. 当前 phase 编号
2. 当前 milestone section 中的所有 phase 编号

统计总 phase 数，并识别最高的 phase 编号。

说明："Current phase is {X}. Milestone has {N} phases (highest: {Y})."

**根据 milestone 状态进行路由：**

| Condition | Meaning | Action |
|-----------|---------|--------|
| current phase < highest phase | 还有更多 phases | 转到 **Route C** |
| current phase = highest phase | Milestone 已完成 | 转到 **Route D** |

---

**Route C: Phase 已完成，仍有后续 phases**

读取 ROADMAP.md 以获取下一 phase 的名称和目标。

检查下一 phase 是否带有 UI indicators：

```bash
NEXT_PHASE_SECTION=$(gsd-sdk query roadmap.get-phase "$((Z+1))" 2>/dev/null)
NEXT_HAS_UI=$(echo "$NEXT_PHASE_SECTION" | grep -qi "UI hint.*yes" && echo "true" || echo "false")
```

**如果下一 phase 有 UI（`NEXT_HAS_UI` 为 `true`）：**

```
---

## ✓ Phase {Z} Complete

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase {Z+1}: {Name}** — {来自 ROADMAP.md 的 Goal}

`/clear` then:

`/gsd-discuss-phase {Z+1}` — 收集上下文并澄清方案

---

**Also available:**
- `/gsd-ui-phase {Z+1}` — 生成 UI design contract（推荐用于 frontend phases）
- `/gsd-plan-phase {Z+1}` — 跳过讨论，直接规划
- `/gsd-verify-work {Z}` — 继续前先进行 user acceptance test

---
```

**如果下一 phase 没有 UI：**

```
---

## ✓ Phase {Z} Complete

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase {Z+1}: {Name}** — {来自 ROADMAP.md 的 Goal}

`/clear` then:

`/gsd-discuss-phase {Z+1} ${GSD_WS}` — 收集上下文并澄清方案

---

**Also available:**
- `/gsd-plan-phase {Z+1} ${GSD_WS}` — 跳过讨论，直接规划
- `/gsd-verify-work {Z} ${GSD_WS}` — 继续前先进行 user acceptance test

---
```

---

**Route D: Milestone 已完成**

```
---

## 🎉 Milestone Complete

全部 {N} 个 phases 已完成！

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Complete Milestone** — 归档并为下一阶段做准备

`/clear` then:

`/gsd-complete-milestone ${GSD_WS}`

---

**Also available:**
- `/gsd-verify-work ${GSD_WS}` — 在完成 milestone 前进行 user acceptance test

---
```

---

**Route F: Milestones 之间（缺少 ROADMAP.md，但存在 PROJECT.md）**

一个 milestone 已完成并归档。现在可以开始下一个 milestone 周期。

读取 MILESTONES.md，找到最后一个已完成的 milestone 版本。

```
---

## ✓ Milestone v{X.Y} Complete

已准备好规划下一个 milestone。

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Start Next Milestone** — questioning → research → requirements → roadmap

`/clear` then:

`/gsd-new-milestone ${GSD_WS}`

---
```

</step>

<step name="edge_cases">
**处理边界情况：**

- Phase 已完成但下一 phase 尚未规划 → 提供 `/gsd-plan-phase [next] ${GSD_WS}`
- 所有工作均已完成 → 提供 milestone completion
- 存在 blockers → 在提供继续选项前先高亮提示
- 存在 handoff file → 提及它，并提供 `/gsd-resume-work ${GSD_WS}`
</step>

<step name="forensic_audit">
**Forensic Integrity Audit** — 仅当 ARGUMENTS 中包含 `--forensic` 时运行。

如果 ARGUMENTS 中**不**包含 `--forensic`：完全跳过此步骤。默认的 progress 行为（标准报告 + 路由）保持不变。

如果 ARGUMENTS 中**包含** `--forensic`：在显示完标准报告和路由建议后，追加以下审计部分。

---

## Forensic Integrity Audit

对项目状态运行 6 项深度检查...

按顺序运行每一项检查。对于每项检查，若通过则输出 ✓（pass）；若发现问题则输出 ⚠（warning），并附上具体证据。

**Check 1 — STATE 与产物一致性**

读取 STATE.md 的 `status` / `stopped_at` 字段（来自已加载的 STATE snapshot）。将其与 roadmap analysis 中的产物计数比较。如果 STATE.md 声称当前 phase 仍是 pending/mid-flight，但产物计数显示该 phase 已完成（所有 PLAN.md 都有匹配的 SUMMARY.md），则标记为不一致。输出：
- ✓ `STATE.md consistent with artifact count` — 如果两者一致
- ⚠ `STATE.md claims [status] but artifact count shows phase complete` — 附具体值

**Check 2 — 孤立的 handoff files**

检查以下文件是否存在：
```bash
ls .planning/HANDOFF.json .planning/phases/*/.continue-here.md .planning/phases/*/*HANDOFF*.md 2>/dev/null || true
```

同时检查 `.planning/continue-here.md`。

输出：
- ✓ `No orphaned handoff files` — 如果未发现
- ⚠ `Orphaned handoff files found` — 列出每个文件路径，并补充：`→ Work was paused mid-flight. Read the handoff before continuing.`

**Check 3 — 延后范围漂移**

在 phase 产物（`.planning/phases/` 下的 CONTEXT.md、DISCUSSION-LOG.md、BUG-BRIEF.md、VERIFICATION.md、SUMMARY.md、HANDOFF.md 文件）中搜索以下模式：
```bash
grep -rl "defer to Phase\|future phase\|out of scope Phase\|deferred to Phase" .planning/phases/ 2>/dev/null || true
```

对于每个匹配项，提取被引用的 phase 编号。再与 ROADMAP.md 中的 phase 列表交叉核对。如果引用的 phase 编号**不在** ROADMAP.md 中，则标记为“已延后但未纳入规划”的范围。

输出：
- ✓ `All deferred scope captured in ROADMAP` — 如果没有不匹配
- ⚠ `Deferred scope references phase(s) not in ROADMAP` — 列出：文件、引用文本、缺失的 phase 编号

**Check 4 — Memory 标记的待处理工作**

检查 `.planning/MEMORY.md` 或 `.planning/memory/` 是否存在：
```bash
ls .planning/MEMORY.md .planning/memory/*.md 2>/dev/null || true
```

如果存在，grep 包含以下内容的条目：`pending`, `status`, `deferred`, `not yet run`, `backfill`, `blocking`。

输出：
- ✓ `No memory entries flagging pending work` — 如果未发现，或不存在 MEMORY.md
- ⚠ `Memory entries flag pending/deferred work` — 列出匹配行（最多 5 条，截断到 80 chars）

**Check 5 — 阻塞性的操作类 todos**

检查待处理 todos：
```bash
ls .planning/todos/pending/*.md 2>/dev/null || true
```

对找到的文件，扫描表示操作性阻塞的关键词：`script`, `credential`, `API key`, `manual`, `verification`, `setup`, `configure`, `run `。

输出：
- ✓ `No blocking operational todos` — 如果没有 pending todos，或都不匹配这些操作性关键词
- ⚠ `Blocking operational todos found` — 列出文件名和匹配关键词（最多 5 个）

**Check 6 — 未提交代码**

```bash
git status --porcelain 2>/dev/null | grep -v "^??" | grep -v "^.planning\/" | grep -v "^\.\." | head -10
```

如果输出非空（存在 `.planning/` 之外的已修改/已暂存文件），则标记为未提交代码。

输出：
- ✓ `Working tree clean` — 如果 `.planning/` 之外没有已修改文件
- ⚠ `Uncommitted changes in source files` — 列出最多 10 个文件路径

---

6 项检查全部完成后，显示 verdict：

**如果 6 项检查全部通过：**
```
### Verdict: CLEAN

标准 progress report 可以信任，按上面的路由建议继续即可。
```

**如果有 1 项或以上检查失败：**
```
### Verdict: N INTEGRITY ISSUE(S) FOUND

标准 progress report 可能无法反映项目的真实状态。
请先查看上方标记的问题，再决定是否按路由建议行动。
```

然后针对每个失败的检查，补充具体的下一步操作：
- Check 2 (orphaned handoff): `Read the handoff file(s) and resume from where work was paused: /gsd-resume-work ${GSD_WS}`
- Check 3 (deferred scope): `Add the missing phases to ROADMAP.md or update the deferred references`
- Check 4 (memory pending): `Review the flagged memory entries and resolve or clear them`
- Check 5 (blocking todos): `Complete the operational steps in .planning/todos/pending/ before continuing`
- Check 6 (uncommitted code): `Commit or stash the uncommitted changes before advancing`
- Check 1 (STATE inconsistency): `Run /gsd-verify-work ${PHASE} ${GSD_WS} to reconcile state`
</step>

</process>

<success_criteria>

- [ ] 提供了丰富上下文（近期工作、决策、问题）
- [ ] 当前位置清晰，并带有可视化进度
- [ ] 清楚说明了下一步是什么
- [ ] 智能路由：有 plans 时使用 /gsd-execute-phase，没有时使用 /gsd-plan-phase
- [ ] 任何操作前都由用户确认
- [ ] 无缝交接到合适的 gsd command
      </success_criteria>
