<internal_workflow>

**这是一个 INTERNAL workflow，不是面向用户的命令。**

不存在 `/gsd-transition` 命令。这个 workflow 会由
`execute-phase` 在 auto-advance 期间自动调用，或在 phase
verification 之后由 orchestrator 内联调用。绝不要告诉用户去运行 `/gsd-transition`。

**可用于 phase 推进的用户命令：**
- `/gsd-discuss-phase {N}` — 在规划前讨论某个 phase
- `/gsd-plan-phase {N}` — 规划某个 phase
- `/gsd-execute-phase {N}` — 执行某个 phase
- `/gsd-progress` — 查看 roadmap 进度

</internal_workflow>

<required_reading>

**立即读取这些文件：**

1. `.planning/STATE.md`
2. `.planning/PROJECT.md`
3. `.planning/ROADMAP.md`
4. 当前 phase 的计划文件（`*-PLAN.md`）
5. 当前 phase 的总结文件（`*-SUMMARY.md`）

</required_reading>

<purpose>

将当前 phase 标记为完成并推进到下一个。这也是更新进度追踪和演化 PROJECT.md 的自然时点。

“Planning next phase” = “当前 phase 已完成”

</purpose>

<process>

<step name="load_project_state" priority="first">

在 transition 之前，读取项目状态：

```bash
cat .planning/STATE.md 2>/dev/null || true
cat .planning/PROJECT.md 2>/dev/null || true
```

解析当前位置，确认正在 transition 的是正确的 phase。
记录 transition 后可能需要更新的累积上下文。

</step>

<step name="verify_completion">

检查当前 phase 是否具备所有 plan summaries：

```bash
(ls .planning/phases/XX-current/*-PLAN.md 2>/dev/null || true) | sort
(ls .planning/phases/XX-current/*-SUMMARY.md 2>/dev/null || true) | sort
```

**Verification logic：**

- 统计 PLAN 文件数
- 统计 SUMMARY 文件数
- 如果数量一致：所有 plans 已完成
- 如果数量不一致：说明未完成

<config-check>

```bash
cat .planning/config.json 2>/dev/null || true
```

</config-check>

**检查此 phase 是否存在 verification debt：**

```bash
# Count outstanding items in current phase
OUTSTANDING=""
for f in .planning/phases/XX-current/*-UAT.md .planning/phases/XX-current/*-VERIFICATION.md; do
  [ -f "$f" ] || continue
  grep -q "result: pending\|result: blocked\|status: partial\|status: human_needed\|status: diagnosed" "$f" && OUTSTANDING="$OUTSTANDING\n$(basename $f)"
done
```

**如果 `OUTSTANDING` 非空：**

将以下内容附加到完成确认消息中（无论什么 mode）：

```
Outstanding verification items in this phase:
{list filenames}

这些项会作为 debt 延续下去。可查看：`/gsd-audit-uat`
```

这**不会**阻止 transition，只是确保用户在确认前能看到这些 debt。

**如果所有 plans 都已完成：**

<if mode="yolo">

```
⚡ Auto-approved: Transition Phase [X] → Phase [X+1]
Phase [X] complete — all [Y] plans finished.

Proceeding to mark done and advance...
```

直接继续到 cleanup_handoff step。

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

询问："Phase [X] complete — all [Y] plans finished. Ready to mark done and move to Phase [X+1]?"

等待确认后再继续。

</if>

**如果 plans 未完成：**

**SAFETY RAIL：这里始终适用 always_confirm_destructive。**
跳过未完成的 plans 属于 destructive 行为，无论什么 mode 都必须提示确认。

展示：

```
Phase [X] has incomplete plans:
- {phase}-01-SUMMARY.md ✓ Complete
- {phase}-02-SUMMARY.md ✗ Missing
- {phase}-03-SUMMARY.md ✗ Missing

⚠️ Safety rail: Skipping plans requires confirmation (destructive action)

Options:
1. Continue current phase (execute remaining plans)
2. Mark complete anyway (skip remaining plans)
3. Review what's left
```

