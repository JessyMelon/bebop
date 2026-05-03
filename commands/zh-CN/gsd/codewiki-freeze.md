---
name: gsd:codewiki-freeze
description: 为已发布版本冻结 CodeWiki namespace 或多仓库 set
argument-hint: "<version> [--set <set-id>] [--allow-unverified]"
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
为已发布版本冻结一个 CodeWiki namespace 或完整 CodeWiki set。

冻结后的 namespace 和 set 应拒绝普通增量更新。freeze 后只能写 review notes 或显式创建新的 namespace。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-freeze.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-freeze.md` 中的 codewiki-freeze workflow。
</process>

