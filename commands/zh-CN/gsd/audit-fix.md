---
type: prompt
name: gsd:audit-fix
description: 自主 audit 到修复流水线，查找问题、分类、修复、测试并提交
argument-hint: "--source <audit-uat> [--severity <medium|high|all>] [--max N] [--dry-run]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---
<objective>
运行一次 audit，将发现项分类为可自动修复和仅能手工处理两类，然后自主修复可自动修复的问题，并进行测试验证和原子提交。

Flags:
- `--max N` — 最多修复多少条发现项（默认：5）
- `--severity high|medium|all` — 要处理的最低严重级别（默认：medium）
- `--dry-run` — 仅分类发现项而不修复（显示分类表）
- `--source <audit>` — 要运行哪个 audit（默认：audit-uat）
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/audit-fix.md
</execution_context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/audit-fix.md` 中的 audit-fix 工作流。
</process>