等待用户决定。

</step>

<step name="cleanup_handoff">

检查是否残留 handoffs：

```bash
ls .planning/phases/XX-current/.continue-here*.md 2>/dev/null || true
```

如果找到了，就删除它们。phase 已完成，这些 handoffs 已过期。

</step>

<step name="update_roadmap_and_state">

**将 ROADMAP.md 和 STATE.md 的更新委托给 `gsd-sdk query phase.complete`：**

```bash
TRANSITION=$(gsd-sdk query phase.complete "${current_phase}")
```

CLI 会处理：
- 将该 phase 的复选框标记为 `[x]` 完成，并写入今天日期
- 将 plan count 更新为最终值（例如 `3/3 plans complete`）
- 更新 Progress table（Status → Complete，并添加日期）
- 将 STATE.md 推进到下一 phase（Current Phase、Status → Ready to plan、Current Plan → Not started）
- 检测这是否是 milestone 中最后一个 phase

从结果中提取：`completed_phase`、`plans_executed`、`next_phase`、`next_phase_name`、`is_last_phase`。

</step>

<step name="archive_prompts">

如果为该 phase 生成过 prompts，它们保持原位。
来自 create-meta-prompts 的 `completed/` 子目录模式负责归档。

</step>

<step name="evolve_project">

演化 PROJECT.md，以反映已完成 phase 中的经验与发现。

**读取 phase summaries：**

```bash
cat .planning/phases/XX-current/*-SUMMARY.md
```

**评估需求变化：**

1. **Requirements validated?**
   - 本 phase 中是否交付了任何 Active requirements？
   - 将其移到 Validated，并带上 phase 引用：`- ✓ [Requirement] — Phase X`

2. **Requirements invalidated?**
   - 是否发现任何 Active requirements 实际上不再需要或本身有误？
   - 将其移到 Out of Scope，并注明原因：`- [Requirement] — [why invalidated]`

3. **Requirements emerged?**
   - 构建过程中是否发现了新的 requirements？
   - 将其加入 Active：`- [ ] [New requirement]`

4. **Decisions to log?**
   - 从 SUMMARY.md 文件中提取 decisions
   - 如果已知结果，则将其加入 Key Decisions table

5. **"What This Is" still accurate?**
   - 如果产品意义上已发生明显变化，更新该描述
   - 保持其准确、不过时

**更新 PROJECT.md：**

直接原地编辑。更新 "Last updated" footer：

```markdown
---
*Last updated: [date] after Phase [X]*
```

**示例演化：**

Before:

```markdown
### Active

- [ ] JWT authentication
- [ ] Real-time sync < 500ms
- [ ] Offline mode

### Out of Scope

- OAuth2 — complexity not needed for v1
```

After（Phase 2 交付了 JWT auth，并发现还需要 rate limiting）：

```markdown
### Validated

- ✓ JWT authentication — Phase 2

### Active

- [ ] Real-time sync < 500ms
- [ ] Offline mode
- [ ] Rate limiting on sync endpoint

### Out of Scope

- OAuth2 — complexity not needed for v1
```

**本步骤完成条件：**

- [ ] 已审阅 phase summaries 以提取经验与发现
- [ ] 已将经过验证的 requirements 从 Active 移走
- [ ] 已将失效的 requirements 连同原因移到 Out of Scope
- [ ] 已将新出现的 requirements 加入 Active
- [ ] 已记录新的 decisions 及其 rationale
- [ ] 如产品有变化，已更新 "What This Is"
- [ ] "Last updated" footer 已反映这次 transition

</step>

<step name="graduation_scan">

扫描最近几个 phase 的 LEARNINGS.md，查找反复出现的模式，并向开发者展示可晋升的候选项。

**调用 graduation helper：**

```text
@~/.claude/get-shit-done/workflows/graduation.md
```

