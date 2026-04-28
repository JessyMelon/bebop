---
name: gsd:resume-work
description: 从上一会话恢复工作，并完整还原上下文
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
  - SlashCommand
---

<objective>
完整恢复项目上下文，并从上一会话无缝继续工作。

会路由到 resume-project workflow，由其负责：

- 加载 STATE.md（若缺失则重建）
- 检测 checkpoint（`.continue-here` 文件）
- 检测未完成工作（有 PLAN 但没有 SUMMARY）
- 展示状态
- 基于上下文路由到下一步动作
  </objective>

<execution_context>
@~/.claude/get-shit-done/workflows/resume-project.md
</execution_context>

<process>
**遵循** `@~/.claude/get-shit-done/workflows/resume-project.md` 中的 resume-project workflow。

该 workflow 负责全部恢复逻辑，包括：

1. 校验项目是否存在
2. 加载或重建 STATE.md
3. 检测 checkpoint 和未完成工作
4. 以可视化方式展示状态
5. 提供上下文感知选项（在建议 plan 或 discuss 前先检查 CONTEXT.md）
6. 路由到合适的下一条命令
7. 更新会话连续性
   </process>
