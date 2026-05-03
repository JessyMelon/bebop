---
name: gsd:codewiki-bootstrap
description: 为选中的 repo CodeWiki namespace 运行完整 coder-llm-wiki bootstrap workflow
argument-hint: "<repo-id> [--set <set-id>] [--max-auto-steps <n>] [--allow-dirty] [--agent-seed auto|none|codex|opencode|claude-code] [--agent-seed-depth quick|full] [--agent-seed-dir <path>] [--exclude-path <glob>]... [--exclude-file <path>]"
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
在已有 repo-level CodeWiki namespace 内运行完整的 `coder-llm-wiki` bootstrap。

适用于 `/gsd-codewiki-init` 后 namespace 仍只有 starter contracts，或现有 baseline 太浅的情况。该命令会驱动可选 code-agent seed、source-scope 过滤、inventory、index、module 分析、flow 分析、review 和 snapshot，所有结论都必须有源码证据支撑。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/codewiki-bootstrap.md
</execution_context>

<context>
Arguments：$ARGUMENTS
</context>

<process>
执行 `@~/.claude/get-shit-done/workflows/codewiki-bootstrap.md` 中的 codewiki-bootstrap workflow。
</process>

