---
name: gsd:codewiki-verify
description: 验证 CodeWiki freshness、baseline 完整度、维护任务、证据和 blocked queue
argument-hint: "[--set <set-id>] [--maintenance-only]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
验证 CodeWiki freshness、baseline 完整度和维护状态。

该命令只读。它检查 `maintenance-plan.json`、`progress.json` 和 `task-queue.json`，确保完成任务有源码证据，blocked 任务有具体原因，init-only starter queue 不会通过 verified gate，未解决工作在 freeze 或 milestone close 前可见。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-verify.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-verify.md` 中的 codewiki-verify workflow。
</process>
