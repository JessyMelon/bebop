---
name: gsd:audit-milestone
description: 在归档前根据最初意图审计 milestone 是否完成
argument-hint: "[version]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---
<objective>
验证 milestone 是否达成其完成定义。检查需求覆盖情况、跨 phase 集成以及端到端流程。

**此命令本身就是编排器。** 它会读取现有 `VERIFICATION.md` 文件（这些 phases 已在 `execute-phase` 期间完成验证），汇总技术债和延期缺口，然后启动集成检查器以验证跨 phase 连接。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/audit-milestone.md
</execution_context>

<context>
Version：$ARGUMENTS（可选，默认当前 milestone）

核心规划文件会在工作流中通过 `init milestone-op` 按需解析并加载。

**已完成工作：**
Glob: .planning/phases/*/*-SUMMARY.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/audit-milestone.md` 中的 audit-milestone 工作流。
保留所有工作流关卡（范围判定、验证读取、集成检查、需求覆盖、路由）。
</process>