这一步完全委托给 `graduation.md`。它会处理 guard checks（feature flag、window size、threshold）、clustering、backlog filtering、HITL prompting、promotion writes 和 STATE.md updates。

**这一步始终是非阻塞的：** graduation candidates 只会展示给开发者做决定；继续 transition 不需要采取任何动作。如果 graduation scan 没有产出符合条件的 clusters，它会打印一行 `[graduation: no qualifying clusters]` 并返回。

**本步骤完成条件：**

- [ ] graduation.md 的 guard checks 已通过（或静默 no-op 跳过）
- [ ] 已展示 recurring clusters（或已打印 `[graduation: no qualifying clusters]`）
- [ ] 每个 cluster 都已被处理为 Promote / Defer / Dismiss（或全部跳过）

</step>

<step name="update_current_position_after_transition">

**注意：** 基础位置更新（Current Phase、Status、Current Plan、Last Activity）已经在 `update_roadmap_and_state` 步中由 `gsd-sdk query phase.complete` 处理完毕。

读取 STATE.md，确认这些更新正确。如果需要更新 progress bar，使用：

```bash
PROGRESS=$(gsd-sdk query progress.bar --raw)
```

将结果写入 STATE.md 中的 progress bar 那一行。

**本步骤完成条件：**

- [ ] Phase 编号已递增到下一 phase（由 phase complete 完成）
- [ ] Plan status 已重置为 "Not started"（由 phase complete 完成）
- [ ] Status 显示为 "Ready to plan"（由 phase complete 完成）
- [ ] Progress bar 已反映累计完成的 plans 总数

</step>

<step name="update_project_reference">

更新 STATE.md 中的 Project Reference section。

```markdown
## Project Reference

See: .planning/PROJECT.md (updated [today])

**Core value:** [Current core value from PROJECT.md]
**Current focus:** [Next phase name]
```

更新日期和 current focus，以反映本次 transition。

</step>

<step name="review_accumulated_context">

审阅并更新 STATE.md 中的 Accumulated Context section。

**Decisions：**

- 记录本 phase 最近的 decisions（最多 3-5 条）
- 完整日志保存在 PROJECT.md 的 Key Decisions table 中

**Blockers/Concerns：**

- 审查已完成 phase 中的 blockers
- 如果已在本 phase 中解决：从列表移除
- 如果对未来仍然 relevant：保留，并加上 "Phase X" 前缀
- 加入本 phase summaries 中出现的任何新 concern

**示例：**

Before:

```markdown
### Blockers/Concerns

- ⚠️ [Phase 1] Database schema not indexed for common queries
- ⚠️ [Phase 2] WebSocket reconnection behavior on flaky networks unknown
```

After（如果 database indexing 已在 Phase 2 解决）：

```markdown
### Blockers/Concerns

- ⚠️ [Phase 2] WebSocket reconnection behavior on flaky networks unknown
```

**本步骤完成条件：**

- [ ] 已记录最近 decisions（完整日志在 PROJECT.md）
- [ ] 已从列表移除已解决的 blockers
- [ ] 未解决的 blockers 保留并带有 phase 前缀
- [ ] 已加入本次已完成 phase 中出现的新 concerns

</step>

<step name="update_session_continuity_after_transition">

更新 STATE.md 中的 Session Continuity section，以反映 transition 已完成。

**格式：**

```markdown
Last session: [today]
Stopped at: Phase [X] complete, ready to plan Phase [X+1]
Resume file: None
```

**本步骤完成条件：**

- [ ] Last session 时间戳已更新为当前日期和时间
- [ ] Stopped at 已描述当前 phase 完成和下一 phase
- [ ] 已确认 Resume file 为 None（transition 不使用 resume files）

</step>

<step name="offer_next_phase">

**强制要求：在展示下一步前先确认 milestone 状态。**

**使用 `gsd-sdk query phase.complete` 的 transition 结果：**

