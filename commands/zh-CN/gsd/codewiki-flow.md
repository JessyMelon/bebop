---
name: gsd:codewiki-flow
description: 创建或注册 set-level CodeWiki cross-repo flow
argument-hint: "<name> --set <set-id> --repos <repo-id,repo-id>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
创建或注册 set-level CodeWiki cross-repo flow document，并从 `wiki-set.yaml` 链接它。

该命令只写 scaffolding。结果 flow 在每个参与 repo 都有 source-backed evidence 前保持 blocked。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-flow.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-flow.md` 中的 codewiki-flow workflow。
</process>

