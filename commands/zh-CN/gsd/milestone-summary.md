---
type: prompt
name: gsd:milestone-summary
description: 根据 milestone 产物生成完整的项目摘要，用于团队上手和审查
argument-hint: "[version]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
生成结构化的 milestone 摘要，用于团队上手和项目审查。读取已完成 milestone 的产物（ROADMAP、REQUIREMENTS、CONTEXT、SUMMARY、VERIFICATION 文件），生成一份便于阅读的概览，说明构建了什么、如何构建以及为什么这样构建。

目的：让新团队成员通过阅读一份文档并继续追问，就能理解一个已完成的项目。
输出：将 MILESTONE_SUMMARY 写入 `.planning/reports/`，内联展示，并可选择交互式问答。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/milestone-summary.md
</execution_context>

<context>
**项目文件：**
- `.planning/ROADMAP.md`
- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/RETROSPECTIVE.md`
- `.planning/milestones/v{version}-ROADMAP.md`（如已归档）
- `.planning/milestones/v{version}-REQUIREMENTS.md`（如已归档）
- `.planning/phases/*-*/`（SUMMARY.md、VERIFICATION.md、CONTEXT.md、RESEARCH.md）

**用户输入：**
- 版本：$ARGUMENTS（可选，默认当前/最新 milestone）
</context>

<process>
读取并端到端执行 @~/.claude/get-shit-done/workflows/milestone-summary.md 中的 milestone-summary workflow。
</process>

<success_criteria>
- 已解析 milestone version（来自参数、STATE.md 或归档扫描）
- 已读取所有可用产物（ROADMAP、REQUIREMENTS、CONTEXT、SUMMARY、VERIFICATION、RESEARCH、RETROSPECTIVE）
- 已将摘要文档写入 `.planning/reports/MILESTONE_SUMMARY-v{version}.md`
- 已生成全部 7 个部分（Overview、Architecture、Phases、Decisions、Requirements、Tech Debt、Getting Started）
- 已向用户内联展示摘要
- 已提供交互式问答
- 已更新 STATE.md
</success_criteria>
