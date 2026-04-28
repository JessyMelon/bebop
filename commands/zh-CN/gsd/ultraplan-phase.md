---
name: gsd:ultraplan-phase
description: "[BETA] 将 plan phase 卸载到 Claude Code 的 ultraplan 云端，在终端空闲时远程起草；可在浏览器中带行内评论审阅，并通过 /gsd-import 导回。仅限 Claude Code。"
argument-hint: "[phase-number]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
将 GSD 的 plan phase 卸载到 Claude Code 的 ultraplan 云端基础设施。

Ultraplan 会在远程云会话中起草计划，而你的终端保持空闲。
你可以在浏览器中审阅并评论该计划，然后通过 `/gsd-import --from` 将其导回。

⚠ BETA：ultraplan 目前是研究预览版。稳定的本地规划请使用 `/gsd-plan-phase`。
要求：Claude Code v2.1.91+、claude.ai 账号、GitHub 仓库。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/ultraplan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
端到端执行 ultraplan-phase 工作流。
</process>
