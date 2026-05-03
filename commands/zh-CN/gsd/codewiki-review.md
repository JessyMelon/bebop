---
name: gsd:codewiki-review
description: 为 repo CodeWiki 生成需要人工确认的问题
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
审查已有 repo-level CodeWiki，并生成需要人工确认的问题。

默认只读输出 review list。使用 `--write` 时，可将 review notes 写入 repo wiki 的 `09-review/` 区域，并把 blocked items 写入 `00-meta/task-queue.json`。使用 `--interactive` 时，会在当前会话逐个提问并回写答案，除非同时使用 `--dry-run`。不得更新业务代码或重写 baseline wiki pages。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-review.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-review.md` 中的 codewiki-review workflow。
</process>

