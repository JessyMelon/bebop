---
name: gsd:new-workspace
description: 创建隔离工作区，包含仓库副本和独立的 .planning/
argument-hint: "--name <name> [--repos repo1,repo2] [--path /target] [--strategy worktree|clone] [--branch name] [--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---
<context>
**Flags:**
- `--name` (required) — 工作区名称
- `--repos` — 逗号分隔的仓库路径或名称。若省略，则从 cwd 下的子级 git 仓库中交互选择
- `--path` — 目标目录。默认为 `~/gsd-workspaces/<name>`
- `--strategy` — `worktree`（默认，轻量）或 `clone`（完全独立）
- `--branch` — 要检出的分支。默认为 `workspace/<name>`
- `--auto` — 跳过交互提问，使用默认值
</context>

<objective>
创建一个实体工作区目录，包含指定 git 仓库的副本（以 worktree 或 clone 形式），并带有独立的 `.planning/` 目录，用于隔离的 GSD 会话。

**Use cases:**
- 多仓库编排：并行处理一部分仓库，并保持 GSD 状态隔离
- 功能分支隔离：为当前仓库创建带有独立 `.planning/` 的 worktree

**Creates:**
- `<path>/WORKSPACE.md` — 工作区清单
- `<path>/.planning/` — 独立的规划目录
- `<path>/<repo>/` — 每个指定仓库对应的 git worktree 或 clone

**After this command:** 进入该工作区并运行 `/gsd-new-project` 以初始化 GSD。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/new-workspace.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/new-workspace.md 中的 new-workspace workflow。
保留所有 workflow 关卡（校验、审批、提交、路由）。
</process>
