---
name: gsd:analyze-dependencies
description: 分析 phase 依赖关系，并为 ROADMAP.md 建议 `Depends on` 条目
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<objective>
分析当前 milestone 的 phase 依赖图。针对每一对 phase，根据以下依据判断是否存在依赖关系：
- 文件重叠（修改相同文件的 phases 必须排定顺序）
- 语义依赖（某个 phase 使用了另一个 phase 构建的 API）
- 数据流（某个 phase 消费了另一个 phase 的输出）

然后为 `ROADMAP.md` 提出 `Depends on` 更新建议。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/analyze-dependencies.md
</execution_context>

<context>
不需要参数。需要存在带 `ROADMAP.md` 的活跃 milestone。

在运行 `/gsd-manager` **之前**执行此命令，以补全缺失的 `Depends on` 字段，并避免因无序并行执行导致的合并冲突。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/analyze-dependencies.md` 中的 analyze-dependencies 工作流。
清晰展示依赖建议，并将确认后的更新应用到 `ROADMAP.md`。
</process>
