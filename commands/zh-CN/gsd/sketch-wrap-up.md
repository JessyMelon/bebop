---
name: gsd:sketch-wrap-up
description: 将 sketch 设计发现整理为可在后续构建对话中复用的持久项目 skill
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
---
<objective>
整理 sketch 设计发现，并将其打包为一个持久的项目 skill，使 Claude 在构建真实 UI 时自动加载。也会向 `.planning/sketches/` 写入摘要，用于保留项目历史。输出 skill 位于 `./.claude/skills/sketch-findings-[project]/`（项目本地）。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/sketch-wrap-up.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<runtime_note>
**Copilot (VS Code)：** 凡是该工作流调用 `AskUserQuestion` 的地方，都改用 `vscode_askquestions`。
</runtime_note>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/sketch-wrap-up.md` 中的 sketch-wrap-up 工作流。
保留所有整理关卡（逐 sketch 审查、分组批准、CLAUDE.md 路由行）。
</process>
