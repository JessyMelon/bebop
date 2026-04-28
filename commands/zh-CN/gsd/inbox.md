---
name: gsd:inbox
description: 根据项目模板和贡献指南，对所有打开的 GitHub issues 和 PRs 进行分诊与审查
argument-hint: "[--issues] [--prs] [--label] [--close-incomplete] [--repo owner/repo]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---
<objective>
用一条命令分诊项目的 GitHub inbox。获取所有打开的 issues 和 PRs，按对应模板要求（feature、enhancement、bug、chore、fix PR、enhancement PR、feature PR）逐项审查，报告完整性和合规性，并可选择打标签或关闭不合规的提交。

**流程：** 检测仓库 → 获取打开的 issues 和 PRs → 按类型分类 → 对照模板审查 → 报告发现 → 可选执行操作（label、comment、close）
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/inbox.md
</execution_context>

<context>
**Flags：**
- `--issues` — 只审查 issues（跳过 PRs）
- `--prs` — 只审查 PRs（跳过 issues）
- `--label` — 审查后自动应用推荐 labels
- `--close-incomplete` — 关闭不符合模板要求的 issues/PRs（并附上说明原因的 comment）
- `--repo owner/repo` — 覆盖自动检测到的仓库（默认使用当前 git remote）
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/inbox.md 中的 inbox workflow。
从参数中解析 flags 并传给 workflow。
</process>
