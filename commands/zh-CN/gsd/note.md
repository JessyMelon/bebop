---
name: gsd:note
description: 零阻力记录想法。可追加、列出或将笔记提升为 todo。
argument-hint: "<text> | list | promote <N> [--global]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
---
<objective>
零阻力记录想法，只需一次 Write 调用和一行确认。

三个子命令：
- **append**（默认）：保存带时间戳的笔记文件。不提问，不格式化。
- **list**：显示项目级和全局范围内的所有笔记。
- **promote**：将笔记转换为结构化 todo。

内联运行，不使用 Task、AskUserQuestion 或 Bash。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/note.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/note.md 中的 note workflow。
根据参数记录笔记、列出笔记或提升为 todo。
</process>
