---
name: gsd:ui-phase
description: 为前端 phases 生成 UI 设计契约（UI-SPEC.md）
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - AskUserQuestion
  - mcp__context7__*
---
<objective>
为某个前端 phase 创建 UI 设计契约（UI-SPEC.md）。
编排 gsd-ui-researcher 和 gsd-ui-checker。
流程：Validate → Research UI → Verify UI-SPEC → Done
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/ui-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase 编号：$ARGUMENTS，可选；若省略则自动检测下一个尚未规划的 phase。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/ui-phase.md`。
保留所有工作流关卡。
</process>
