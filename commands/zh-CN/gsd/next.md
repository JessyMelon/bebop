---
name: gsd:next
description: 自动推进到 GSD workflow 中下一个合乎逻辑的步骤
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - SlashCommand
---
<objective>
检测当前项目状态，并自动调用下一个合乎逻辑的 GSD workflow 步骤。
无需参数，会读取 STATE.md、ROADMAP.md 和各 phase 目录来判断下一步。

为快速多项目 workflow 设计，避免记住当前处于哪个 phase 或步骤的额外负担。

支持 `--force` flag，可绕过安全关卡（checkpoint、错误状态、验证失败以及前序 phase 完整性扫描）。

在路由到下一步之前，会扫描所有先前 phase 中未完成的工作：运行了计划但未生成总结、存在未被覆盖的验证失败，以及进行了讨论但从未运行计划的 phase。发现未完成工作时，会显示结构化报告，并提供三个选项：将缺口延后到 backlog 并继续、停止并手动解决，或不做记录直接强行推进。若先前 phase 干净，则静默路由，不会中断。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/next.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/next.md 中的 next workflow。
</process>
