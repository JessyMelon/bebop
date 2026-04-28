---
name: gsd:plan-milestone-gaps
description: 为里程碑审计识别出的所有缺口创建 phase
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<objective>
创建关闭 `/gsd-audit-milestone` 识别出的缺口所需的全部 phase。

读取 MILESTONE-AUDIT.md，将缺口按逻辑分组为 phase，在 ROADMAP.md 中创建 phase 条目，并提供为每个 phase 制定计划的选项。

一条命令即可创建所有修复 phase，无需针对每个缺口手动运行 `/gsd-add-phase`。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plan-milestone-gaps.md
</execution_context>

<context>
**Audit results:**
Glob: .planning/v*-MILESTONE-AUDIT.md (use most recent)

原始意图和当前规划状态会在 workflow 内按需加载。
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/plan-milestone-gaps.md 中的 plan-milestone-gaps workflow。
保留所有 workflow 关卡（审计加载、优先级排序、phase 分组、用户确认、roadmap 更新）。
</process>
