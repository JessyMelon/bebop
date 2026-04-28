---
name: gsd:plan-phase
description: 创建详细的 phase 计划（PLAN.md），带验证循环
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text] [--tdd]"
agent: gsd-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
  - WebFetch
  - mcp__context7__*
---
<objective>
为 roadmap phase 创建可执行的 phase prompt（PLAN.md 文件），并集成研究与验证。

**Default flow:** 如有需要先研究 → 规划 → 验证 → 完成

**Orchestrator role:** 解析参数、校验 phase、研究领域（除非跳过）、启动 gsd-planner、用 gsd-plan-checker 验证、迭代直到通过或达到最大轮次，并展示结果。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<runtime_note>
**Copilot (VS Code):** 当该 workflow 调用 `AskUserQuestion` 时，使用 `vscode_askquestions`。两者等价，`vscode_askquestions` 是 VS Code Copilot 对同一交互式提问 API 的实现。不要因为看起来无法使用 `AskUserQuestion` 就跳过提问步骤，改用 `vscode_askquestions` 即可。
</runtime_note>

<context>
Phase number: $ARGUMENTS（可选，省略时自动检测下一个未规划的 phase）

**Flags:**
- `--research` — 即使已存在 RESEARCH.md 也强制重新研究
- `--skip-research` — 跳过研究，直接进入规划
- `--gaps` — 缺口修复模式（读取 VERIFICATION.md，跳过研究）
- `--skip-verify` — 跳过验证循环
- `--prd <file>` — 使用 PRD/验收标准文件替代 discuss-phase。自动将需求解析到 CONTEXT.md 中，并完全跳过 discuss-phase。
- `--reviews` — 重新规划，并纳入来自 REVIEWS.md 的跨 AI 评审反馈（由 `/gsd-review` 生成）
- `--text` — 使用纯文本编号列表代替 TUI 菜单（`/rc` 远程会话中必须使用）

在进行任何目录查找之前，于第 2 步规范化 phase 输入。
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/plan-phase.md 中的 plan-phase workflow。
保留所有 workflow 关卡（校验、研究、规划、验证循环、路由）。
</process>
