<purpose>
对已实现 AI phase 的评估覆盖率做事后审计。该命令可独立用于任何受 GSD 管理的 AI phase。产出带评分、缺口分析和修复计划的 EVAL-REVIEW.md。

在 /gsd-execute-phase 之后使用，用来确认 AI-SPEC.md 中的评估策略是否真的落地实现。模式与 /gsd-ui-review 和 /gsd-validate-phase 一致。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ai-evals.md
</required_reading>

<process>

## 0. 初始化

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析：`phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `commit_docs`。

```bash
AUDITOR_MODEL=$(gsd-sdk query resolve-model gsd-eval-auditor 2>/dev/null | jq -r '.model' 2>/dev/null || true)
```

显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► EVAL AUDIT — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. 检测输入状态

```bash
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
EVAL_REVIEW_FILE=$(ls "${PHASE_DIR}"/*-EVAL-REVIEW.md 2>/dev/null | head -1)
```

**状态 A** — 存在 AI-SPEC.md 和 SUMMARY.md：按 spec 做完整审计
**状态 B** — 存在 SUMMARY.md，但没有 AI-SPEC.md：按通用最佳实践审计
**状态 C** — 没有 SUMMARY.md：退出，提示 "Phase {N} not executed. Run /gsd-execute-phase {N} first."


**文本模式（配置中的 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对无法使用 `AskUserQuestion` 的非-Claude runtime（OpenAI Codex、Gemini CLI 等）是必需的。
**如果 `EVAL_REVIEW_FILE` 非空：** 使用 AskUserQuestion：
- header: "Existing Eval Review"
- question: "EVAL-REVIEW.md already exists for Phase {N}."
- options:
  - "Re-audit — run fresh audit"
  - "View — display current review and exit"

如果选择 "View"：显示文件并退出。
如果选择 "Re-audit"：继续。

**如果是状态 B（没有 AI-SPEC.md）：** 警告：
```
No AI-SPEC.md found for Phase {N}.
Audit will evaluate against general AI eval best practices rather than a phase-specific plan.
Consider running /gsd-ai-integration-phase {N} before implementation next time.
```
继续（非阻塞）。

## 2. 收集上下文路径

为 auditor 构建文件列表：
- AI-SPEC.md（如果存在，即计划中的 eval 策略）
- phase 目录下所有 SUMMARY.md 文件
- phase 目录下所有 PLAN.md 文件

## 3. 启动 gsd-eval-auditor

```
◆ Spawning eval auditor...
```

构建 prompt：

```markdown
Read ~/.claude/agents/gsd-eval-auditor.md for instructions.

<objective>
Conduct evaluation coverage audit of Phase {phase_number}: {phase_name}
{If AI-SPEC exists: "Audit against AI-SPEC.md evaluation plan."}
{If no AI-SPEC: "Audit against general AI eval best practices."}
</objective>

<files_to_read>
- {summary_paths}
- {plan_paths}
- {ai_spec_path if exists}
</files_to_read>

<input>
ai_spec_path: {ai_spec_path or "none"}
phase_dir: {phase_dir}
phase_number: {phase_number}
phase_name: {phase_name}
padded_phase: {padded_phase}
state: {A or B}
</input>
```

以 `AUDITOR_MODEL` 作为 model 启动 Task。

## 4. 解析 Auditor 结果

读取生成的 EVAL-REVIEW.md。提取：
- `overall_score`
- `verdict` (PRODUCTION READY | NEEDS WORK | SIGNIFICANT GAPS | NOT IMPLEMENTED)
- `critical_gap_count`

## 5. 显示摘要

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► EVAL AUDIT COMPLETE — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Score: {overall_score}/100
◆ Verdict: {verdict}
◆ Critical Gaps: {critical_gap_count}
◆ Output: {eval_review_path}

{If PRODUCTION READY:}
  Next step: /gsd-plan-phase (next phase) or deploy

{If NEEDS WORK:}
  Address critical gaps in EVAL-REVIEW.md, then re-run /gsd-eval-review {N}

{If SIGNIFICANT GAPS or NOT IMPLEMENTED:}
  Review AI-SPEC.md evaluation plan. Critical eval dimensions are not implemented.
  Do not deploy until gaps are addressed.
```

## 6. 提交

**如果 `commit_docs` 为 true：**
```bash
git add "${EVAL_REVIEW_FILE}"
git commit -m "docs({phase_slug}): add EVAL-REVIEW.md — score {overall_score}/100 ({verdict})"
```

</process>

<success_criteria>
- [ ] 已正确检测 phase 执行状态
- [ ] 已处理 AI-SPEC.md 是否存在的两种情况
- [ ] 已用正确上下文启动 gsd-eval-auditor
- [ ] 已写出 EVAL-REVIEW.md（由 auditor 生成）
- [ ] 已向用户显示评分和 verdict
- [ ] 已根据 verdict 给出合适的后续步骤
- [ ] 若启用 commit_docs 则已提交
</success_criteria>
