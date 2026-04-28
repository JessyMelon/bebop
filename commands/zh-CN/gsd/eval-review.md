---
name: gsd:eval-review
description: 对已执行的 AI phase 进行回溯式评估覆盖审计，将每个 eval 维度评分为 COVERED/PARTIAL/MISSING，并生成带修复计划、可执行的 `EVAL-REVIEW.md`
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
对已完成的 AI phase 进行回溯式评估覆盖审计。
检查 `AI-SPEC.md` 中的评估策略是否已被实现。
生成包含分数、结论、缺口和修复计划的 `EVAL-REVIEW.md`。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/eval-review.md
@~/.claude/get-shit-done/references/ai-evals.md
</execution_context>

<context>
Phase：$ARGUMENTS，可选；默认最后一个已完成 phase。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/eval-review.md`。
保留所有工作流关卡。
</process>
