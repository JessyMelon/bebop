---
name: gsd:check-todos
description: 列出待处理 todos 并选择一个开始处理
argument-hint: [area filter]
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
列出所有待处理 todos，允许用户选择，加载所选 todo 的完整上下文，并路由到合适动作。

路由到 check-todos 工作流，该工作流负责：
- 统计和列出 todos，并支持按 area 过滤
- 交互式选择并加载完整上下文
- 检查与 roadmap 的关联
- 动作路由（立即处理、加入 phase、brainstorm、创建 phase）
- 更新 `STATE.md` 和 Git 提交
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/check-todos.md
</execution_context>

<context>
参数：$ARGUMENTS（可选 area 过滤器）

Todo 状态和 roadmap 关联会在工作流中通过 `init todos` 和定向读取加载。
</context>

<process>
**遵循** `@~/.claude/get-shit-done/workflows/check-todos.md` **中的 check-todos 工作流**。

该工作流处理全部逻辑，包括：
1. 检查 todo 是否存在
2. area 过滤
3. 交互式列出与选择
4. 加载完整上下文及文件摘要
5. 检查 roadmap 关联
6. 提供并执行动作
7. 更新 `STATE.md`
8. Git 提交
</process>
