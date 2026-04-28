<purpose>
创建结构化的 `.planning/HANDOFF.json` 和 `.continue-here.md` 交接文件，以便在不同 session 之间保留完整工作状态。JSON 为 `/gsd-resume-work` 提供 machine-readable 状态；markdown 提供 human-readable 上下文。
</purpose>

<required_reading>
开始前读取 invoking prompt 的 execution_context 引用的所有文件。
</required_reading>

<process>

<step name="detect">
## Context Detection

判断当前要暂停的是哪类工作，并据此设置 handoff 目标位置：

```bash
# Check for active phase
phase=$(( ls -lt .planning/phases/*/PLAN.md 2>/dev/null || true ) | head -1 | grep -oP 'phases/\K[^/]+' || true)

# Check for active spike
spike=$(( ls -lt .planning/spikes/*/SPIKE.md .planning/spikes/*/DESIGN.md .planning/spikes/*/README.md 2>/dev/null || true ) | head -1 | grep -oP 'spikes/\K[^/]+' || true)

# Check for active sketch
sketch=$(( ls -lt .planning/sketches/*/README.md .planning/sketches/*/index.html 2>/dev/null || true ) | head -1 | grep -oP 'sketches/\K[^/]+' || true)

# Check for active deliberation
deliberation=$(ls .planning/deliberations/*.md 2>/dev/null | head -1 || true)
```

- **Phase work**: 活动的 phase 目录 → 交接到 `.planning/phases/XX-name/.continue-here.md`
- **Spike work**: 活动的 spike 目录或与 spike 相关的文件（且没有活动 phase）→ 交接到 `.planning/spikes/SPIKE-NNN/.continue-here.md`（必要时创建目录）
- **Sketch work**: 活动的 sketch 目录（且没有活动 phase/spike）→ 交接到 `.planning/sketches/.continue-here.md`
- **Deliberation work**: 活动的 deliberation 文件（且没有 phase/spike/sketch）→ 交接到 `.planning/deliberations/.continue-here.md`
- **Research work**: 存在 research notes，但没有 phase/spike/sketch/deliberation → 交接到 `.planning/.continue-here.md`
- **Default**: 无法检测到明确上下文 → 交接到 `.planning/.continue-here.md`，并在 `<current_state>` 中注明这种歧义

如果检测到 phase，则使用 phase handoff 路径继续。否则使用上面第一个匹配到的非 phase 路径。
</step>

<step name="gather">
**为 handoff 收集完整状态：**

1. **Current position**: 当前是哪个 phase、哪个 plan、哪个 task
2. **Work completed**: 本次 session 完成了什么
3. **Work remaining**: 当前 plan/phase 还剩什么
4. **Decisions made**: 关键决策及其理由
5. **Blockers/issues**: 任何卡住的问题
6. **Human actions pending**: 需要人工介入的事项（MCP setup、API keys、审批、手动测试）
7. **Background processes**: workflow 过程中涉及的任何运行中 server/watcher
8. **Files modified**: 已变更但未提交的内容
9. **Blocking constraints**: 本次 session 中遇到的反模式或方法论失败，恢复工作的 agent 在继续前 MUST 知道。只包含通过实际失败发现的事项——不要写警告或预测。为每个 constraint 指定 `severity`：
   - `blocking` — 恢复工作的 agent 在继续前 MUST 证明自己理解了该问题。discuss-phase 和 execute-phase workflows 会强制执行理解检查。
   - `advisory` — 重要上下文，但不会阻止恢复。

如果需要，通过对话式问题向用户请求澄清。

**还要检查 SUMMARY.md 文件中是否有伪完成：**
```bash
# Check for placeholder content in existing summaries
grep -l "To be filled\|placeholder\|TBD" .planning/phases/*/*.md 2>/dev/null || true
```
将任何包含 placeholder 内容的 summary 报告为未完成项。
</step>

<step name="write_structured">
**将结构化 handoff 写入 `.planning/HANDOFF.json`：**

```bash
timestamp=$(gsd-sdk query current-timestamp full --raw)
```

```json
{
  "version": "1.0",
  "timestamp": "{timestamp}",
  "phase": "{phase_number}",
  "phase_name": "{phase_name}",
  "phase_dir": "{phase_dir}",
  "plan": {current_plan_number},
  "task": {current_task_number},
  "total_tasks": {total_task_count},
  "status": "paused",
  "completed_tasks": [
    {"id": 1, "name": "{task_name}", "status": "done", "commit": "{short_hash}"},
    {"id": 2, "name": "{task_name}", "status": "done", "commit": "{short_hash}"},
    {"id": 3, "name": "{task_name}", "status": "in_progress", "progress": "{what_done}"}
  ],
  "remaining_tasks": [
    {"id": 4, "name": "{task_name}", "status": "not_started"},
    {"id": 5, "name": "{task_name}", "status": "not_started"}
  ],
  "blockers": [
    {"description": "{blocker}", "type": "technical|human_action|external", "workaround": "{if any}"}
  ],
  "human_actions_pending": [
    {"action": "{what needs to be done}", "context": "{why}", "blocking": true}
  ],
  "decisions": [
    {"decision": "{what}", "rationale": "{why}", "phase": "{phase_number}"}
  ],
  "uncommitted_files": [],
  "next_action": "{specific first action when resuming}",
  "context_notes": "{mental state, approach, what you were thinking}"
}
```
</step>

