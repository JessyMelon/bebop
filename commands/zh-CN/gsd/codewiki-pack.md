---
name: gsd:codewiki-pack
description: 为选中的 CodeWiki repos 生成 Repomix seed bundles
argument-hint: "[--set <set-id>] [--repo <repo-id>|--repos <repo-id,repo-id>] [--style xml|markdown|json|plain] [--force] [--dry-run]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
为选中的 CodeWiki repo namespace 或多仓库 set 生成 Repomix seed bundles。

Repomix output 只是 packed context，不是最终 CodeWiki 证据。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-pack.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-pack.md` 中的 codewiki-pack workflow。
</process>

