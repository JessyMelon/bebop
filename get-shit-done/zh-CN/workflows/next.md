<purpose>
检测当前项目状态，并自动推进到下一个合乎逻辑的 GSD workflow 步骤。
读取项目状态，以判断：discuss → plan → execute → verify → complete 的推进路径。
</purpose>

<required_reading>
开始前读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<process>

<step name="detect_state">
读取项目状态以判断当前位置：

```bash
# Get state snapshot
gsd-sdk query state.json 2>/dev/null || echo "{}"
```

还要读取：
- `.planning/STATE.md` — 当前阶段、进度、plan 计数
- `.planning/ROADMAP.md` — milestone 结构与阶段列表

提取：
- `current_phase` — 当前激活的是哪个阶段
- `plan_of` / `plans_total` — plan 执行进度
- `progress` — 总体百分比
- `status` — active、paused 等

如果不存在 `.planning/` 目录：
```
No GSD project detected. Run `/gsd-new-project` to get started.
```
退出。
</step>

<step name="safety_gates">
在路由前运行 hard-stop 检查。除非传入了 `--force`，否则命中第一个后立即退出。

如果传入了 `--force` flag，跳过所有 gate 和 consecutive guard。
打印单行警告：`⚠ --force: skipping safety gates`
然后直接继续到 `determine_next_action`。

**Gate 1: Unresolved checkpoint**
检查 `.planning/.continue-here.md` 是否存在：
```bash
[ -f .planning/.continue-here.md ]
```
如果找到：
```
⛔ Hard stop: Unresolved checkpoint

`.planning/.continue-here.md` exists — a previous session left
unfinished work that needs manual review before advancing.

Read the file, resolve the issue, then delete it to continue.
Use `--force` to bypass this check.
```
退出（不要路由）。

**Gate 2: Error state**
检查 STATE.md 是否包含 `status: error` 或 `status: failed`：
如果找到：
```
⛔ Hard stop: Project in error state

STATE.md shows status: {status}. Resolve the error before advancing.
Run `/gsd-health` to diagnose, or manually fix STATE.md.
Use `--force` to bypass this check.
```
退出。

**Gate 3: Unchecked verification**
检查当前阶段是否有 VERIFICATION.md，且其中存在没有 override 的 `FAIL` 项：
如果找到：
```
⛔ Hard stop: Unchecked verification failures

VERIFICATION.md for phase {N} has {count} unresolved FAIL items.
Address the failures or add overrides before advancing to the next phase.
Use `--force` to bypass this check.
```
退出。

**Prior-phase completeness scan:**
通过以上三个 hard-stop gate 后，按 ROADMAP.md 中的顺序扫描当前阶段之前的所有阶段，查找未完成工作。对每个之前的阶段编号 `N`，使用 `gsd-sdk query find-phase <N>` JSON（plans、summaries、incomplete_plans 等）检查该阶段。

识别三类未完成工作：
1. **Plans without summaries** — 之前阶段目录中存在 PLAN.md，但没有对应的 SUMMARY.md（执行已开始但未完成）。
2. **Verification failures not overridden** — 之前阶段有 VERIFICATION.md，其中 `FAIL` 项没有 override 注释。
3. **CONTEXT.md without plans** — 之前阶段目录中有 CONTEXT.md，但没有 PLAN.md 文件（讨论已发生，但从未运行规划）。

如果没有发现未完成的前置阶段工作，则静默继续到 `determine_next_action`，不做提示。

如果发现未完成的前置阶段工作，显示结构化完整性报告：
```
⚠ Prior phase has incomplete work

Phase {N} — "{name}" has unresolved items:
  • Plan {N}-{M} ({slug}): executed but no SUMMARY.md
  [... additional items ...]

Advancing before resolving these may cause:
  • Verification gaps — future phase verification won't have visibility into what prior phases shipped
  • Context loss — plans that ran without summaries leave no record for future agents

Options:
  [C] Continue and defer these items to backlog
  [S] Stop and resolve manually (recommended)
  [F] Force advance without recording deferral

Choice [S]:
```

**If the user chooses "Stop" (S or Enter/default):** 不路由，直接退出。

