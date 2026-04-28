<purpose>
为涉及构建 AI 系统的 phases 生成 AI 设计契约（AI-SPEC.md）。编排 gsd-framework-selector → gsd-ai-researcher → gsd-domain-researcher → gsd-eval-planner，并带一个验证关卡。它插入在 GSD 生命周期中的 discuss-phase 与 plan-phase 之间。

在 planner 创建任务前，AI-SPEC.md 会先锁定四件事：
1. Framework 选择（含理由与备选方案）
2. 实现指引（来自官方文档的正确语法、patterns、常见陷阱）
3. 领域上下文（实践者 rubric 要素、失败模式、监管约束）
4. 评估策略（维度、rubrics、tooling、reference dataset、guardrails）

这可以避免 AI 开发中最常见的两类失败：为 use case 选错 framework，以及把评估当成事后补丁。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ai-frameworks.md
@~/.claude/get-shit-done/references/ai-evals.md
</required_reading>

<process>

## 1. 初始化

```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

解析 JSON，获取：`phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `has_research`, `commit_docs`。

**文件路径：** `state_path`, `roadmap_path`, `requirements_path`, `context_path`。

解析 agent model：
```bash
SELECTOR_MODEL=$(gsd-sdk query resolve-model gsd-framework-selector 2>/dev/null | jq -r '.model' 2>/dev/null || true)
RESEARCHER_MODEL=$(gsd-sdk query resolve-model gsd-ai-researcher 2>/dev/null | jq -r '.model' 2>/dev/null || true)
DOMAIN_MODEL=$(gsd-sdk query resolve-model gsd-domain-researcher 2>/dev/null | jq -r '.model' 2>/dev/null || true)
PLANNER_MODEL=$(gsd-sdk query resolve-model gsd-eval-planner 2>/dev/null | jq -r '.model' 2>/dev/null || true)
```

检查配置：
```bash
AI_PHASE_ENABLED=$(gsd-sdk query config-get workflow.ai_integration_phase 2>/dev/null || echo "true")
```

**如果 `AI_PHASE_ENABLED` 为 `false`：**
```
AI phase is disabled in config. Enable via /gsd-settings.
```
退出 workflow。

**如果 `planning_exists` 为 false：** 报错，先运行 `/gsd-new-project`。

## 2. 解析并校验 Phase

从 $ARGUMENTS 提取 phase number。如果未提供，则检测下一个未规划的 phase。

```bash
PHASE_INFO=$(gsd-sdk query roadmap.get-phase "${PHASE}")
```

**如果 `found` 为 false：** 报错并列出可用 phases。

## 3. 检查前置条件

**如果 `has_context` 为 false：**
```
No CONTEXT.md found for Phase {N}.
Recommended: run /gsd-discuss-phase {N} first to capture framework preferences.
Continuing without user decisions — framework selector will ask all questions.
```
继续（非阻塞）。

## 4. 检查现有 AI-SPEC

```bash
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
```


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。
**如果已存在：** 使用 AskUserQuestion：
- header: "Existing AI-SPEC"
- question: "AI-SPEC.md already exists for Phase {N}. What would you like to do?"
- options:
  - "Update — re-run with existing as baseline"
  - "View — display current AI-SPEC and exit"
  - "Skip — keep current AI-SPEC and exit"

如果选 "View"：显示文件内容并退出。
如果选 "Skip"：退出。
如果选 "Update"：继续 step 5。

## 5. 启动 gsd-framework-selector

显示：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AI DESIGN CONTRACT — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Step 1/4 — 正在选择 Framework...
```

按以下内容启动 `gsd-framework-selector`：
```markdown
Read ~/.claude/agents/gsd-framework-selector.md for instructions.

<objective>
Select the right AI framework for Phase {phase_number}: {phase_name}
Goal: {phase_goal}
</objective>

<files_to_read>
{context_path if exists}
{requirements_path if exists}
</files_to_read>

<phase_context>
Phase: {phase_number} — {phase_name}
Goal: {phase_goal}
</phase_context>
```

从 selector 输出中解析：`primary_framework`, `system_type`, `model_provider`, `eval_concerns`, `alternative_framework`。

**如果 selector 失败或返回为空：** 报错退出："Framework selection failed. Re-run /gsd-ai-integration-phase {N} or answer the framework question in /gsd-discuss-phase {N} first."

## 6. 初始化 AI-SPEC.md

复制模板：
```bash
cp "$HOME/.claude/get-shit-done/templates/AI-SPEC.md" "${PHASE_DIR}/${PADDED_PHASE}-AI-SPEC.md"
```

填写头部字段：
- Phase number 和 name
- 系统分类（来自 selector）
- 已选 framework（来自 selector）
- 备选方案（来自 selector）

## 7. 启动 gsd-ai-researcher

显示：
```
◆ Step 2/4 — 正在研究 {primary_framework} 文档与 AI 系统最佳实践...
```

按以下内容启动 `gsd-ai-researcher`：
```markdown
Read ~/.claude/agents/gsd-ai-researcher.md for instructions.