`phase complete` 结果中的 `is_last_phase` 字段会直接告诉你：
- `is_last_phase: false` → 还有更多 phases → 进入 **Route A**
- `is_last_phase: true` → 最后一个 phase 已完成 → **先检查 workstream collisions**

`next_phase` 和 `next_phase_name` 字段会给出下一 phase 的详情。

如果需要更多上下文，使用：
```bash
ROADMAP=$(gsd-sdk query roadmap.analyze)
```

它会返回所有 phases，以及它们的 goals、disk status 和 completion info。

---

**Workstream collision check（当 `is_last_phase: true` 时）：**

在路由到 Route B 之前，检查其他 workstreams 是否仍处于活跃状态。
这样可以防止某个 workstream 在其他 workstreams 仍在推进各自 phases 时，提前推进或完成 milestone。

**如果不在 workstream mode，则跳过此检查**（即未设置 `GSD_WORKSTREAM`，也就是 flat mode）。
在 flat mode 下，直接进入 **Route B**。

```bash
# Only check if we're in workstream mode
if [ -n "$GSD_WORKSTREAM" ]; then
  WS_LIST=$(gsd-sdk query workstream.list --raw)
fi
```

解析该 JSON 结果。输出结构为 `{ mode, workstreams: [...] }`。
每个 workstream 条目包含：`name`、`status`、`current_phase`、`phase_count`、`completed_phases`。

过滤掉当前 workstream（`$GSD_WORKSTREAM`）以及任何 status 包含 "milestone complete" 或 "archived" 的 workstreams（不区分大小写）。
剩余条目即为**其他仍然活跃的 workstreams**。

- **如果存在其他活跃 workstreams** → 进入 **Route B1**
- **如果不存在其他活跃 workstreams**（或处于 flat mode）→ 进入 **Route B**

---

**Route A: Milestone 中仍有更多 phases**

读取 ROADMAP.md，获取下一 phase 的名称和目标。

**检查下一 phase 是否存在 CONTEXT.md：**

```bash
ls .planning/phases/*[X+1]*/*-CONTEXT.md 2>/dev/null || true
```

**如果下一 phase 存在：**

<if mode="yolo">

**如果存在 CONTEXT.md：**

```
Phase [X] marked complete.

Next: Phase [X+1] — [Name]

⚡ Auto-continuing: Plan Phase [X+1] in detail
```

退出 skill，并调用 SlashCommand("/gsd-plan-phase [X+1] --auto ${GSD_WS}")

**如果不存在 CONTEXT.md：**

```
Phase [X] marked complete.

Next: Phase [X+1] — [Name]

⚡ Auto-continuing: Discuss Phase [X+1] first
```

退出 skill，并调用 SlashCommand("/gsd-discuss-phase [X+1] --auto ${GSD_WS}")

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

**如果不存在 CONTEXT.md：**

```
## ✓ Phase [X] Complete

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase [X+1]: [Name]** — [Goal from ROADMAP.md]

`/clear` then:

`/gsd-discuss-phase [X+1] ${GSD_WS}` — 收集上下文并澄清方案

---

**Also available:**
- `/gsd-plan-phase [X+1] ${GSD_WS}` — 跳过讨论，直接规划
- `/gsd-research-phase [X+1] ${GSD_WS}` — 调查未知项

---
```

**如果存在 CONTEXT.md：**

```
## ✓ Phase [X] Complete

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase [X+1]: [Name]** — [Goal from ROADMAP.md]
<sub>✓ Context gathered, ready to plan</sub>

`/clear` then:

`/gsd-plan-phase [X+1] ${GSD_WS}`

---

**Also available:**
- `/gsd-discuss-phase [X+1] ${GSD_WS}` — 重新审视上下文
- `/gsd-research-phase [X+1] ${GSD_WS}` — 调查未知项

---
```

</if>

---

**Route B1: 当前 workstream 已完成，但其他 workstreams 仍在进行中**

