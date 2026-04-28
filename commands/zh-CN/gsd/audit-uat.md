---
name: gsd:audit-uat
description: 对所有尚未完成的 UAT 和验证项进行跨 phase 审计
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---
<objective>
扫描所有 phase 中待处理、跳过、阻塞和 `human_needed` 的 UAT 条目。与代码库交叉核对以检测文档是否陈旧。生成按优先级排序的人类测试计划。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/audit-uat.md
</execution_context>

<context>
核心规划文件会在工作流中通过 CLI 加载。

**范围：**
Glob: .planning/phases/*/*-UAT.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>