<step name="write">
**将 handoff 写入 detect step 中确定的路径**（例如 `.planning/phases/XX-name/.continue-here.md`、`.planning/spikes/SPIKE-NNN/.continue-here.md`，或 `.planning/.continue-here.md`）：

```markdown
---
context: [phase|spike|sketch|deliberation|research|default]
phase: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: [timestamp from current-timestamp]
---

# BLOCKING CONSTRAINTS — Read Before Anything Else

> These are not suggestions. Each constraint below was discovered through failure.
> Acknowledge each one explicitly before proceeding.

- [ ] CONSTRAINT: [name] — [what it is] — [structural mitigation required]

**Do not proceed until all boxes are checked.**

_If no constraints have been identified yet, remove this section._

## Critical Anti-Patterns

| Pattern | Description | Severity | Prevention Mechanism |
|---------|-------------|----------|---------------------|
| [pattern name] | [what it is and how it manifested] | blocking | [structural step that prevents recurrence — not acknowledgment] |
| [pattern name] | [what it is and how it manifested] | advisory | [guidance for avoiding it] |

**Severity values:** `blocking` — resuming agent must pass understanding check before proceeding. `advisory` — important context, does not gate resumption.

_Remove rows that do not apply. The discuss-phase and execute-phase workflows parse this table and enforce a mandatory understanding check for any `blocking` rows._

<current_state>
[我们现在具体处于哪里？直接上下文是什么]
</current_state>

<completed_work>

Completed Tasks:
- Task 1: [name] - Done
- Task 2: [name] - Done
- Task 3: [name] - In progress, [what's done]
</completed_work>

<remaining_work>

- Task 3: [what's left]
- Task 4: Not started
- Task 5: Not started
</remaining_work>

<decisions_made>

- 决定使用 [X]，因为 [reason]
- 选择 [approach] 而不是 [alternative]，因为 [reason]
</decisions_made>

<blockers>
- [Blocker 1]: [status/workaround]
</blockers>

## Required Reading (in order)
<!-- List documents the resuming agent must read before acting -->
1. [document] — [why it matters]
1. `.planning/METHODOLOGY.md` (if it exists) — 项目的分析视角；在做任何假设分析前先应用

## Critical Anti-Patterns (do NOT repeat these)
<!-- Mistakes discovered this session that must be structurally avoided -->
- [ANTI-PATTERN]: [what it is] → [structural mitigation]

## Infrastructure State
<!-- Running services, external state, environment specifics -->
- [service/env]: [current state]

## Pre-Execution Critique Required
<!-- Fill in ONLY if pausing between design and execution (e.g. spike design done, not yet run) -->
- Design artifact: [path]
- Critique focus: [key questions the critic should probe]
- Gate: Do NOT begin execution until critique is complete and design is revised

<context>
[当时的思路、方法、接下来的计划]
</context>

<next_action>
Start with: [specific first action when resuming]
</next_action>
```

要写得足够具体，让一个全新的 Claude 也能立刻看懂。

`last_updated` 字段使用 `current-timestamp`。你可以使用 init todos（会提供时间戳），也可以直接调用：
```bash
timestamp=$(gsd-sdk query current-timestamp full --raw)
```
</step>

<step name="commit">
```bash
gsd-sdk query commit "wip: [context-name] paused at [X]/[Y]" [handoff-path] .planning/HANDOFF.json
```
</step>

<step name="confirm">
```
✓ Handoff created:
  - .planning/HANDOFF.json (structured, machine-readable)
  - [handoff-path] (human-readable)

Current state:

- Context: [phase|spike|deliberation|research]
- Location: [XX-name or SPIKE-NNN]
- Task: [X] of [Y]
- Status: [in_progress/blocked]
- Blockers: [count] ({human_actions_pending count} need human action)
- Committed as WIP

To resume: /gsd-resume-work

```
</step>

</process>

<success_criteria>
- [ ] 已检测到上下文（phase/spike/deliberation/research/default）
- [ ] 已在检测出的正确路径创建 .continue-here.md
- [ ] 已填写 Required Reading、Anti-Patterns 和 Infrastructure State 各 section
- [ ] 如果是在设计和执行之间暂停，已填写 Pre-Execution Critique section
- [ ] 已作为 WIP 提交
- [ ] 用户知道文件位置以及如何恢复
</success_criteria>
