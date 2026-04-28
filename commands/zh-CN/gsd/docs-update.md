---
name: gsd:docs-update
description: 基于代码库验证结果生成或更新项目文档
argument-hint: "[--force] [--verify-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
为当前项目生成并更新最多 9 份文档。每种文档类型都由 `gsd-doc-writer` subagent 直接探索代码库后编写，不会出现臆造路径、虚构 endpoint 或过期签名。

Flag 处理规则：
- 下方记录的可选 flags 只是可用行为，不代表默认启用
- 只有当某个 flag 的字面 token 出现在 `$ARGUMENTS` 中时，它才算启用
- 如果文档中记录了某个 flag，但它没有出现在 `$ARGUMENTS` 中，就应视为未启用
- `--force`: 跳过保留提示，无论现有内容或 GSD 标记如何，都重新生成所有文档
- `--verify-only`: 根据代码库验证现有文档的准确性，不生成内容（完整验证需要 Phase 4 verifier）
- 如果 `$ARGUMENTS` 中同时出现 `--force` 和 `--verify-only`，则 `--force` 优先
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/docs-update.md
</execution_context>

<context>
参数：$ARGUMENTS

**可用的可选 flags（仅用于说明，不会自动启用）：**
- `--force` — 重新生成所有文档。无论是手写文档还是 GSD 文档都会被覆盖。不再提示保留。
- `--verify-only` — 根据代码库检查现有文档的准确性。不写入文件。会报告 `VERIFY` 标记数量。完整的代码库事实核验需要 `gsd-doc-verifier` agent（Phase 4）。

**必须从 `$ARGUMENTS` 推导实际启用的 flags：**
- 只有当 `$ARGUMENTS` 中存在字面 token `--force` 时，`--force` 才算启用
- 只有当 `$ARGUMENTS` 中存在字面 token `--verify-only` 时，`--verify-only` 才算启用
- 如果两个 token 都不存在，则运行标准的完整 phase 生成流程
- 不要因为某个 flag 在此提示中被记录，就推断它已启用
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/docs-update.md` 中的 docs-update 工作流。
保留所有工作流关卡（`preservation_check`、flag 处理、wave 执行、monorepo 分派、提交、报告）。
</process>