**If the user chooses "Continue and defer" (C):**
1. 对每个未完成项，在 `ROADMAP.md` 的 `## Backlog` 下使用现有 `999.x` 编号方案创建一条 backlog 记录：
```markdown
### Phase 999.{N}: Follow-up — Phase {src} incomplete plans (BACKLOG)

**Goal:** Resolve plans that ran without producing summaries during Phase {src} execution
**Source phase:** {src}
**Deferred at:** {date} during /gsd-next advancement to Phase {dest}
**Plans:**
- [ ] {N}-{M}: {slug} (ran, no SUMMARY.md)
```
2. 提交该延期记录：
```bash
gsd-sdk query commit "docs: defer incomplete Phase {src} items to backlog"
```
3. 立即继续路由到 `determine_next_action` — 不要再次提问。

**If the user chooses "Force" (F):** 不记录延期，直接继续到 `determine_next_action`。
</step>

<step name="spike_sketch_notice">
检查是否有待处理的 spike/sketch 工作，并显示提示（不改变路由）：

```bash
# Check for pending spikes (verdict: PENDING in any README)
PENDING_SPIKES=$(grep -rl 'verdict: PENDING' .planning/spikes/*/README.md 2>/dev/null | wc -l | tr -d ' ')

# Check for pending sketches (winner: null in any README)
PENDING_SKETCHES=$(grep -rl 'winner: null' .planning/sketches/*/README.md 2>/dev/null | wc -l | tr -d ' ')
```

如果任一计数 > 0，在路由前显示：
```
⚠ Pending exploratory work:
  {PENDING_SPIKES} spike(s) with unresolved verdicts in .planning/spikes/
  {PENDING_SKETCHES} sketch(es) without a winning variant in .planning/sketches/

  Resume with `/gsd-spike` or `/gsd-sketch`, or continue with phase work below.
```

只显示非零计数对应的行。如果两者都是 0，则完全跳过此提示。
</step>

<step name="determine_next_action">
根据状态应用路由规则：

**Route 1: No phases exist yet → discuss**
如果 ROADMAP 有 phases，但磁盘上还没有任何 phase 目录：
→ Next action: `/gsd-discuss-phase <first-phase>`

**Route 2: Phase exists but has no CONTEXT.md or RESEARCH.md → discuss**
如果当前 phase 目录已存在，但既没有 CONTEXT.md，也没有 RESEARCH.md：
→ Next action: `/gsd-discuss-phase <current-phase>`

**Route 3: Phase has context but no plans → plan**
如果当前 phase 有 CONTEXT.md（或 RESEARCH.md），但没有 PLAN.md 文件：
→ Next action: `/gsd-plan-phase <current-phase>`

**Route 4: Phase has plans but incomplete summaries → execute**
如果已存在 plans，但并非所有 plan 都有对应的 summary：
→ Next action: `/gsd-execute-phase <current-phase>`

**Route 5: All plans have summaries → verify and complete**
如果当前阶段中的所有 plan 都有 summary：
→ Next action: `/gsd-verify-work`

**Route 6: Phase complete, next phase exists → advance**
如果当前 phase 已完成，且 ROADMAP 中存在下一个 phase：
→ Next action: `/gsd-discuss-phase <next-phase>`

**Route 7: All phases complete → complete milestone**
如果所有 phase 都已完成：
→ Next action: `/gsd-complete-milestone`

**Route 8: Paused → resume**
如果 STATE.md 显示 paused_at：
→ Next action: `/gsd-resume-work`
</step>

<step name="show_and_execute">
显示判断结果：

```
## GSD Next

**Current:** Phase [N] — [name] | [progress]%
**Status:** [status description]

▶ **Next step:** `/gsd-[command] [args]`
  [One-line explanation of why this is the next step]
```

然后立即通过 SlashCommand 调用确定出的命令。
不要请求确认——`/gsd-next` 的重点就是零摩擦推进。
</step>

</process>

<success_criteria>
- [ ] 正确检测到项目状态
- [ ] 根据路由规则正确判断 Next action
- [ ] 无需用户确认，立即调用命令
- [ ] 调用前清晰显示状态
</success_criteria>
