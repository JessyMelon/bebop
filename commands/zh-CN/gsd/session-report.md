---
name: gsd:session-report
description: 生成包含 token 用量估算、工作摘要和结果的会话报告
allowed-tools:
  - Read
  - Bash
  - Write
---
<objective>
生成结构化的 `SESSION_REPORT.md` 文档，记录本次会话的结果、已完成的工作和估算的资源用量。提供一个可供会后复盘共享的产物。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/session-report.md
</execution_context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/session-report.md` 中的 session-report 工作流。
</process>
