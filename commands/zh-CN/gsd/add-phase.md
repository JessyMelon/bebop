---
name: gsd:add-phase
description: 在 roadmap 中向当前 milestone 末尾添加 phase
argument-hint: <description>
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
在 roadmap 中向当前 milestone 的末尾添加一个新的整数 phase。

路由到 add-phase 工作流，该工作流负责：
- phase 编号计算（下一个顺序整数）
- 使用 slug 生成创建目录
- 更新 roadmap 结构
- 跟踪 `STATE.md` 中的 roadmap 演进
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/add-phase.md
</execution_context>

<context>
参数：$ARGUMENTS（phase 描述）

Roadmap 和 state 会在工作流中通过 `init phase-op` 与定向工具调用解析。
</context>

<process>
**遵循** `@~/.claude/get-shit-done/workflows/add-phase.md` **中的 add-phase 工作流**。

该工作流处理全部逻辑，包括：
1. 参数解析与校验
2. 检查 roadmap 是否存在
3. 识别当前 milestone
4. 计算下一个 phase 编号（忽略小数）
5. 根据描述生成 slug
6. 创建 phase 目录
7. 插入 roadmap 条目
8. 更新 `STATE.md`
</process>
