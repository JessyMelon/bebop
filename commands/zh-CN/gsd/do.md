---
name: gsd:do
description: 自动将自由文本路由到合适的 GSD 命令
argument-hint: "<description of what you want to do>"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
<objective>
分析自由形式的自然语言输入，并派发到最合适的 GSD 命令。

它是一个智能分发器，本身绝不直接做工作。它根据路由规则将意图匹配到最佳 GSD 命令，确认匹配后再交接。

适用于你知道自己想做什么，但不知道该运行哪个 `/gsd-*` 命令的时候。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/do.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/do.md` 中的 do 工作流。
将用户意图路由到最佳 GSD 命令并调用它。
</process>
