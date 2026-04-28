<purpose>
对已实现的前端代码做追溯式 6 支柱视觉审计。它是一个可用于任意项目的独立命令，不要求项目由 GSD 管理。产出带评分和可执行结论的 UI-REVIEW.md。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-ui-auditor — 按设计要求审计 UI
</available_agent_types>

<process>

## 0. 初始化

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_UI_REVIEWER=$(gsd-sdk query agent-skills gsd-ui-reviewer 2>/dev/null)
```

解析：`phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `commit_docs`。

```bash
UI_AUDITOR_MODEL=$(gsd-sdk query resolve-model gsd-ui-auditor --raw)
```

显示横幅：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI 审计 — PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. 检测输入状态

```bash
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
UI_REVIEW_FILE=$(ls "${PHASE_DIR}"/*-UI-REVIEW.md 2>/dev/null | head -1)
```

**如果 `SUMMARY_FILES` 为空：** 退出并提示："Phase {N} 尚未执行。先运行 /gsd-execute-phase {N}."


**文本模式（配置中 `workflow.text_mode: true` 或传入 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，把每次 `AskUserQuestion` 调用改为纯文本编号列表，并让用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）在没有 `AskUserQuestion` 时的必需行为。
**如果 `UI_REVIEW_FILE` 非空：** 使用 AskUserQuestion：
- header: "现有 UI Review"
- question: "Phase {N} 已存在 UI-REVIEW.md。"
- options:
  - "Re-audit — 重新执行一次审计"
  - "View — 显示当前 review 并退出"

如果选 "View"：显示文件并退出。
如果选 "Re-audit"：继续。

## 2. 收集上下文路径

为 auditor 构建文件列表：
- phase 目录下所有 SUMMARY.md 文件
- phase 目录下所有 PLAN.md 文件
- UI-SPEC.md（如果存在 —— 作为审计基线）
- CONTEXT.md（如果存在 —— 作为锁定决策）

## 3. 启动 gsd-ui-auditor

```
◆ 正在启动 UI auditor...
```

构建 prompt：

```markdown
Read ~/.claude/agents/gsd-ui-auditor.md for instructions.

<objective>
对 Phase {phase_number}: {phase_name} 执行 6-pillar visual audit
{If UI-SPEC exists: "按 UI-SPEC.md design contract 审计。"}
{If no UI-SPEC: "按抽象的 6-pillar 标准审计。"}
</objective>

<files_to_read>
- {summary_paths} (Execution summaries)
- {plan_paths} (Execution plans — 原本打算实现的内容)
- {ui_spec_path} (UI Design Contract — 审计基线，如存在)
- {context_path} (User decisions，如存在)
</files_to_read>

${AGENT_SKILLS_UI_REVIEWER}

<config>
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

省略 null file path。

```
Task(
  prompt=ui_audit_prompt,
  subagent_type="gsd-ui-auditor",
  model="{UI_AUDITOR_MODEL}",
  description="UI Audit Phase {N}"
)
```

## 4. 处理返回

**如果为 `## UI REVIEW COMPLETE`：**

显示评分摘要：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI 审计完成 ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {N}: {Name}** — 总分：{score}/24

| Pillar | Score |
|--------|-------|
| Copywriting | {N}/4 |
| Visuals | {N}/4 |
| Color | {N}/4 |
| Typography | {N}/4 |
| Spacing | {N}/4 |
| Experience Design | {N}/4 |

优先修复项：
1. {fix}
2. {fix}
3. {fix}

完整 review：{path to UI-REVIEW.md}

───────────────────────────────────────────────────────────────

## ▶ Next

`/clear` 然后选择其一：

- `/gsd-verify-work {N}` — UAT testing
- `/gsd-plan-phase {N+1}` — 规划下一 phase

- `/gsd-verify-work {N}` — UAT testing
- `/gsd-plan-phase {N+1}` — 规划下一 phase

───────────────────────────────────────────────────────────────
```

## Automated UI Verification（Playwright-MCP 可用时）

如果本会话可访问 `mcp__playwright__*` tools：

1. 使用 `mcp__playwright__navigate`（或等价的 Playwright-MCP tool）导航到该 phase 的 UI-SPEC.md 中描述的每个 UI component。
2. 使用 `mcp__playwright__screenshot` 为每个 component 截图。
3. 按 spec 的视觉要求做比对：dimensions、color palette、layout、spacing scale 和 typography。
4. 自动将任何 dimension、color 或 layout 差异作为附加 findings 写入 UI-REVIEW.md 对应的 pillar section。
5. 对需要人工判断的项目（brand feel、content tone），在 findings 中标记 `needs_human_review: true`，并在自动审计结束后单独呈现给用户。

如果本会话没有 Playwright-MCP，本节会被完全跳过。审计会回退为上文描述的标准纯代码审查。
不需要改配置；`mcp__playwright__*` tools 的可用性会在运行时检测。

## 5. 提交（如果已配置）

```bash
gsd-sdk query commit "docs(${padded_phase}): UI audit review" "${PHASE_DIR}/${PADDED_PHASE}-UI-REVIEW.md"
```

</process>

<success_criteria>
- [ ] 已校验 phase
- [ ] 已找到 SUMMARY.md 文件（执行已完成）
- [ ] 已处理现有 review（re-audit/view）
- [ ] 已用正确上下文启动 gsd-ui-auditor
- [ ] 已在 phase 目录创建 UI-REVIEW.md
- [ ] 已向用户显示评分摘要
- [ ] 已给出下一步
</success_criteria>