<objective>
Research {primary_framework} for Phase {phase_number}: {phase_name}
Write Sections 3 and 4 of AI-SPEC.md
</objective>

<files_to_read>
{ai_spec_path}
{context_path if exists}
</files_to_read>

<input>
framework: {primary_framework}
system_type: {system_type}
model_provider: {model_provider}
ai_spec_path: {ai_spec_path}
phase_context: Phase {phase_number}: {phase_name} — {phase_goal}
</input>
```

## 8. 启动 gsd-domain-researcher

显示：
```
◆ Step 3/4 — 正在研究领域上下文与专家评估标准...
```

按以下内容启动 `gsd-domain-researcher`：
```markdown
Read ~/.claude/agents/gsd-domain-researcher.md for instructions.

<objective>
Research the business domain and expert evaluation criteria for Phase {phase_number}: {phase_name}
Write Section 1b (Domain Context) of AI-SPEC.md
</objective>

<files_to_read>
{ai_spec_path}
{context_path if exists}
{requirements_path if exists}
</files_to_read>

<input>
system_type: {system_type}
phase_name: {phase_name}
phase_goal: {phase_goal}
ai_spec_path: {ai_spec_path}
</input>
```

## 9. 启动 gsd-eval-planner

显示：
```
◆ Step 4/4 — 正在基于领域与技术上下文设计评估策略...
```

按以下内容启动 `gsd-eval-planner`：
```markdown
Read ~/.claude/agents/gsd-eval-planner.md for instructions.

<objective>
Design evaluation strategy for Phase {phase_number}: {phase_name}
Write Sections 5, 6, and 7 of AI-SPEC.md
AI-SPEC.md now contains domain context (Section 1b) — use it as your rubric starting point.
</objective>

<files_to_read>
{ai_spec_path}
{context_path if exists}
{requirements_path if exists}
</files_to_read>

<input>
system_type: {system_type}
framework: {primary_framework}
model_provider: {model_provider}
phase_name: {phase_name}
phase_goal: {phase_goal}
ai_spec_path: {ai_spec_path}
</input>
```

## 10. 校验 AI-SPEC 完整性

读取已完成的 AI-SPEC.md。检查：
- 第 2 节有 framework 名称（不是 placeholder）
- 第 1b 节至少包含一个 domain rubric ingredient（Good/Bad/Stakes）
- 第 3 节包含非空 code block（entry point pattern）
- 第 4b 节包含一个 Pydantic 示例
- 第 5 节的 dimensions table 至少有一行
- 第 6 节至少有一个 guardrail，或明确写明 "N/A for internal tool"
- 末尾 Checklist 小节有 3 个以上已勾选项

**如果验证失败：** 显示缺失的小节，并询问用户要重新跑对应 step 还是继续。

## 11. 提交

**如果 `commit_docs` 为 true：**
```bash
git add "${AI_SPEC_FILE}"
git commit -m "docs({phase_slug}): generate AI-SPEC.md — {primary_framework} + domain context + eval strategy"
```

## 12. 展示完成结果

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AI-SPEC COMPLETE — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Framework: {primary_framework}
◆ System Type: {system_type}
◆ Domain: {domain_vertical from Section 1b}
◆ Eval Dimensions: {eval_concerns}
◆ Tracing Default: Arize Phoenix (or detected existing tool)
◆ Output: {ai_spec_path}

Next step:
  /gsd-plan-phase {N}   — planner will consume AI-SPEC.md
```

</process>

<success_criteria>
- [ ] 已选定 framework 且附带理由（Section 2）
- [ ] 已基于模板创建 AI-SPEC.md
- [ ] 已研究 framework 文档与 AI 最佳实践（Sections 3、4、4b 已填充）
- [ ] 已研究领域上下文与专家 rubric 要素（Section 1b 已填充）
- [ ] Eval 策略已建立在领域上下文之上（Sections 5-7 已填充）
- [ ] Section 7 已将 Arize Phoenix（或检测到的工具）设为 tracing 默认值
- [ ] AI-SPEC.md 已通过验证（Sections 1b、2、3、4b、5、6 均非空）
- [ ] 如果启用 `commit_docs`，则已提交
- [ ] 已向用户明确后续步骤
</success_criteria>
