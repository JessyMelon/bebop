---
name: gsd:remove-phase
description: 从 roadmap 中移除未来 phase，并对后续 phase 重新编号
argument-hint: <phase-number>
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---
<objective>
从 roadmap 中移除一个尚未开始的未来 phase，并对其后的所有 phase 重新编号，以保持清晰的线性顺序。

Purpose: 干净地移除你决定不做的工作，而不是用 cancelled/deferred 标记污染上下文。
Output: 删除该 phase、重新编号所有后续 phase，并进行一次 Git 提交作为历史记录。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/remove-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS

Roadmap 和 state 会在 workflow 内通过 `init phase-op` 和定向读取来解析。
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/remove-phase.md 中的 remove-phase workflow。
保留所有校验关卡（未来 phase 检查、工作检查）、重新编号逻辑和提交。
</process>
