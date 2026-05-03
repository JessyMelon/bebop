---
name: gsd:codewiki-apply-review
description: 将已确认的 CodeWiki review 答案应用到 durable wiki pages
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
将 repo CodeWiki `09-review/` 区域中已确认的人工 review 答案应用到 durable repo-level CodeWiki pages。

适用于 `/gsd-codewiki-review <repo-id> --interactive` 之后，或手动填写 `09-review/human-review.md` 之后。这是受控写入步骤：可更新受影响 wiki pages、`09-review/open-questions.md`、`00-meta/progress.json` 和 `00-meta/task-queue.json`。不得修改业务代码、repo manifest、set manifest 或无关 wiki pages。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-apply-review.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-apply-review.md` 中的 codewiki-apply-review workflow。
</process>

