---
name: gsd:pr-branch
description: 过滤掉 .planning/ 提交，创建干净的 PR 分支，便于代码评审
argument-hint: "[target branch, default: main]"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

<objective>
通过从当前分支中过滤掉 `.planning/` 提交，创建一个适合 pull request 的干净分支。评审者只会看到代码变更，而不会看到 GSD 规划产物。

这解决了 PR diff 被 PLAN.md、SUMMARY.md、STATE.md 等与代码评审无关的变更弄得杂乱的问题。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/pr-branch.md
</execution_context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/pr-branch.md 中的 pr-branch workflow。
</process>
