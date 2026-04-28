---
name: gsd:review
description: 请求外部 AI CLI 对 phase plan 进行跨 AI 同行评审
argument-hint: "--phase N [--gemini] [--claude] [--codex] [--opencode] [--qwen] [--cursor] [--all]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

<objective>
调用外部 AI CLI（Gemini、Claude、Codex、OpenCode、Qwen Code、Cursor）对 phase plan 进行独立评审。
生成结构化的 REVIEWS.md，其中包含每个 reviewer 的反馈，可通过 /gsd-plan-phase --reviews 回流到规划中。

**Flow:** 检测 CLI → 构建评审 prompt → 调用各 CLI → 收集响应 → 写入 REVIEWS.md
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/review.md
</execution_context>

<context>
Phase number: 从 $ARGUMENTS 中提取（必填）

**Flags:**
- `--gemini` — 包含 Gemini CLI 评审
- `--claude` — 包含 Claude CLI 评审（使用独立会话）
- `--codex` — 包含 Codex CLI 评审
- `--opencode` — 包含 OpenCode 评审（使用用户 OpenCode 配置中的 model）
- `--qwen` — 包含 Qwen Code 评审（Alibaba Qwen models）
- `--cursor` — 包含 Cursor agent 评审
- `--all` — 包含所有可用 CLI
</context>

<process>
端到端执行 @~/.claude/get-shit-done/workflows/review.md 中的 review workflow。
</process>
