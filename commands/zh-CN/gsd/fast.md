---
name: gsd:fast
description: 直接内联执行一个琐碎任务，无需子代理，也没有规划开销
argument-hint: "[task description]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

<objective>
直接在当前上下文中执行一个琐碎任务，不启动子代理，也不生成 PLAN.md 文件。适用于小到不值得承担规划开销的任务：拼写修复、配置变更、小型重构、遗漏的提交、简单添加。

这**不是** `/gsd-quick` 的替代品；任何需要研究、多步骤规划或验证的任务都应使用 `/gsd-quick`。`/gsd-fast` 适用于那种一句话就能说清、2 分钟内就能完成的任务。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/fast.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/fast.md 中的 fast workflow。
</process>
