<purpose>
Cross-AI peer review：调用外部 AI CLI，独立审查 phase plans。
每个 CLI 都会收到相同的 prompt（PROJECT.md 上下文、phase plans、requirements），
并产出结构化反馈。结果会合并到 REVIEWS.md，供 planner 通过 `--reviews` flag 吸收。

这实现的是 adversarial review：不同 AI model 会捕捉到不同的盲点。
一个能通过 2-3 个独立 AI 系统审查的 plan，通常会更稳健。
</purpose>

<process>

<step name="detect_clis">
检查系统上可用的 AI CLI：

```bash
# Check each CLI
command -v gemini >/dev/null 2>&1 && echo "gemini:available" || echo "gemini:missing"
command -v claude >/dev/null 2>&1 && echo "claude:available" || echo "claude:missing"
command -v codex >/dev/null 2>&1 && echo "codex:available" || echo "codex:missing"
command -v coderabbit >/dev/null 2>&1 && echo "coderabbit:available" || echo "coderabbit:missing"
command -v opencode >/dev/null 2>&1 && echo "opencode:available" || echo "opencode:missing"
command -v qwen >/dev/null 2>&1 && echo "qwen:available" || echo "qwen:missing"
command -v cursor >/dev/null 2>&1 && echo "cursor:available" || echo "cursor:missing"
```

从 `$ARGUMENTS` 解析 flags：
- `--gemini` → 包含 Gemini
- `--claude` → 包含 Claude
- `--codex` → 包含 Codex
- `--coderabbit` → 包含 CodeRabbit
- `--opencode` → 包含 OpenCode
- `--qwen` → 包含 Qwen Code
- `--cursor` → 包含 Cursor
- `--all` → 包含所有可用项
- 无 flags → 包含所有可用项

如果没有可用的 CLI：
```
未找到外部 AI CLI。请至少安装一个：
- gemini: https://github.com/google-gemini/gemini-cli
- codex: https://github.com/openai/codex
- claude: https://github.com/anthropics/claude-code
- opencode: https://opencode.ai (leverages GitHub Copilot subscription models)
- qwen: https://github.com/nicepkg/qwen-code (Alibaba Qwen models)
- cursor: https://cursor.com (Cursor IDE agent mode)

然后再次运行 /gsd-review。
```
退出。

根据当前运行环境判断要跳过哪个 CLI：

```bash
# Environment-based runtime detection (priority order)
if [ "$ANTIGRAVITY_AGENT" = "1" ]; then
  # Antigravity is a separate client — all CLIs are external, skip none
  SELF_CLI="none"
elif [ -n "$CURSOR_SESSION_ID" ]; then
  # Running inside Cursor agent — skip cursor for independence
  SELF_CLI="cursor"
elif [ -n "$CLAUDE_CODE_ENTRYPOINT" ]; then
  # Running inside Claude Code CLI — skip claude for independence
  SELF_CLI="claude"
else
  # Other environments (Gemini CLI, Codex CLI, etc.)
  # Fall back to AI self-identification to decide which CLI to skip
  SELF_CLI="auto"
fi
```

规则：
- 如果 `SELF_CLI="none"` → 调用所有可用 CLI（不跳过）
- 如果 `SELF_CLI="claude"` → 跳过 claude，使用 gemini/codex
- 如果 `SELF_CLI="auto"` → 由执行中的 AI 自行识别身份并跳过自己的 CLI
- 继续执行 review 前，至少要有一个 DIFFERENT CLI 可用。
</step>

<step name="gather_context">
收集 review prompt 所需的 phase 产物：

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init 读取：`phase_dir`, `phase_number`, `padded_phase`。

然后读取：
1. `.planning/PROJECT.md`（前 80 行，项目上下文）
2. `.planning/ROADMAP.md` 中对应的 phase section
3. 该 phase 目录下所有 `*-PLAN.md` 文件
4. 如果存在则读取 `*-CONTEXT.md`（用户决策）
5. 如果存在则读取 `*-RESEARCH.md`（领域研究）
6. `.planning/REQUIREMENTS.md`（该 phase 处理的 requirements）
</step>

