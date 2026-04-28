<purpose>
为前端 phase 生成 UI 设计契约（UI-SPEC.md）。编排 gsd-ui-researcher 和 gsd-ui-checker，并带修订循环。它插入在生命周期中的 discuss-phase 与 plan-phase 之间。

在 planner 创建任务前，UI-SPEC.md 会锁定 spacing、typography、color、copywriting 和 design system 决策。这能防止执行过程中因临时样式决策而产生设计债务。
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-ui-researcher — 研究 UI/UX 方案
- gsd-ui-checker — 审查 UI 实现质量
</available_agent_types>

<process>

## 1. 初始化

```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_UI=$(gsd-sdk query agent-skills gsd-ui-researcher 2>/dev/null)
AGENT_SKILLS_UI_CHECKER=$(gsd-sdk query agent-skills gsd-ui-checker 2>/dev/null)
```

解析 JSON，获取：`phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_context`, `has_research`, `commit_docs`。

**文件路径：** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`。

检测 sketch findings：
```bash
SKETCH_FINDINGS_PATH=$(ls ./.claude/skills/sketch-findings-*/SKILL.md 2>/dev/null | head -1)
```

解析 UI agent model：

```bash
UI_RESEARCHER_MODEL=$(gsd-sdk query resolve-model gsd-ui-researcher --raw)
UI_CHECKER_MODEL=$(gsd-sdk query resolve-model gsd-ui-checker --raw)
```

检查配置：

```bash
UI_ENABLED=$(gsd-sdk query config-get workflow.ui_phase 2>/dev/null || echo "true")
```

**如果 `UI_ENABLED` 为 `false`：**
```
配置中已禁用 UI phase。可通过 /gsd-settings 启用。
```
退出 workflow。

**如果 `planning_exists` 为 false：** 报错，先运行 `/gsd-new-project`。

## 2. 解析并校验 Phase

从 $ARGUMENTS 提取 phase number。如果未提供，检测下一个未规划的 phase。

```bash
PHASE_INFO=$(gsd-sdk query roadmap.get-phase "${PHASE}")
```

**如果 `found` 为 false：** 报错并列出可用 phases。

## 3. 检查前置条件

**如果 `has_context` 为 false：**
```
未找到 Phase {N} 的 CONTEXT.md。
建议：先运行 /gsd-discuss-phase {N} 以记录设计偏好。
将在缺少用户决策的情况下继续，UI researcher 会自行提问所有问题。
```
继续（非阻塞）。

**如果 `has_research` 为 false：**
```
未找到 Phase {N} 的 RESEARCH.md。
注意：stack 决策（component library、styling approach）会在 UI research 期间询问。
```
继续（非阻塞）。

**如果 `SKETCH_FINDINGS_PATH` 不为空：**
```
⚡ 检测到 Sketch findings: {SKETCH_FINDINGS_PATH}
   /gsd-sketch 中已验证的设计决策会加载到 UI researcher。
   预先验证过的决策（layout、palette、typography、spacing）应视为已锁定，不要重复提问。
```

## 4. 检查现有 UI-SPEC

```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```


**文本模式（配置中 `workflow.text_mode: true` 或传入 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，把每次 `AskUserQuestion` 调用改为纯文本编号列表，并让用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）在没有 `AskUserQuestion` 时的必需行为。
**如果已存在：** 使用 AskUserQuestion：
- header: "现有 UI-SPEC"
- question: "Phase {N} 已存在 UI-SPEC.md。你希望怎么处理？"
- options:
  - "Update — 以现有内容为基线重新运行 researcher"
  - "View — 显示当前 UI-SPEC 并退出"
  - "Skip — 保留当前 UI-SPEC，直接进入验证"

如果选 "View"：显示文件内容并退出。
如果选 "Skip"：进入 step 7（checker）。
如果选 "Update"：继续 step 5。

## 5. 启动 gsd-ui-researcher

显示：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI 设计契约 — PHASE {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在启动 UI researcher...
```

构建 prompt：

```markdown
Read ~/.claude/agents/gsd-ui-researcher.md for instructions.

<objective>
为 Phase {phase_number}: {phase_name} 创建 UI design contract
回答："这个 phase 需要哪些视觉与交互契约？"
</objective>

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (来自 /gsd-discuss-phase 的 USER DECISIONS)
- {research_path} (Technical Research — stack 决策)
- {SKETCH_FINDINGS_PATH} (Sketch Findings — 来自 /gsd-sketch 的已验证设计决策、CSS patterns、视觉方向，如存在)
</files_to_read>

${AGENT_SKILLS_UI}

<output>
写入到：{phase_dir}/{padded_phase}-UI-SPEC.md
Template: ~/.claude/get-shit-done/templates/UI-SPEC.md
</output>

<config>
commit_docs: {commit_docs}
phase_dir: {phase_dir}
padded_phase: {padded_phase}
</config>
```

