---
name: gsd:codewiki-project
description: Project selected CodeWiki context into .planning/codebase for planning
argument-hint: "[--set <set-id>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Project the selected CodeWiki namespace or multi-repo set into `.planning/codebase/codewiki-summary.md` for planner and executor consumption.

The projection is disposable planning context. CodeWiki manifests, Git commits, and source evidence remain authoritative.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-project.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-project workflow from `@~/.claude/get-shit-done/workflows/codewiki-project.md`.
</process>