<step name="build_prompt">
构建结构化 review prompt：

```markdown
# Cross-AI Plan Review Request

你正在审查某个软件项目 phase 的 implementation plans。
请针对 plan 质量、完整性与风险提供结构化反馈。

## Project Context
{PROJECT.md 的前 80 行}

## Phase {N}: {phase name}
### Roadmap Section
{roadmap 中该 phase 的 section}

### Requirements Addressed
{该 phase 覆盖的 requirements}

### User Decisions (CONTEXT.md)
{如存在则填入 context}

### Research Findings
{如存在则填入 research}

### Plans to Review
{所有 PLAN.md 的内容}

## Review Instructions

分析每个 plan，并提供：

1. **Summary** — 一段话总结评估
2. **Strengths** — 设计得好的地方（bullet points）
3. **Concerns** — 潜在问题、缺口、风险（bullet points，严重级别使用 HIGH/MEDIUM/LOW）
4. **Suggestions** — 具体改进建议（bullet points）
5. **Risk Assessment** — 整体风险级别（LOW/MEDIUM/HIGH）及其理由

重点关注：
- 缺失的 edge case 或错误处理
- 依赖顺序问题
- scope creep 或过度设计
- 安全性考虑
- 性能影响
- 这些 plans 是否真的能实现该 phase 的目标

请以 markdown 格式输出你的 review。
```

写入临时文件：`/tmp/gsd-review-prompt-{phase}.md`
</step>

<step name="invoke_reviewers">
从 planning config 读取 model 偏好。值为 null 或缺失时回退到 CLI 默认值。

```bash
# JSON scalars from gsd-sdk query; use jq -r to strip JSON string quotes (install jq if missing)
GEMINI_MODEL=$(gsd-sdk query config-get review.models.gemini 2>/dev/null | jq -r '.' 2>/dev/null || true)
CLAUDE_MODEL=$(gsd-sdk query config-get review.models.claude 2>/dev/null | jq -r '.' 2>/dev/null || true)
CODEX_MODEL=$(gsd-sdk query config-get review.models.codex 2>/dev/null | jq -r '.' 2>/dev/null || true)
OPENCODE_MODEL=$(gsd-sdk query config-get review.models.opencode 2>/dev/null | jq -r '.' 2>/dev/null || true)
```

对每个已选 CLI 按顺序调用（不要并行，避免触发 rate limits）：

**Gemini：**
```bash
if [ -n "$GEMINI_MODEL" ] && [ "$GEMINI_MODEL" != "null" ]; then
  cat /tmp/gsd-review-prompt-{phase}.md | gemini -m "$GEMINI_MODEL" -p - 2>/dev/null > /tmp/gsd-review-gemini-{phase}.md
else
  cat /tmp/gsd-review-prompt-{phase}.md | gemini -p - 2>/dev/null > /tmp/gsd-review-gemini-{phase}.md
fi
```

**Claude（独立 session）：**
```bash
if [ -n "$CLAUDE_MODEL" ] && [ "$CLAUDE_MODEL" != "null" ]; then
  cat /tmp/gsd-review-prompt-{phase}.md | claude --model "$CLAUDE_MODEL" -p - 2>/dev/null > /tmp/gsd-review-claude-{phase}.md
else
  cat /tmp/gsd-review-prompt-{phase}.md | claude -p - 2>/dev/null > /tmp/gsd-review-claude-{phase}.md
fi
```

**Codex：**
```bash
if [ -n "$CODEX_MODEL" ] && [ "$CODEX_MODEL" != "null" ]; then
  cat /tmp/gsd-review-prompt-{phase}.md | codex exec --model "$CODEX_MODEL" --skip-git-repo-check - 2>/dev/null > /tmp/gsd-review-codex-{phase}.md
else
  cat /tmp/gsd-review-prompt-{phase}.md | codex exec --skip-git-repo-check - 2>/dev/null > /tmp/gsd-review-codex-{phase}.md
fi
```

**CodeRabbit：**

