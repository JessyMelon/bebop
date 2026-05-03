---
name: gsd:codewiki-verify
description: Verify CodeWiki freshness, baseline completeness, maintenance tasks, evidence, and blocked queues
argument-hint: "[--set <set-id>] [--maintenance-only]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Verify CodeWiki freshness, baseline completeness, and maintenance state.

This command is read-only. It checks `maintenance-plan.json`, `progress.json`, and `task-queue.json` so completed tasks are source-backed, blocked tasks have concrete reasons, init-only starter queues do not pass verified gates, and unresolved work is visible before freeze or milestone close.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-verify.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-verify workflow from `@~/.claude/get-shit-done/workflows/codewiki-verify.md`.
</process>
