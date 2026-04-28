---
name: gsd:plan-review-convergence
description: "跨 AI 计划收敛循环：结合评审反馈反复重规划，直到不再存在 HIGH 问题（最多 3 轮）"
argument-hint: "<phase> [--codex] [--gemini] [--claude] [--opencode] [--text] [--ws <name>] [--all] [--max-cycles N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---

<objective>
跨 AI 计划收敛循环，是围绕 gsd-review 和 gsd-planner 的外层修订关卡。
重复执行：用外部 AI CLI 评审计划；如果发现 HIGH 问题，则结合 `--reviews` 反馈重新规划；再重新评审。直到不再存在 HIGH 问题或达到最大轮次为止。

**Flow:** Agent→Skill("gsd-plan-phase") → Agent→Skill("gsd-review") → check HIGHs → Agent→Skill("gsd-plan-phase --reviews") → Agent→Skill("gsd-review") → ... → 收敛或升级处理

使用外部 AI reviewer（codex、gemini 等）替代 gsd-plan-phase 内部的 gsd-plan-checker。每一步都在独立的 Agent 内运行并调用相应的既有 Skill，orchestrator 只负责循环控制。

**Orchestrator role:** 解析参数、校验 phase、为既有 Skill 启动 Agent、检查 HIGH 问题、检测停滞、进行升级关卡判断。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/plan-review-convergence.md
@$HOME/.claude/get-shit-done/references/revision-loop.md
@$HOME/.claude/get-shit-done/references/gates.md
@$HOME/.claude/get-shit-done/references/agent-contracts.md
</execution_context>

<runtime_note>
**Copilot (VS Code):** 当该 workflow 调用 `AskUserQuestion` 时，使用 `vscode_askquestions`。两者等价，`vscode_askquestions` 是 VS Code Copilot 对同一交互式提问 API 的实现。不要因为看起来无法使用 `AskUserQuestion` 就跳过提问步骤，改用 `vscode_askquestions` 即可。
</runtime_note>

<context>
Phase number: 从 $ARGUMENTS 中提取（必填）

**Flags:**
- `--codex` — 使用 Codex CLI 作为 reviewer（未指定 reviewer 时为默认）
- `--gemini` — 使用 Gemini CLI 作为 reviewer
- `--claude` — 使用 Claude CLI 作为 reviewer（独立会话）
- `--opencode` — 使用 OpenCode 作为 reviewer
- `--all` — 使用所有可用的 CLI
- `--max-cycles N` — 最大重新规划→评审轮次（默认：3）
</context>

<process>
端到端执行 @$HOME/.claude/get-shit-done/workflows/plan-review-convergence.md 中的 plan-review-convergence workflow。
保留所有 workflow 关卡（预检、修订循环、停滞检测、升级处理）。
</process>
