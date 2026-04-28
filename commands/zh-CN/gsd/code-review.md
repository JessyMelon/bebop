---
name: gsd:code-review
description: 审查某个 phase 中变更过的源文件，查找 bug、安全问题和代码质量问题
argument-hint: "<phase-number> [--depth=quick|standard|deep] [--files file1,file2,...]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---
<objective>
审查某个 phase 中变更过的源文件，查找 bug、安全漏洞和代码质量问题。

启动 `gsd-code-reviewer` agent 按指定深度分析代码。在 phase 目录中生成 `REVIEW.md` 产物，并按严重级别归类发现项。

参数：
- Phase 编号（必填）— 要审查哪个 phase 的变更（例如：`"2"` 或 `"02"`）
- `--depth=quick|standard|deep`（可选）— 审查深度，覆盖 `workflow.code_review_depth` 配置
  - `quick`: 仅模式匹配（约 2 分钟）
  - `standard`: 按文件分析并做语言特定检查（约 5-15 分钟，默认）
  - `deep`: 跨文件分析，包括 import 图和调用链（约 15-30 分钟）
- `--files file1,file2,...`（可选）— 显式的逗号分隔文件列表，跳过 `SUMMARY`/git 范围判定（文件范围优先级最高）

输出：phase 目录中的 `{padded_phase}-REVIEW.md`，外加内联发现摘要
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/code-review.md
</execution_context>

<context>
Phase：$ARGUMENTS（第一个位置参数为 phase 编号）

从 $ARGUMENTS 解析的可选 flags：
- `--depth=VALUE` — 深度覆盖（`quick|standard|deep`）。提供时会覆盖 `workflow.code_review_depth` 配置。
- `--files=file1,file2,...` — 显式文件列表覆盖。根据 D-08，它在文件范围判定中优先级最高。提供后，工作流会完全跳过 `SUMMARY.md` 提取和 git diff 回退。

上下文文件（`CLAUDE.md`、`SUMMARY.md`、phase state）会在工作流内部通过 `gsd-sdk query init.phase-op` 解析，并通过 `<files_to_read>` 块委托给 agent。
</context>

<process>
此命令只是一个轻量派发层。它负责解析参数并委托给工作流。

端到端执行 `@~/.claude/get-shit-done/workflows/code-review.md` 中的 code-review 工作流。

以下关卡由工作流（而不是此命令）强制执行：
- Phase 校验（配置关卡之前）
- 配置关卡检查（`workflow.code_review`）
- 文件范围判定（`--files` 覆盖 > `SUMMARY.md` > git diff 回退）
- 空范围检查（没有文件则跳过）
- 启动 agent（`gsd-code-reviewer`）
- 结果展示（内联摘要 + 后续步骤）
</process>
