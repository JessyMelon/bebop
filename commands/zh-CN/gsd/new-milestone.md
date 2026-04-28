---
name: gsd:new-milestone
description: 开启一个新的 milestone 周期，更新 PROJECT.md 并进入 requirements
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
启动一个新的 milestone：questioning → research（可选）→ requirements → roadmap。

这是 new-project 在 brownfield 场景下的对应命令。项目已存在，PROJECT.md 已有历史。它会收集“下一步做什么”，更新 PROJECT.md，然后运行 requirements → roadmap 流程。

**创建/更新：**
- `.planning/PROJECT.md` — 更新新的 milestone goals
- `.planning/research/` — 领域研究（可选，仅针对 NEW features）
- `.planning/REQUIREMENTS.md` — 当前 milestone 的范围化 requirements
- `.planning/ROADMAP.md` — phase 结构（延续编号）
- `.planning/STATE.md` — 为新 milestone 重置

**之后：** 运行 `/gsd-plan-phase [N]` 开始执行。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/new-milestone.md
@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/templates/project.md
@~/.claude/get-shit-done/templates/requirements.md
</execution_context>

<context>
Milestone name：$ARGUMENTS（可选，未提供时将询问）

项目和 milestone 上下文文件会在 workflow 内部解析（`init new-milestone`），并在使用 subagents 时通过 `<files_to_read>` 块传递。
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/new-milestone.md 中的 new-milestone workflow。
保留所有 workflow gates（校验、questioning、research、requirements、roadmap approval、commits）。
</process>
