---
name: gsd:codewiki-apply-review
description: Apply confirmed CodeWiki review answers to durable wiki pages
argument-hint: "<repo-id> [--set <set-id>] [--dry-run]"
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
Apply confirmed human review answers from a repo CodeWiki's `09-review/` area into the durable repo-level CodeWiki pages.

Use this after `/gsd-codewiki-review <repo-id> --interactive` or after manually filling `09-review/human-review.md`. This command is a controlled write step: it may update affected wiki pages, `09-review/open-questions.md`, `00-meta/progress.json`, and `00-meta/task-queue.json`. It must not modify business code, repo manifests, set manifests, or unrelated wiki pages.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-apply-review.md
</execution_context>

<context>
Arguments: $ARGUMENTS
</context>

<process>
Execute the codewiki-apply-review workflow from `@~/.claude/get-shit-done/workflows/codewiki-apply-review.md`.
</process>

