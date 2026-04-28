---
name: gsd:spike-wrap-up
description: 将 spike 发现整理为可在后续构建对话中复用的持久项目 skill
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
整理 spike 实验发现，并将其打包为一个持久的项目 skill，使 Claude 在后续构建对话中自动加载。也会向 `.planning/spikes/` 写入摘要，用于保留项目历史。输出 skill 位于 `./.claude/skills/spike-findings-[project]/`（项目本地）。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/spike-wrap-up.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<runtime_note>
**Copilot (VS Code)：** 凡是该工作流调用 `AskUserQuestion` 的地方，都改用 `vscode_askquestions`。
</runtime_note>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/spike-wrap-up.md` 中的 spike-wrap-up 工作流。
保留所有工作流关卡（自动纳入、按功能区域分组、skill 合成、CLAUDE.md 路由行、智能下一步路由）。
</process>
