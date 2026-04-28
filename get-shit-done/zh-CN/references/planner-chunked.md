# Chunked Mode Return Formats

当 `plan-phase` 以 `CHUNKED_MODE=true` 启动 `gsd-planner` 时使用（由 `--chunked`
flag 或 `workflow.plan_chunked: true` config 触发）。它会把单个长生命周期的 planner Task
拆成更短生命周期的 Tasks，以限制 Windows stdio 挂起时的影响范围。

## Modes

### outline-only

只写 **`{PHASE_DIR}/{PADDED_PHASE}-PLAN-OUTLINE.md`**。不要写任何 PLAN.md 文件。
返回：

```markdown
## OUTLINE COMPLETE

**Phase:** {phase-name}
**Plans:** {N} plan(s) in {M} wave(s)

| Plan ID | Objective | Wave | Depends On | Requirements |
|---------|-----------|------|-----------|-------------|
| {padded_phase}-01 | [brief objective] | 1 | none | REQ-001, REQ-002 |
| {padded_phase}-02 | [brief objective] | 1 | none | REQ-003 |
```

orchestrator 会读取这个表，然后为每一行再启动一个 single-plan Task。

### single-plan

只写 **一个** `{PHASE_DIR}/{plan_id}-PLAN.md`。不要写任何其他 plan 文件。
返回：

```markdown
## PLAN COMPLETE

**Plan:** {plan-id}
**Objective:** {brief}
**File:** {PHASE_DIR}/{plan-id}-PLAN.md
**Tasks:** {N}
```

orchestrator 会在每次返回后验证该文件是否真的存在于磁盘上、提交它，然后继续处理 outline 中的下一条 plan。

## Resume Behaviour

如果 orchestrator 检测到 `PLAN-OUTLINE.md` 已存在（来自之前中断的运行），它会跳过 outline-only Task，直接进入 single-plan Tasks，并跳过那些磁盘上已存在的 `{plan_id}-PLAN.md` 文件。
