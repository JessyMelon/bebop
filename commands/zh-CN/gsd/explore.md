---
name: gsd:explore
description: 苏格拉底式构思与想法分流，在提交计划前先把想法想清楚
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Task
  - AskUserQuestion
---
<objective>
开放式的苏格拉底式构思会话。通过追问引导开发者探索一个想法，可选地发起研究，然后将结果路由到合适的 GSD 产物（notes、todos、seeds、research questions、requirements 或 new phases）。

接受一个可选的话题参数：`/gsd-explore authentication strategy`
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/explore.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/explore.md 中的 explore workflow。
</process>
