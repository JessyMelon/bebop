---
name: gsd:insert-phase
description: 在现有 phases 之间插入十进制 phase（如 72.1）以安排紧急工作
argument-hint: <after> <description>
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
为在 milestone 进行中发现、且必须插入到现有整数 phases 之间完成的紧急工作，插入一个十进制 phase。

使用十进制编号（72.1、72.2 等）在保留已规划 phases 逻辑顺序的同时容纳紧急插入。

目的：处理执行过程中发现的紧急工作，而无需给整个 roadmap 重新编号。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/insert-phase.md
</execution_context>

<context>
参数：$ARGUMENTS（格式：`<after-phase-number> <description>`）

Roadmap 和 state 会在 workflow 内通过 `init phase-op` 和有针对性的工具调用解析。
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/insert-phase.md 中的 insert-phase workflow。
保留所有校验 gate（参数解析、phase 校验、小数编号计算、roadmap 更新）。
</process>
