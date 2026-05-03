---
name: gsd:codewiki-contract
description: 创建或注册 set-level CodeWiki cross-repo contract
argument-hint: "<name> --set <set-id> --producer <repo-id> --consumers <repo-id,repo-id>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
创建或注册 set-level CodeWiki cross-repo contract document，并从 `wiki-set.yaml` 链接它。

该命令只写 scaffolding。结果 contract 在填入真实代码中的 source paths、line ranges、producer evidence 和 consumer evidence 前保持 blocked。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-contract.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-contract.md` 中的 codewiki-contract workflow。
</process>

