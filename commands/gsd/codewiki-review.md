---
name: gsd:codewiki-review
description: Produce human review questions for a repo CodeWiki
argument-hint: "<repo-id> [--set <set-id>] [--scope all|business|contracts|operations|config] [--write] [--interactive] [--dry-run] [--text]"
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
Review an existing repo-level CodeWiki and produce the questions that require human confirmation.

Use this after `/gsd-codewiki-enrich` or before planning a risky change. By default this command reports a read-only review list. With `--write`, it may persist review notes under the repo wiki's `09-review/` area and blocked items in `00-meta/task-queue.json`. With `--interactive`, it asks the human-confirmation questions in-session and writes answers back unless `--dry-run` is present. It must not update business code or rewrite baseline wiki pages.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-review.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-review workflow from `@~/.claude/get-shit-done/workflows/codewiki-review.md`.
</process>