当 `is_last_phase: true` 且 collision check 发现其他活跃 workstreams 时，会进入这个 route。
不要建议完成 milestone，也不要建议推进到下一个 milestone，因为其他 workstreams 还在工作。

**清除 auto-advance chain flag**，因为 workstream 边界是自然停点：

```bash
gsd-sdk query config-set workflow._auto_chain_active false
```

<if mode="yolo">

覆盖 auto-advance：不要自动继续到 milestone completion。
展示阻塞信息后停止。

</if>

展示（所有 modes）：

```
## ✓ Phase {X}: {Phase Name} Complete

This workstream's phases are complete. Other workstreams are still active:

| Workstream | Status | Phase | Progress |
|------------|--------|-------|----------|
| {name}     | {status} | {current_phase} | {completed_phases}/{phase_count} |
| ...        | ...    | ...   | ...      |

---

## Next Steps

归档此 workstream：

`/gsd-workstreams complete {current_ws_name} ${GSD_WS}`

查看整体 milestone 进度：

`/gsd-workstreams progress ${GSD_WS}`

<sub>待所有 workstreams 完成后，才可以进行 milestone completion。</sub>

---
```

不要建议 `/gsd-complete-milestone` 或 `/gsd-new-milestone`。
不要自动调用任何后续 slash commands。

**到此停止。** 下一步必须由用户明确决定。

---

**Route B: Milestone 已完成（所有 phases 都完成）**

**只有在以下条件下才会进入这个 route：**
- `is_last_phase: true` 且不存在其他活跃 workstreams（或处于 flat mode）

**清除 auto-advance chain flag**，因为 milestone 边界是自然停点：

```bash
gsd-sdk query config-set workflow._auto_chain_active false
```

<if mode="yolo">

```
Phase {X} marked complete.

🎉 Milestone {version} is 100% complete — all {N} phases finished!

⚡ Auto-continuing: Complete milestone and archive
```

退出 skill，并调用 SlashCommand("/gsd-complete-milestone {version} ${GSD_WS}")

</if>

<if mode="interactive" OR="custom with gates.confirm_transition true">

```
## ✓ Phase {X}: {Phase Name} Complete

🎉 Milestone {version} is 100% complete — all {N} phases finished!

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Complete Milestone {version}** — 归档并为下一步做准备

`/clear` then:

`/gsd-complete-milestone {version} ${GSD_WS}`

---

**Also available:**
- 在归档前先审阅成果

---
```

</if>

</step>

</process>

<implicit_tracking>
进度追踪是 IMPLICIT 的：规划 phase N 就意味着 phases 1-(N-1) 已完成。不需要单独的进度步骤，向前推进本身就是进度。
</implicit_tracking>

<partial_completion>

如果用户想继续往前走，但当前 phase 还没完全完成：

```
Phase [X] has incomplete plans:
- {phase}-02-PLAN.md (not executed)
- {phase}-03-PLAN.md (not executed)

Options:
1. Mark complete anyway (plans weren't needed)
2. Defer work to later phase
3. Stay and finish current phase
```

尊重用户判断，他们知道这些工作是否真的重要。

**如果带着未完成 plans 直接标记完成：**

- 更新 ROADMAP：写成 `2/3 plans complete`（而不是 `3/3`）
- 在 transition message 中注明哪些 plans 被跳过

</partial_completion>

<success_criteria>

满足以下条件即视为 transition 完成：

- [ ] 已验证当前 phase 的 plan summaries（要么都存在，要么用户选择跳过）
- [ ] 已删除所有过期 handoffs
- [ ] 已更新 ROADMAP.md 的完成状态和 plan count
- [ ] 已演化 PROJECT.md（requirements、decisions、必要时的 description）
- [ ] 已更新 STATE.md（位置、project reference、context、session）
- [ ] 已更新 Progress table
- [ ] 用户已明确知道下一步

</success_criteria>
