---
name: gsd:validate-phase
description: 对已完成的 phase 进行回溯审计并补齐 Nyquist 验证缺口
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
审计已完成 phase 的 Nyquist 验证覆盖情况。三种状态：
- (A) 已存在 `VALIDATION.md` — 审计并补齐缺口
- (B) 没有 `VALIDATION.md`，但存在 `SUMMARY.md` — 从产物重建
- (C) Phase 尚未执行 — 给出指引后退出

输出：更新后的 `VALIDATION.md` + 生成的测试文件。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/validate-phase.md
</execution_context>

<context>
Phase：$ARGUMENTS，可选；默认使用最近完成的 phase。
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/validate-phase.md`。
保留所有工作流关卡。
</process>
