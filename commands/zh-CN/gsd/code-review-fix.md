---
name: gsd:code-review-fix
description: 自动修复 `REVIEW.md` 中代码审查发现的问题。启动 fixer agent，对每个修复做原子提交，并生成 `REVIEW-FIX.md` 摘要。
argument-hint: "<phase-number> [--all] [--auto]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - Task
---
<objective>
自动修复代码审查发现的问题。读取指定 phase 的 `REVIEW.md`，启动 `gsd-code-fixer` agent 应用修复，并生成 `REVIEW-FIX.md` 摘要。

参数：
- Phase 编号（必填）— 要修复哪个 phase 的 `REVIEW.md`（例如：`"2"` 或 `"02"`）
- `--all`（可选）— 将 Info 级发现项也纳入修复范围（默认仅 Critical + Warning）
- `--auto`（可选）— 启用修复 + 复审迭代循环，最多 3 轮

输出：phase 目录中的 `{padded_phase}-REVIEW-FIX.md`，外加内联修复摘要
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/code-review-fix.md
</execution_context>

<context>
Phase：$ARGUMENTS（第一个位置参数为 phase 编号）

从 $ARGUMENTS 解析的可选 flags：
- `--all` — 将 Info 级发现项纳入修复范围。默认只修复 Critical + Warning。
- `--auto` — 启用修复 + 复审迭代循环。应用修复后，以相同深度重新运行 code-review。如果发现新问题则继续迭代。总共最多 3 轮。不带此 flag 时只执行一次修复。

上下文文件（`CLAUDE.md`、`REVIEW.md`、phase state）会在工作流内部通过 `gsd-sdk query init.phase-op` 解析，并通过配置块委托给 agent。
</context>

<process>
此命令只是一个轻量派发层。它负责解析参数并委托给工作流。

端到端执行 `@~/.claude/get-shit-done/workflows/code-review-fix.md` 中的 code-review-fix 工作流。

以下关卡由工作流（而不是此命令）强制执行：
- Phase 校验（配置关卡之前）
- 配置关卡检查（`workflow.code_review`）
- 检查 `REVIEW.md` 是否存在（不存在则报错）
- 检查 `REVIEW.md` 状态（若 clean/skipped 则跳过）
- 启动 agent（`gsd-code-fixer`）
- 迭代循环（如使用 `--auto`，最多 3 轮）
- 结果展示（内联摘要 + 后续步骤）
</process>
