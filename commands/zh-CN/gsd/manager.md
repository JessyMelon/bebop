---
name: gsd:manager
description: 在一个终端中管理多个 phases 的交互式命令中心
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Skill
  - Task
---
<objective>
用于管理一个 milestone 的单终端命令中心。显示包含所有 phases 的仪表盘和可视化状态指示，推荐最佳下一步操作，并分派工作；discuss 内联执行，plan/execute 作为后台 agents 运行。

面向希望在一个终端里并行处理多个 phases 的高阶用户：可以在一个 phase 上 discuss，同时让另一个 phase 在后台 plan 或 execute。

**创建/更新：**
- 不直接创建文件，而是通过 Skill() 和后台 Task agents 分派到已有 GSD commands。
- 读取 `.planning/STATE.md`、`.planning/ROADMAP.md` 和各 phase 目录以获取状态。

**之后：** 用户在管理完成后退出，或当所有 phases 完成时提示进入 milestone 生命周期的下一步。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/manager.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
不需要参数。要求存在一个活动 milestone，并且包含 ROADMAP.md 和 STATE.md。

项目上下文、phase 列表、依赖关系和推荐项都在 workflow 内通过 `gsd-sdk query init.manager` 解析。无需预先加载上下文。
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/manager.md 中的 manager workflow。
保持 dashboard 刷新循环，直到用户退出或所有 phases 完成。
</process>
