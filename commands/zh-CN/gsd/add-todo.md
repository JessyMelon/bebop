---
name: gsd:add-todo
description: 从当前对话上下文中捕获想法或任务为 todo
argument-hint: [optional description]
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
将 GSD 会话中出现的想法、任务或问题，捕获为结构化 todo，供后续处理。

路由到 add-todo 工作流，该工作流负责：
- 创建目录结构
- 从参数或对话中提取内容
- 根据文件路径推断 area
- 检测并处理重复项
- 创建带 frontmatter 的 todo 文件
- 更新 `STATE.md`
- Git 提交
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/add-todo.md
</execution_context>

<context>
参数：$ARGUMENTS（可选 todo 描述）

State 会在工作流中通过 `init todos` 和定向读取进行解析。
</context>

<process>
**遵循** `@~/.claude/get-shit-done/workflows/add-todo.md` **中的 add-todo 工作流**。

该工作流处理全部逻辑，包括：
1. 确保目录存在
2. 检查现有 area
3. 提取内容（来自参数或对话）
4. 推断 area
5. 检查重复项
6. 生成 slug 并创建文件
7. 更新 `STATE.md`
8. Git 提交
</process>
