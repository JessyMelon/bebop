---
name: gsd:ai-integration-phase
description: 为涉及 AI 系统构建的 phase 生成 AI 设计契约（AI-SPEC.md），包括框架选择、基于官方文档的实现指导和评估策略
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - WebSearch
  - AskUserQuestion
  - mcp__context7__*
---
<objective>
为涉及 AI 系统开发的 phase 创建 AI 设计契约（AI-SPEC.md）。
编排 gsd-framework-selector → gsd-ai-researcher → gsd-domain-researcher → gsd-eval-planner。
流程：选择框架 → 研究文档 → 研究领域 → 设计评估策略 → 完成
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/ai-integration-phase.md
@~/.claude/get-shit-done/references/ai-frameworks.md
@~/.claude/get-shit-done/references/ai-evals.md
</execution_context>

<context>
Phase 编号：$ARGUMENTS，可选；如省略则自动检测下一个未规划的 phase。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/ai-integration-phase.md`。
保留所有工作流关卡。
</process>