从 `<files_to_read>` 中省略 null file path。

```
Task(
  prompt=ui_research_prompt,
  subagent_type="gsd-ui-researcher",
  model="{UI_RESEARCHER_MODEL}",
  description="UI Design Contract Phase {N}"
)
```

## 6. 处理 Researcher 返回

**如果为 `## UI-SPEC COMPLETE`：**
显示确认信息。继续 step 7。

**如果为 `## UI-SPEC BLOCKED`：**
显示阻塞详情和可选项。退出 workflow。

## 7. 启动 gsd-ui-checker

显示：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► 正在验证 UI-SPEC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在启动 UI checker...
```

构建 prompt：

```markdown
Read ~/.claude/agents/gsd-ui-checker.md for instructions.

<objective>
验证 Phase {phase_number}: {phase_name} 的 UI design contract
检查全部 6 个维度。返回 APPROVED 或 BLOCKED。
</objective>

<files_to_read>
- {phase_dir}/{padded_phase}-UI-SPEC.md (UI Design Contract — PRIMARY INPUT)
- {context_path} (USER DECISIONS — 检查是否符合)
- {research_path} (Technical Research — 检查 stack 对齐情况)
</files_to_read>

${AGENT_SKILLS_UI_CHECKER}

<config>
ui_safety_gate: {ui_safety_gate config value}
</config>
```

```
Task(
  prompt=ui_checker_prompt,
  subagent_type="gsd-ui-checker",
  model="{UI_CHECKER_MODEL}",
  description="Verify UI-SPEC Phase {N}"
)
```

## 8. 处理 Checker 返回

**如果为 `## UI-SPEC VERIFIED`：**
显示各维度结果。进入 step 10。

**如果为 `## ISSUES FOUND`：**
显示阻塞问题。进入 step 9。

## 9. 修订循环（最多 2 次）

跟踪 `revision_count`（初始为 0）。

**如果 `revision_count` < 2：**
- 递增 `revision_count`
- 带修订上下文重新启动 gsd-ui-researcher：

```markdown
<revision>
The UI checker found issues with the current UI-SPEC.md.

### Issues to Fix
{paste blocking issues from checker return}

读取现有 UI-SPEC.md，只修复列出的问题，并重写文件。
对已经回答过的问题，不要再次向用户提问。
</revision>
```

- researcher 返回后 → 重新启动 checker（step 7）

**如果 `revision_count` >= 2：**
```
已达到最大修订次数。剩余问题：

{list remaining issues}

可选项：
1. Force approve — 使用当前 UI-SPEC 继续（FLAG 会视为已接受）
2. Edit manually — 在编辑器中打开 UI-SPEC.md，然后重新运行 /gsd-ui-phase
3. Abandon — 放弃并退出
```

使用 AskUserQuestion 让用户选择。

## 10. 展示最终状态

显示：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI-SPEC 已就绪 ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {N}: {Name}** — UI 设计契约已批准

Dimensions: 6/6 passed
{If any FLAGs: "Recommendations: {N} (non-blocking)"}

───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

{If CONTEXT.md exists for this phase:}
**Plan Phase {N}** — planner 会把 UI-SPEC.md 作为设计上下文使用

`/clear` 然后运行：`/gsd-plan-phase {N}`

{If CONTEXT.md does NOT exist:}
**Discuss Phase {N}** — 在规划前收集实现上下文

`/clear` 然后运行：`/gsd-discuss-phase {N}`

（或运行 `/gsd-plan-phase {N}` 跳过讨论）

───────────────────────────────────────────────────────────────
```

## 11. 提交（如果已配置）

```bash
gsd-sdk query commit "docs(${padded_phase}): UI design contract" "${PHASE_DIR}/${PADDED_PHASE}-UI-SPEC.md"
```

## 12. 更新状态

```bash
gsd-sdk query state.record-session \
  --stopped-at "Phase ${PHASE} UI-SPEC approved" \
  --resume-file "${PHASE_DIR}/${PADDED_PHASE}-UI-SPEC.md"
```

</process>

<success_criteria>
- [ ] 已检查配置（若 ui_phase disabled 则退出）
- [ ] 已根据 roadmap 校验 phase
- [ ] 已检查前置条件（CONTEXT.md、RESEARCH.md —— 非阻塞警告）
- [ ] 已处理现有 UI-SPEC（update/view/skip）
- [ ] 已用正确上下文和 file path 启动 gsd-ui-researcher
- [ ] 已在正确位置创建 UI-SPEC.md
- [ ] 已用 UI-SPEC.md 启动 gsd-ui-checker
- [ ] 已评估全部 6 个维度
- [ ] 若 BLOCKED，已进入修订循环（最多 2 次）
- [ ] 已展示最终状态和下一步
- [ ] 若启用 commit_docs，已提交 UI-SPEC.md
- [ ] 已更新状态
</success_criteria>
