---
name: gsd:spike
description: 通过体验式探索对一个想法做 spike，或提出下一步该 spike 什么（frontier mode）
argument-hint: "[idea to validate] [--quick] [--text] or [frontier]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
  - WebFetch
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---
<objective>
通过体验式探索对一个想法做 spike：构建聚焦实验，亲身感受未来应用的组成部分，验证可行性，并为真实构建产出经过验证的知识。
Spike 保存在 `.planning/spikes/` 中，并接入 GSD 的提交模式、状态跟踪和交接工作流。

两种模式：
- **Idea mode**（默认）— 描述一个要做 spike 的想法
- **Frontier mode**（无参数或为 "frontier"）— 分析现有 spike 布局，并提出集成型 spike 与 frontier spike

不需要 `/gsd-new-project`，如有需要会自动创建 `.planning/spikes/`。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/spike.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<runtime_note>
**Copilot (VS Code)：** 凡是该工作流调用 `AskUserQuestion` 的地方，都改用 `vscode_askquestions`。
</runtime_note>

<context>
想法：$ARGUMENTS

**可用 flags：**
- `--quick` — 跳过拆解/对齐，直接进入构建。适用于你已经明确知道要 spike 什么的情况。
- `--text` — 使用纯文本编号列表，而不是 AskUserQuestion（用于非 Claude runtime）。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/spike.md` 中的 spike 工作流。
保留所有工作流关卡（先前 spike 检查、拆解、研究、风险排序、可观测性评估、验证、MANIFEST 更新、提交模式）。
</process>
