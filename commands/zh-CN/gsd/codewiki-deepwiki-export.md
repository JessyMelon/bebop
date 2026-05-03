---
name: gsd:codewiki-deepwiki-export
description: 为选中的 CodeWiki repos 运行或注册 DeepWiki exports
argument-hint: "[--set <set-id>] [--repo <repo-id>|--repos <repo-id,repo-id>] [--command <template>|--register-existing] [--force] [--dry-run]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
为选中的 CodeWiki repo namespace 或多仓库 set 运行或注册 DeepWiki exports。

DeepWiki output 只是 seed material，不是最终 CodeWiki 证据。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-deepwiki-export.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-deepwiki-export.md` 中的 codewiki-deepwiki-export workflow。
</process>

