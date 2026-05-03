---
name: gsd:codewiki-bootstrap
description: Run the full coder-llm-wiki bootstrap workflow for a selected repo CodeWiki namespace
argument-hint: "<repo-id> [--set <set-id>] [--max-auto-steps <n>] [--allow-dirty] [--agent-seed auto|none|codex|opencode|claude-code] [--agent-seed-depth quick|full] [--agent-seed-dir <path>] [--exclude-path <glob>]... [--exclude-file <path>]"
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
Run a full `coder-llm-wiki` bootstrap pass inside an existing repo-level CodeWiki namespace.

Use this after `/gsd-codewiki-init` when the namespace contains only starter contracts or when the existing baseline is too shallow. This command drives optional code-agent seed collection, source-scope filtering, inventory, index, module analysis, flow analysis, review, and snapshot using source-backed evidence.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-bootstrap.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-bootstrap workflow from `@~/.claude/get-shit-done/workflows/codewiki-bootstrap.md`.
</process>
