---
name: gsd:secure-phase
description: 对已完成的 phase 进行事后威胁缓解验证
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
验证已完成 phase 的威胁缓解措施。共有三种状态：
- (A) SECURITY.md 已存在 — 审计并验证缓解措施
- (B) 没有 SECURITY.md，但存在包含 threat model 的 PLAN.md — 基于产物运行
- (C) Phase 尚未执行 — 退出并给出指引

Output: 更新后的 SECURITY.md。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/secure-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS — 可选，默认使用最后一个已完成的 phase。
</context>

<process>
执行 @~/.claude/get-shit-done/workflows/secure-phase.md。
保留所有 workflow 关卡。
</process>