注意：CodeRabbit 会审查当前 git diff/working tree，不接受 prompt 或 model flag。它可能最多需要 5 分钟。对 Bash tool 调用使用 `timeout: 360000`。

```bash
coderabbit review --prompt-only 2>/dev/null > /tmp/gsd-review-coderabbit-{phase}.md
```

**OpenCode（通过 GitHub Copilot）：**
```bash
if [ -n "$OPENCODE_MODEL" ] && [ "$OPENCODE_MODEL" != "null" ]; then
  cat /tmp/gsd-review-prompt-{phase}.md | opencode run --model "$OPENCODE_MODEL" - 2>/dev/null > /tmp/gsd-review-opencode-{phase}.md
else
  cat /tmp/gsd-review-prompt-{phase}.md | opencode run - 2>/dev/null > /tmp/gsd-review-opencode-{phase}.md
fi
if [ ! -s /tmp/gsd-review-opencode-{phase}.md ]; then
  echo "OpenCode review failed or returned empty output." > /tmp/gsd-review-opencode-{phase}.md
fi
```

**Qwen Code：**
```bash
cat /tmp/gsd-review-prompt-{phase}.md | qwen - 2>/dev/null > /tmp/gsd-review-qwen-{phase}.md
if [ ! -s /tmp/gsd-review-qwen-{phase}.md ]; then
  echo "Qwen review failed or returned empty output." > /tmp/gsd-review-qwen-{phase}.md
fi
```

**Cursor：**
```bash
cat /tmp/gsd-review-prompt-{phase}.md | cursor agent -p --mode ask --trust 2>/dev/null > /tmp/gsd-review-cursor-{phase}.md
if [ ! -s /tmp/gsd-review-cursor-{phase}.md ]; then
  echo "Cursor review failed or returned empty output." > /tmp/gsd-review-cursor-{phase}.md
fi
```

如果某个 CLI 失败，记录错误并继续处理剩余 CLI。

显示进度：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CROSS-AI REVIEW — Phase {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在用 {CLI} 审查... 完成 ✓
◆ 正在用 {CLI} 审查... 完成 ✓
```
</step>

<step name="write_reviews">
将所有 review 响应合并到 `{phase_dir}/{padded_phase}-REVIEWS.md`：

```markdown
---
phase: {N}
reviewers: [gemini, claude, codex, coderabbit, opencode, qwen, cursor]
reviewed_at: {ISO timestamp}
plans_reviewed: [{list of PLAN.md files}]
---

# Cross-AI Plan Review — Phase {N}

## Gemini Review

{gemini review content}

---

## Claude Review

{claude review content}

---

## Codex Review

{codex review content}

---

## CodeRabbit Review

{coderabbit review content}

---

## OpenCode Review

{opencode review content}

---

## Qwen Review

{qwen review content}

---

## Cursor Review

{cursor review content}

---

## Consensus Summary

{synthesize common concerns across all reviewers}

### Agreed Strengths
{strengths mentioned by 2+ reviewers}

### Agreed Concerns
{concerns raised by 2+ reviewers — highest priority}

### Divergent Views
{where reviewers disagreed — worth investigating}
```

提交：
```bash
gsd-sdk query commit "docs: cross-AI review for phase {N}" {phase_dir}/{padded_phase}-REVIEWS.md
```
</step>

<step name="present_results">
显示摘要：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► REVIEW COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase {N} 已由 {count} 个 AI 系统审查。

共识问题：
{top 3 shared concerns}

完整 review：{padded_phase}-REVIEWS.md

要在 planning 中吸收这些反馈：
  /gsd-plan-phase {N} --reviews
```

清理临时文件。
</step>

</process>

<success_criteria>
- [ ] 至少成功调用了一个外部 CLI
- [ ] 已写入带结构化反馈的 REVIEWS.md
- [ ] 已根据多个 reviewer 综合出 consensus summary
- [ ] 已清理临时文件
- [ ] 用户知道如何使用这些反馈（/gsd-plan-phase --reviews）
</success_criteria>
