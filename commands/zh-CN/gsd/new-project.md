---
name: gsd:new-project
description: 通过深度上下文收集和 PROJECT.md 初始化一个新项目
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---
<runtime_note>
**Copilot (VS Code)：** 每当此 workflow 调用 `AskUserQuestion` 时，都使用 `vscode_askquestions`。两者等价，`vscode_askquestions` 是 VS Code Copilot 对同一交互式提问 API 的实现。
</runtime_note>

<context>
**Flags：**
- `--auto` — 自动模式。在配置提问结束后，无需进一步交互，直接运行 research → requirements → roadmap。期望通过 @ 引用提供想法文档。
</context>

<objective>
通过统一流程初始化一个新项目：questioning → research（可选）→ requirements → roadmap。

**创建：**
- `.planning/PROJECT.md` — 项目上下文
- `.planning/config.json` — workflow 偏好设置
- `.planning/research/` — 领域研究（可选）
- `.planning/REQUIREMENTS.md` — 范围化 requirements
- `.planning/ROADMAP.md` — phase 结构
- `.planning/STATE.md` — 项目记忆

**执行完此命令后：** 运行 `/gsd-plan-phase 1` 开始执行。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/new-project.md
@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/templates/project.md
@~/.claude/get-shit-done/templates/requirements.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/new-project.md 中的 new-project workflow。
保留所有 workflow gates（校验、审批、commits、路由）。
</process>
