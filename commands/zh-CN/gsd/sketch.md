---
name: gsd:sketch
description: 用一次性的 HTML mockup 草绘 UI/设计想法，或提出下一步该草绘什么（frontier mode）
argument-hint: "[design idea to explore] [--quick] [--text] or [frontier]"
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
在投入实现前，通过一次性的 HTML mockup 探索设计方向。
每次 sketch 产出 2-3 个可比较的变体。Sketch 保存在 `.planning/sketches/` 中，并接入 GSD 的提交模式、状态跟踪和交接工作流。会加载 spike 发现，以真实数据形态和已验证的交互模式为 mockup 提供依据。

两种模式：
- **Idea mode**（默认）— 描述一个要草绘的设计想法
- **Frontier mode**（无参数或为 "frontier"）— 分析现有 sketch 布局，并提出一致性 sketch 与 frontier sketch

不需要 `/gsd-new-project`，如有需要会自动创建 `.planning/sketches/`。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/sketch.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/sketch-theme-system.md
@~/.claude/get-shit-done/references/sketch-interactivity.md
@~/.claude/get-shit-done/references/sketch-tooling.md
@~/.claude/get-shit-done/references/sketch-variant-patterns.md
</execution_context>

<runtime_note>
**Copilot (VS Code)：** 凡是该工作流调用 `AskUserQuestion` 的地方，都改用 `vscode_askquestions`。
</runtime_note>

<context>
设计想法：$ARGUMENTS

**可用 flags：**
- `--quick` — 跳过氛围/方向收集，直接进入拆解和构建。适用于设计方向已经很明确的情况。
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/sketch.md` 中的 sketch 工作流。
保留所有工作流关卡（收集、拆解、目标技术栈研究、变体评估、MANIFEST 更新、提交模式）。
</process>
