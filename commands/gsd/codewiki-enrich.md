---
name: gsd:codewiki-enrich
description: Enrich a repo CodeWiki baseline from codebase maps and source evidence
argument-hint: "<repo-id> [--set <set-id>] [--pages <page,page>] [--profile <name>] [--focus <text>] [--sources <path,path>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
---

<objective>
Enrich an existing repo-level CodeWiki namespace from `.planning/codebase/` maps and real source/config evidence.

Use this after `/gsd-map-codebase` or when a starter CodeWiki exists but lacks durable repo pages. This command is for baseline enrichment inside the canonical `coder-llm-wiki` taxonomy, not Git-diff maintenance after code changes.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-enrich.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-enrich workflow from `@~/.claude/get-shit-done/workflows/codewiki-enrich.md`.
</process>
