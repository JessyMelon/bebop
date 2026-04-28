---
name: gsd:verify-work
description: 通过对话式 UAT 验证已构建的功能
argument-hint: "[phase number, e.g., '4']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
  - Task
---
<objective>
通过带持久状态的对话式测试来验证已构建的功能。

目的：确认 Claude 构建出的内容，站在用户视角确实可用。一次只测一个项，使用纯文本响应，不做盘问。发现问题时，自动诊断、规划修复，并为执行做好准备。

输出：`{phase_num}-UAT.md`，用于跟踪全部测试结果。若发现问题：产出已诊断的缺口，以及为 `/gsd-execute-phase` 准备好的已验证修复计划。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/verify-work.md
@~/.claude/get-shit-done/templates/UAT.md
</execution_context>

<context>
Phase：$ARGUMENTS（可选）
- 如果提供：测试指定 phase（例如 `"4"`）
- 如果未提供：检查是否有活跃会话，或提示选择 phase

上下文文件会在工作流内部解析（`init verify-work`），并通过 `<files_to_read>` 代码块下发。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/verify-work.md` 中的 verify-work 工作流。
保留所有工作流关卡（会话管理、测试展示、诊断、修复规划、路由）。
</process>
