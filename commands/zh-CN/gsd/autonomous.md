---
name: gsd:autonomous
description: 自主运行所有剩余 phase，按每个 phase 依次执行 discuss→plan→execute
argument-hint: "[--from N] [--to N] [--only N] [--interactive]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
  - Agent
---
<objective>
自主执行 milestone 中所有剩余的 phases。对每个 phase：discuss → plan → execute。仅在需要用户决策时暂停（灰区接受、阻塞项、验证请求）。

使用 `ROADMAP.md` 做 phase 发现，并对每个 phase 命令进行 Skill() 平铺调用。所有 phase 完成后：milestone audit → complete → cleanup。

**会创建/更新：**
- `.planning/STATE.md` — 每个 phase 后更新
- `.planning/ROADMAP.md` — 每个 phase 后更新进度
- Phase 产物 — 每个 phase 的 `CONTEXT.md`、`PLANs`、`SUMMARYs`

**之后：** milestone 将完成并被清理。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/autonomous.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
可选 flags：
- `--from N` — 从 phase `N` 开始，而不是从第一个未完成 phase 开始。
- `--to N` — 在 phase `N` 完成后停止（不再推进到下一个 phase）。
- `--only N` — 只执行 phase `N`（单 phase 模式）。
- `--interactive` — 内联运行 discuss 并提问（不自动回答），然后将 plan→execute 作为后台 agents 分派。这样既保留用户在决策点上的输入，也让主上下文保持精简。

项目上下文、phase 列表和 state 会在工作流内部通过 init 命令（`gsd-sdk query init.milestone-op`、`gsd-sdk query roadmap.analyze`）解析，无需预先加载上下文。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/autonomous.md` 中的 autonomous 工作流。
保留所有工作流关卡（phase 发现、逐 phase 执行、阻塞处理、进度展示）。
</process>
