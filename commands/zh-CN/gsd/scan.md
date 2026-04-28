---
name: gsd:scan
description: 快速评估代码库，是 /gsd-map-codebase 的轻量替代方案
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---
<objective>
针对单个区域执行聚焦式代码库扫描，并在 `.planning/codebase/` 中生成有针对性的文档。
支持可选 `--focus` flag：`tech`、`arch`、`quality`、`concerns`，或 `tech+arch`（默认）。

这是 `/gsd-map-codebase` 的轻量替代方案，只启动一个 mapper agent，而不是四个并行 agent。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/scan.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/scan.md 中的 scan workflow。
</process>
