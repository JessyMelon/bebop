---
name: gsd:codewiki-update
description: 在已验证代码变更后从源码 diff 更新 CodeWiki
argument-hint: "[--phase N|--milestone VERSION|--base SHA --head SHA] [--set <set-id>]"
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
从一个 repo 或多仓库 set 中已验证的代码变更更新 CodeWiki。

更新必须由 source evidence 驱动。DeepWiki 和 Repomix output 只能作为 seed 或 context，不能作为最终证据。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-update.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-update.md` 中的 codewiki-update workflow。
</process>

