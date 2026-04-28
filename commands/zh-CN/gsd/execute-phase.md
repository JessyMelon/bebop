---
name: gsd:execute-phase
description: 使用基于 wave 的并行化执行 phase 中的所有 plans
argument-hint: "<phase-number> [--wave N] [--gaps-only] [--interactive] [--tdd]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---
<objective>
使用基于 wave 的并行执行来运行某个 phase 中的所有 plans。

编排器保持精简：发现 plans、分析依赖、按 wave 分组、启动 subagents、收集结果。每个 subagent 都会加载完整的 execute-plan 上下文，并自行处理所属 plan。

可选的 wave 过滤：
- `--wave N` 只执行 Wave `N`，适用于控制节奏、配额管理或分阶段发布
- 只有在所选 wave 完成后不再存在未完成的 plans 时，才会进行 phase 的验证/完成

Flag 处理规则：
- 下方记录的可选 flags 只是可用行为，不代表默认启用
- 只有当某个 flag 的字面 token 出现在 `$ARGUMENTS` 中时，它才算启用
- 如果文档中记录了某个 flag，但它没有出现在 `$ARGUMENTS` 中，就应视为未启用

上下文预算：编排器约 15%，每个 subagent 拥有 100% 全新上下文。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<runtime_note>
**Copilot (VS Code)：** 在该工作流调用 `AskUserQuestion` 的地方，使用 `vscode_askquestions`。两者等价，`vscode_askquestions` 是 VS Code Copilot 对同一交互提问 API 的实现。
</runtime_note>

<context>
Phase：$ARGUMENTS

**可用的可选 flags（仅用于说明，不会自动启用）：**
- `--wave N` — 只执行该 phase 中的 Wave `N`。适用于想控制执行节奏或保持在使用上限内的场景。
- `--gaps-only` — 只执行补缺 plans（frontmatter 中 `gap_closure: true` 的 plans）。适用于 `verify-work` 生成修复 plans 之后。
- `--interactive` — 以内联顺序方式执行 plans（不使用 subagents），并在任务之间设置用户检查点。token 消耗更低，类似结对编程。最适合小型 phases、bug 修复和验证缺口。

**必须从 `$ARGUMENTS` 推导实际启用的 flags：**
- 只有当 `$ARGUMENTS` 中存在字面 token `--wave` 时，`--wave N` 才算启用
- 只有当 `$ARGUMENTS` 中存在字面 token `--gaps-only` 时，`--gaps-only` 才算启用
- 只有当 `$ARGUMENTS` 中存在字面 token `--interactive` 时，`--interactive` 才算启用
- 如果这些 token 都不存在，则运行标准的完整 phase 执行流程，不做任何 flag 特定过滤
- 不要因为某个 flag 在此提示中被记录，就推断它已启用

上下文文件会在工作流内部通过 `gsd-sdk query init.execute-phase` 和每个 subagent 的 `<files_to_read>` 块进行解析。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/execute-phase.md` 中的 execute-phase 工作流。
保留所有工作流关卡（wave 执行、检查点处理、验证、状态更新、路由）。
</process>
