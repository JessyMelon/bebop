<purpose>
为 roadmap 的某个 phase 创建可执行的 phase prompt（PLAN.md 文件），并集成研究与验证。默认流程：Research（如需要）-> Plan -> Verify -> Done。编排 gsd-phase-researcher、gsd-planner 和 gsd-plan-checker 代理，并带有修订循环（最多 3 次迭代）。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 中引用的所有文件。

@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/references/revision-loop.md
@~/.claude/get-shit-done/references/gate-prompts.md
@~/.claude/get-shit-done/references/agent-contracts.md
@~/.claude/get-shit-done/references/gates.md
</required_reading>

<available_agent_types>
有效的 GSD 子代理类型（使用精确名称——不要回退到 'general-purpose'）：
- gsd-phase-researcher — 为某个阶段研究技术方案
- gsd-pattern-mapper — 分析代码库中的现有模式，并产出 PATTERNS.md
- gsd-planner — 根据阶段范围创建详细计划
- gsd-plan-checker — 在执行前审查计划质量
</available_agent_types>

<process>

## 0. Git Branch Invariant

**在 plan-phase 期间，不要创建、重命名或切换 git 分支。** 分支身份在 discuss-phase 中已确定，并由用户的 git 工作流负责。ROADMAP.md 中的 phase 重命名只是计划层面的变更——不会修改 git 分支名。如果 init JSON 中的 `phase_slug` 与当前分支名不同，这是预期且正确的；保持分支不变。

## 1. Initialize

一次性加载所有上下文（仅传路径，以最小化 orchestrator 上下文）：

```bash
INIT=$(gsd-sdk query init.plan-phase "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_RESEARCHER=$(gsd-sdk query agent-skills gsd-researcher 2>/dev/null)
AGENT_SKILLS_PLANNER=$(gsd-sdk query agent-skills gsd-planner 2>/dev/null)
AGENT_SKILLS_CHECKER=$(gsd-sdk query agent-skills gsd-checker 2>/dev/null)
CONTEXT_WINDOW=$(gsd-sdk query config-get context_window 2>/dev/null || echo "200000")
TDD_MODE=$(gsd-sdk query config-get workflow.tdd_mode 2>/dev/null || echo "false")
```

当 `TDD_MODE` 为 `true` 时，会指示 planner 代理依据 `references/tdd.md` 中的启发式，为适合的任务应用 `type: tdd`。planner 的 `<required_reading>` 还会扩展包含 `@~/.claude/get-shit-done/references/tdd.md`，以便规划时可使用 gate enforcement 规则。

当 `CONTEXT_WINDOW >= 500000` 时，planner prompt 会包含最近 3 个先前 phase 的 CONTEXT.md 和 SUMMARY.md 文件，以及当前 phase 在 ROADMAP.md 的 `Depends on:` 字段中显式列出的任意 phase。显式依赖始终会加载，不受时间远近影响（例如，Phase 7 声明 `Depends on: Phase 2` 时，总会看到 Phase 2 的上下文）。按最近性限制范围，可使 planner 的上下文预算聚焦于近期工作。

解析 JSON 中的以下字段：`researcher_model`, `planner_model`, `checker_model`, `research_enabled`, `plan_checker_enabled`, `nyquist_validation_enabled`, `commit_docs`, `text_mode`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_reviews`, `has_plans`, `plan_count`, `planning_exists`, `roadmap_exists`, `phase_req_ids`, `response_language`。

**如果设置了 `response_language`：** 在所有启动的子代理 prompt 中包含 `response_language: {value}`，以确保任何面向用户的输出保持该语言。

**File paths（供 <files_to_read> blocks 使用）：** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `verification_path`, `uat_path`, `reviews_path`。如果文件不存在，这些值为 null。

**如果 `planning_exists` 为 false：** 报错——请先运行 `/gsd-new-project`。

## 2. Parse and Normalize Arguments

从 $ARGUMENTS 中提取：phase 编号（整数或类似 `2.1` 的小数）、标志（`--research`, `--skip-research`, `--gaps`, `--skip-verify`, `--skip-ui`, `--prd <filepath>`, `--reviews`, `--text`, `--bounce`, `--skip-bounce`, `--chunked`）。

如果 $ARGUMENTS 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 `TEXT_MODE` 激活时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入所选编号。对于 Claude Code 远程会话（`/rc` 模式）中 TUI 菜单无法透过 Claude App 工作的情况，这是必需的。

从 $ARGUMENTS 中提取 `--prd <filepath>`。若存在，则将 PRD_FILE 设为该路径。

**如果没有提供 phase 编号：** 从 roadmap 中检测下一个未规划的 phase。

**如果 `phase_found` 为 false：** 验证该 phase 是否存在于 ROADMAP.md 中。若有效，则使用 init 提供的 `phase_slug` 和 `padded_phase` 创建目录：
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**从 init 获取的现有产物：** `has_research`, `has_plans`, `plan_count`。

根据标志或配置设置 `CHUNKED_MODE`：
```bash
CHUNKED_CFG=$(gsd-sdk query config-get workflow.plan_chunked 2>/dev/null || echo "false")
CHUNKED_MODE=false
if [[ "$ARGUMENTS" =~ --chunked ]] || [[ "$CHUNKED_CFG" == "true" ]]; then
  CHUNKED_MODE=true
fi
```

## 2.5. Validate `--reviews` Prerequisite

**跳过条件：** 没有 `--reviews` 标志。

**如果同时有 `--reviews` 和 `--gaps`：** 报错——不能组合 `--reviews` 与 `--gaps`。这两种模式互相冲突。

**如果存在 `--reviews` 且 `has_reviews` 为 false（phase 目录中没有 REVIEWS.md）：**

错误：
```text
未找到 Phase {N} 的 REVIEWS.md。请先运行 reviews：

/gsd-review --phase {N}

然后重新运行 /gsd-plan-phase {N} --reviews
```
退出工作流。

## 3. Validate Phase

```bash
PHASE_INFO=$(gsd-sdk query roadmap.get-phase "${PHASE}")
```

**如果 `found` 为 false：** 报错并列出可用 phases。**如果 `found` 为 true：** 从 JSON 中提取 `phase_number`, `phase_name`, `goal`。

## 3.5. Handle PRD Express Path

**跳过条件：** 参数中没有 `--prd` 标志。

**如果提供了 `--prd <filepath>`：**

1. 读取 PRD 文件：
```bash
PRD_CONTENT=$(cat "$PRD_FILE" 2>/dev/null)
if [ -z "$PRD_CONTENT" ]; then
  echo "Error: PRD file not found: $PRD_FILE"
  exit 1
fi
```

2. 显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PRD EXPRESS PATH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Using PRD: {PRD_FILE}
正在从需求生成 CONTEXT.md...
```

3. 解析 PRD 内容并生成 CONTEXT.md。orchestrator 应：
   - 提取 PRD 中的所有 requirements、user stories、acceptance criteria 和 constraints
   - 将每项映射为一个锁定决策（PRD 中的所有内容都视为锁定决策）
   - 识别 PRD 未覆盖的区域，并标记为 "Claude's Discretion"
   - **提取 canonical refs**：来自该 phase 的 ROADMAP.md，以及 PRD 中引用的任何 specs/ADRs——展开为完整文件路径（强制要求）
   - 在 phase 目录中创建 CONTEXT.md

4. 写入 CONTEXT.md：
```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning
**Source:** PRD Express Path ({PRD_FILE})

<domain>
## Phase Boundary

[从 PRD 提取——该 phase 交付什么]

</domain>

<decisions>
## Implementation Decisions

{For each requirement/story/criterion in the PRD:}
### [根据内容推导出的类别]
- [作为锁定决策的 requirement]

### Claude's Discretion
[PRD 未覆盖的区域——实现细节、技术选择]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

[强制要求。提取自 ROADMAP.md 和 PRD 中引用的任何文档。
使用完整相对路径。按主题分组。]

### [主题区域]
- `path/to/spec-or-adr.md` — [它决定/定义了什么]

[如果没有外部 specs："No external specs — requirements fully captured in decisions above"]

</canonical_refs>

<specifics>
## Specific Ideas

[PRD 中的任何具体引用、示例或明确要求]

</specifics>

<deferred>
## Deferred Ideas

[PRD 中明确标记为 future/v2/out-of-scope 的项目]
[如果没有："None — PRD covers phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date] via PRD Express Path*
```

5. 提交：
```bash
gsd-sdk query commit "docs(${padded_phase}): generate context from PRD" "${phase_dir}/${padded_phase}-CONTEXT.md"
```

6. 将 `context_content` 设为生成的 CONTEXT.md 内容，并继续到 step 5（Handle Research）。

**效果：** 这会完全绕过 step 4（Load CONTEXT.md），因为我们刚刚创建了它。其余工作流（research、planning、verification）会正常继续，并使用 PRD 派生出的上下文。

## 4. Load CONTEXT.md

**跳过条件：** 使用了 PRD express path（CONTEXT.md 已在 step 3.5 创建）。

检查 init JSON 中的 `context_path`。

如果 `context_path` 不为 null，显示：`Using phase context from: ${context_path}`

**如果 `context_path` 为 null（不存在 CONTEXT.md）：**

读取 discuss 模式，用于上下文 gate 标签：
```bash
DISCUSS_MODE=$(gsd-sdk query config-get workflow.discuss_mode 2>/dev/null || echo "discuss")
```

如果 `TEXT_MODE` 为 true，则以纯文本编号列表展示：
```text
未找到 Phase {X} 的 CONTEXT.md。计划将仅使用 research 和 requirements——不会包含你的设计偏好。

1. Continue without context — 仅基于 research + requirements 规划
[If DISCUSS_MODE is "assumptions":]
2. Gather context (assumptions mode) — 在规划前分析代码库并暴露假设
[If DISCUSS_MODE is "discuss" or unset:]
2. Run discuss-phase first — 在规划前记录设计决策

请输入编号：
```

否则使用 AskUserQuestion：
- header: "No context"
- question: "未找到 Phase {X} 的 CONTEXT.md。计划将仅使用 research 和 requirements——不会包含你的设计偏好。是继续，还是先收集上下文？"
- options:
  - "Continue without context" — 仅基于 research + requirements 规划
  如果 `DISCUSS_MODE` 为 `"assumptions"`：
  - "Gather context (assumptions mode)" — 在规划前分析代码库并暴露假设
  如果 `DISCUSS_MODE` 为 `"discuss"`（或未设置）：
  - "Run discuss-phase first" — 在规划前记录设计决策

如果选择 "Continue without context"：进入 step 5。
如果选择 "Run discuss-phase first"：
  **IMPORTANT:** 不要以嵌套 Skill/Task 调用方式触发 discuss-phase——AskUserQuestion
  在嵌套子上下文中无法正常工作（#1009）。应直接显示命令，
  并退出，让用户以顶层命令运行：
  ```text
  请先运行此命令，然后重新运行 /gsd-plan-phase {X} ${GSD_WS}：

  /gsd-discuss-phase {X} ${GSD_WS}
  ```
  **退出 plan-phase 工作流。不要继续。**

## 4.5. Check AI-SPEC

**跳过条件：** 配置中的 `ai_integration_phase_enabled` 为 false，或提供了 `--skip-ai-spec` 标志。

```bash
AI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-AI-SPEC.md 2>/dev/null | head -1)
AI_PHASE_CFG=$(gsd-sdk query config-get workflow.ai_integration_phase 2>/dev/null || echo "true")
```

**如果 `AI_PHASE_CFG` 为 `false`：** 跳过。

**如果 `AI_SPEC_FILE` 为空：** 检查 phase goal 中是否包含 AI 关键词：
```bash
echo "${phase_goal}" | grep -qi "agent\|llm\|rag\|chatbot\|embedding\|langchain\|llamaindex\|crewai\|langgraph\|openai\|anthropic\|vector\|eval\|ai system"
```

**如果检测到 AI 关键词且没有 AI-SPEC.md：**
```text
◆ 注意：此 phase 看起来涉及 AI 系统开发。
  建议在规划前运行 /gsd-ai-integration-phase {N}，以便：
  - 为你的用例选择合适框架
  - 研究其文档与最佳实践
  - 设计评估策略

  是否在没有 AI-SPEC 的情况下继续规划？（非阻塞——之后仍可运行 /gsd-ai-integration-phase）
```

使用 AskUserQuestion，选项为：
- "Continue — plan without AI-SPEC"
- "Stop — I'll run /gsd-ai-integration-phase {N} first"

如果选择 "Stop"：退出，并提示 `/gsd-ai-integration-phase {N}`。
如果选择 "Continue"：继续。（非阻塞——planner 会注明缺少 AI-SPEC。）

**如果 `AI_SPEC_FILE` 非空：** 为 planner 上下文提取 framework：
```bash
FRAMEWORK_LINE=$(grep "Selected Framework:" "${AI_SPEC_FILE}" | head -1)
```
在 step 7 将 `ai_spec_path` 和 `framework_line` 传给 planner，以便它引用 AI 设计契约。

## 5. Handle Research

**跳过条件：** 存在 `--gaps` 标志，或 `--skip-research` 标志，或 `--reviews` 标志。

**如果 `has_research` 为 true（来自 init）且没有 `--research` 标志：** 使用现有 research，跳到 step 6。

**如果缺少 RESEARCH.md 或存在 `--research` 标志：**

**如果没有显式标志（`--research` 或 `--skip-research`），且不是 `--auto`：**
询问用户是否先做 research，并基于该 phase 给出上下文相关的建议：

如果 `TEXT_MODE` 为 true，则以纯文本编号列表展示：
```text
在规划 Phase {X}: {phase_name} 之前先做 research 吗？

1. Research first (Recommended) — 在规划前研究领域、模式和依赖。最适合新功能、不熟悉的集成或架构改动。
2. Skip research — 直接基于 context 和 requirements 规划。最适合 bug 修复、简单重构或已充分理解的任务。

请输入编号：
```

否则使用 AskUserQuestion：
```text
AskUserQuestion([
  {
    question: "Research before planning Phase {X}: {phase_name}?",
    header: "Research",
    multiSelect: false,
    options: [
      { label: "Research first (Recommended)", description: "在规划前研究领域、模式和依赖。最适合新功能、不熟悉的集成或架构改动。" },
      { label: "Skip research", description: "直接基于 context 和 requirements 规划。最适合 bug 修复、简单重构或已充分理解的任务。" }
    ]
  }
])
```

如果用户选择 "Skip research"：跳到 step 6。

**如果为 `--auto` 且 `research_enabled` 为 false：** 静默跳过 research（保持自动化行为）。

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在启动 researcher...
```

### Spawn gsd-phase-researcher

```bash
PHASE_DESC=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick section)
```

Research prompt：

```markdown
<objective>
研究如何实现 Phase {phase_number}: {phase_name}
回答："为了把这个 phase 规划好，我需要知道什么？"
</objective>

<files_to_read>
- {context_path} (来自 /gsd-discuss-phase 的 USER DECISIONS)
- {requirements_path} (项目需求)
- {state_path} (项目决策与历史)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<additional_context>
**Phase description:** {phase_description}
**Phase requirement IDs (MUST address):** {phase_req_ids}

**Project instructions:** 如存在，读取 ./CLAUDE.md —— 遵循项目特定指南
**Project skills:** 检查 .claude/skills/ 或 .agents/skills/ 目录（若任一存在）——读取 SKILL.md 文件，研究应考虑项目技能模式
</additional_context>

<output>
写入：{phase_dir}/{phase_num}-RESEARCH.md
</output>
```

```text
Task(
  prompt=research_prompt,
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

### Handle Researcher Return

- **`## RESEARCH COMPLETE`：** 显示确认信息，继续到 step 6
- **`## RESEARCH BLOCKED`：** 显示阻塞项，并提供：1) 提供上下文，2) 跳过 research，3) Abort

## 5.5. Create Validation Strategy

若 `nyquist_validation_enabled` 为 false 或 `research_enabled` 为 false，则跳过。

如果 `research_enabled` 为 false 且 `nyquist_validation_enabled` 为 true：警告 "Nyquist validation enabled but research disabled — VALIDATION.md cannot be created without RESEARCH.md. Plans will lack validation requirements (Dimension 8)." 然后继续到 step 6。

**但在以下条件全部满足时，本次运行不适用 Nyquist：**
- `research_enabled` 为 false
- `has_research` 为 false
- 未提供 `--research` 标志

此时：**完全跳过 validation-strategy 创建**。本次运行**不要**期待 `RESEARCH.md` 或 `VALIDATION.md`，继续到 Step 6。

```bash
grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null || true
```

**如果找到：**
1. 读取模板：`~/.claude/get-shit-done/templates/VALIDATION.md`
2. 写入 `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`（使用 Write tool）
3. 填充 frontmatter：`{N}` → phase number，`{phase-slug}` → slug，`{date}` → 当前日期
4. 验证：
```bash
test -f "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md" && echo "VALIDATION_CREATED=true" || echo "VALIDATION_CREATED=false"
```
5. 如果 `VALIDATION_CREATED=false`：停止——不要进入 Step 6
6. 如果 `commit_docs`：执行 `commit "docs(phase-${PHASE}): add validation strategy"`

**如果未找到：** 警告并继续——plans 可能无法通过 Dimension 8。

## 5.55. Security Threat Model Gate

> 若 `workflow.security_enforcement` 明确为 `false`，则跳过。缺失即视为启用。

```bash
SECURITY_CFG=$(gsd-sdk query config-get workflow.security_enforcement --raw 2>/dev/null || echo "true")
SECURITY_ASVS=$(gsd-sdk query config-get workflow.security_asvs_level --raw 2>/dev/null || echo "1")
SECURITY_BLOCK=$(gsd-sdk query config-get workflow.security_block_on --raw 2>/dev/null || echo "high")
```

**如果 `SECURITY_CFG` 为 `false`：** 跳到 step 5.6。

**如果 `SECURITY_CFG` 为 `true`：** 显示横幅：

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SECURITY THREAT MODEL REQUIRED (ASVS L{SECURITY_ASVS})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

每个 PLAN.md 都必须包含一个 <threat_model> block。
阻断级别：{SECURITY_BLOCK} 严重性的威胁。
退出方式：在 .planning/config.json 中设置 security_enforcement: false
```

继续到 step 5.6。security 配置会在 step 8 传给 planner。

## 5.6. UI Design Contract Gate

> 若 `.planning/config.json` 中 `workflow.ui_phase` 明确为 `false` 且 `workflow.ui_safety_gate` 明确为 `false`，则跳过。若 key 缺失，视为启用。

```bash
UI_PHASE_CFG=$(gsd-sdk query config-get workflow.ui_phase 2>/dev/null || echo "true")
UI_GATE_CFG=$(gsd-sdk query config-get workflow.ui_safety_gate 2>/dev/null || echo "true")
```

**如果两者都为 `false`：** 跳到 step 6。

检查该 phase 是否包含前端指示词：

```bash
PHASE_SECTION=$(gsd-sdk query roadmap.get-phase "${PHASE}" 2>/dev/null)
echo "$PHASE_SECTION" | grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget" > /dev/null 2>&1
HAS_UI=$?
```

**如果 `HAS_UI` 为 0（发现前端指示词）：**

检查是否已有 UI-SPEC：
```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
```

**如果找到 UI-SPEC.md：** 设置 `UI_SPEC_PATH=$UI_SPEC_FILE`。显示：`Using UI design contract: ${UI_SPEC_PATH}`

**如果缺少 UI-SPEC.md 且 $ARGUMENTS 中存在 `--skip-ui` 标志：** 静默跳到 step 6。

**如果缺少 UI-SPEC.md 且 `UI_GATE_CFG` 为 `true`：**

读取临时 chain 标志（与 `check.auto-mode` → `auto_chain_active` 同字段）：
```bash
AUTO_CHAIN=$(gsd-sdk query check auto-mode --pick auto_chain_active 2>/dev/null || echo "false")
```

**如果 `AUTO_CHAIN` 为 `true`（运行在 `--chain` 或 `--auto` 流水线中）：**

无需提示，自动生成 UI-SPEC：
```text
Skill(skill="gsd-ui-phase", args="${PHASE} --auto ${GSD_WS}")
```
`gsd-ui-phase` 返回后，重新读取：
```bash
UI_SPEC_FILE=$(ls "${PHASE_DIR}"/*-UI-SPEC.md 2>/dev/null | head -1)
UI_SPEC_PATH="${UI_SPEC_FILE}"
```
继续到 step 6。

**如果 `AUTO_CHAIN` 为 `false`（手动调用）：**

直接输出以下 markdown（不要作为代码块）：

```text
## ⚠ Phase {N} 缺少 UI-SPEC.md
▶ 推荐下一步：
`/gsd-ui-phase {N} ${GSD_WS}` — 在规划前生成 UI 设计契约
───────────────────────────────────────────────
还可使用：
- `/gsd-plan-phase {N} --skip-ui ${GSD_WS}` — 在没有 UI-SPEC 的情况下规划（不推荐用于前端 phase）
```

**退出 plan-phase 工作流。不要继续。**

**如果 `HAS_UI` 为 1（无前端指示词）：** 静默跳到 step 5.7。

## 5.7. Schema Push Detection Gate

> 检测 phase 范围内与 schema 相关的文件，并在计划中注入一个强制性的 `[BLOCKING]` schema push 任务。可防止出现“构建/类型检查通过，但实际数据库未更新”的假阳性验证，因为 TypeScript 类型可能来自配置而不是实时数据库。

检查 phase 范围内是否有文件匹配 schema 模式：

```bash
PHASE_SECTION=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick section 2>/dev/null)
```

扫描 `PHASE_SECTION`、`CONTEXT.md`（若已加载）和 `RESEARCH.md`（若存在），查找匹配以下 ORM 模式的文件路径：

| ORM | File Patterns |
|-----|--------------|
| Payload CMS | `src/collections/**/*.ts`, `src/globals/**/*.ts` |
| Prisma | `prisma/schema.prisma`, `prisma/schema/*.prisma` |
| Drizzle | `drizzle/schema.ts`, `src/db/schema.ts`, `drizzle/*.ts` |
| Supabase | `supabase/migrations/*.sql` |
| TypeORM | `src/entities/**/*.ts`, `src/migrations/**/*.ts` |

同时检查该 phase 的现有 PLAN.md 是否已在 `files_modified` 中引用了这些文件模式。

**如果检测到与 schema 相关的文件：**

设置 `SCHEMA_PUSH_REQUIRED=true` 和 `SCHEMA_ORM={detected_orm}`。

为检测到的 ORM 确定 push 命令：

| ORM | Push Command | Non-TTY Workaround |
|-----|-------------|-------------------|
| Payload CMS | `npx payload migrate` | `CI=true PAYLOAD_MIGRATING=true npx payload migrate` |
| Prisma | `npx prisma db push` | `npx prisma db push --accept-data-loss`（若为破坏性变更） |
| Drizzle | `npx drizzle-kit push` | `npx drizzle-kit push` |
| Supabase | `supabase db push` | 设置 `SUPABASE_ACCESS_TOKEN` 环境变量 |
| TypeORM | `npx typeorm migration:run` | `npx typeorm migration:run -d src/data-source.ts` |

将以下内容注入到 planner prompt（step 8）作为附加约束：

```markdown
<schema_push_requirement>
**[BLOCKING] Schema Push Required**

该 phase 会修改与 schema 相关的文件（{detected_files}）。planner MUST 包含
一个 `[BLOCKING]` 任务，在所有 schema 文件修改完成后、
验证前运行数据库 schema push 命令。

- ORM detected: {SCHEMA_ORM}
- Push command: {push_command}
- Non-TTY workaround: {env_hint}
- 如果 push 需要无法抑制的交互式提示，则将该任务标记为
  `autonomous: false`，表示需要人工介入

该任务是强制性的——没有它，该 phase CANNOT 通过验证。构建和
类型检查即使不 push 也会通过（类型来自配置，而非实时数据库），
从而造成假阳性的验证状态。
</schema_push_requirement>
```

显示：`Schema files detected ({SCHEMA_ORM}) — [BLOCKING] push task will be injected into plans`

**如果未检测到与 schema 相关的文件：** 静默跳到 step 6。

## 6. Check Existing Plans

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null || true
```

**如果存在且带有 `--reviews` 标志：** 跳过提示——直接进入重新规划（`--reviews` 的目的就是基于 review 反馈重新规划）。

**如果存在且没有 `--reviews` 标志：** 提供：1) Add more plans，2) View existing，3) Replan from scratch。

## 7. Use Context Paths from INIT

从 INIT JSON 中提取：

```bash
_gsd_field() { node -e "const o=JSON.parse(process.argv[1]); const v=o[process.argv[2]]; process.stdout.write(v==null?'':String(v))" "$1" "$2"; }
STATE_PATH=$(_gsd_field "$INIT" state_path)
ROADMAP_PATH=$(_gsd_field "$INIT" roadmap_path)
REQUIREMENTS_PATH=$(_gsd_field "$INIT" requirements_path)
RESEARCH_PATH=$(_gsd_field "$INIT" research_path)
VERIFICATION_PATH=$(_gsd_field "$INIT" verification_path)
UAT_PATH=$(_gsd_field "$INIT" uat_path)
CONTEXT_PATH=$(_gsd_field "$INIT" context_path)
REVIEWS_PATH=$(_gsd_field "$INIT" reviews_path)
PATTERNS_PATH=$(_gsd_field "$INIT" patterns_path)

# 检测 spike/sketch findings skills（项目本地）
SPIKE_FINDINGS_PATH=$(ls ./.claude/skills/spike-findings-*/SKILL.md 2>/dev/null | head -1)
SKETCH_FINDINGS_PATH=$(ls ./.claude/skills/sketch-findings-*/SKILL.md 2>/dev/null | head -1)
```

## 7.5. Verify Nyquist Artifacts

若 `nyquist_validation_enabled` 为 false 或 `research_enabled` 为 false，则跳过。

若同时满足以下条件，也跳过：
- `research_enabled` 为 false
- `has_research` 为 false
- 未提供 `--research` 标志

在这条无 research 路径中，本次运行**不要求** Nyquist 产物。

```bash
VALIDATION_EXISTS=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
```

如果缺失，且 Nyquist 仍启用/适用——询问用户：
1. 重新运行：`/gsd-plan-phase {PHASE} --research ${GSD_WS}`
2. 用精确命令禁用 Nyquist：
   `gsd-sdk query config-set workflow.nyquist_validation false`
3. 仍然继续（plans 会失败于 Dimension 8）

仅当用户选择 2 或 3 时，才进入 Step 7.8（或在 pattern mapper 禁用时进入 Step 8）。

## 7.8. Spawn gsd-pattern-mapper Agent (Optional)

**跳过条件：** config.json 中 `workflow.pattern_mapper` 明确设为 `false`（缺失 key 视为启用）。如果该 phase 既没有 CONTEXT.md 也没有 RESEARCH.md（无文件列表可提取），也跳过。

检查配置：
```bash
PATTERN_MAPPER_CFG=$(gsd-sdk query config-get workflow.pattern_mapper 2>/dev/null || echo "true")
```

**如果 `PATTERN_MAPPER_CFG` 为 `false`：** 跳到 step 8。

**如果 PATTERNS.md 已存在**（step 7 中 `PATTERNS_PATH` 非空）：跳到 step 8（使用现有文件）。

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PATTERN MAPPING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在启动 pattern mapper...
```

Pattern mapper prompt：

```markdown
<pattern_mapping_context>
**Phase:** {phase_number} - {phase_name}
**Phase directory:** {phase_dir}
**Padded phase:** {padded_phase}

<files_to_read>
- {context_path} (来自 /gsd-discuss-phase 的 USER DECISIONS)
- {research_path} (Technical Research)
</files_to_read>

**Output file:** {phase_dir}/{padded_phase}-PATTERNS.md

从 CONTEXT.md 和 RESEARCH.md 中提取要创建/修改的文件列表。对每个文件，按角色和数据流分类，在代码库中找到最接近的现有类比，提取具体代码片段，并生成 PATTERNS.md。
</pattern_mapping_context>
```

启动方式：
```text
Task(
  prompt="{above}",
  subagent_type="gsd-pattern-mapper",
  model="{researcher_model}",
)
```

**处理返回：**
- **`## PATTERN MAPPING COMPLETE`：** 将 `PATTERNS_PATH` 更新为创建的文件路径，继续到 step 8。
- **任何错误或空返回：** 记录警告，不带 patterns 继续到 step 8（非阻塞）。

pattern mapper 完成后，更新路径变量：
```bash
PATTERNS_PATH="${PHASE_DIR}/${PADDED_PHASE}-PATTERNS.md"
```

## 8. Spawn gsd-planner Agent

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在启动 planner...
```

Planner prompt：

```markdown
<planning_context>
**Phase:** {phase_number}
**Mode:** {standard | gap_closure | reviews}

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (来自 /gsd-discuss-phase 的 USER DECISIONS)
- {research_path} (Technical Research)
- {PATTERNS_PATH} (Pattern Map — 类比文件和代码片段，如存在)
- {verification_path} (Verification Gaps - if --gaps)
- {uat_path} (UAT Gaps - if --gaps)
- {reviews_path} (Cross-AI Review Feedback - if --reviews)
- {UI_SPEC_PATH} (UI Design Contract — 视觉/交互规范，如存在)
- {SPIKE_FINDINGS_PATH} (Spike Findings — 来自实验的已验证模式、约束和雷区，如存在)
- {SKETCH_FINDINGS_PATH} (Sketch Findings — 已验证的设计决策、CSS 模式和视觉方向，如存在)
${CONTEXT_WINDOW >= 500000 ? `
**Cross-phase context (1M model enrichment):**
- 最近 3 个已完成 phase 的 CONTEXT.md 文件（锁定决策——保持一致性）
- 最近 3 个已完成 phase 的 SUMMARY.md 文件（已构建内容——复用模式，避免重复）
- 最近 3 个已完成 phase 的 LEARNINGS.md 文件（结构化决策、模式、经验、意外——若某个 phase 没有 LEARNINGS.md 则静默跳过；每个区块前加上 \`[from Phase N LEARNINGS]\` 以标注来源；若总大小超过上下文预算的 15%，则优先丢弃最旧的）
- 当前 phase 在 ROADMAP.md 的 "Depends on:" 字段中列出的任意 phase 的 CONTEXT.md、SUMMARY.md 和 LEARNINGS.md（无论新旧——显式依赖总会加载，并与最近 3 个去重）
- 跳过所有其他先前 phase，以控制上下文预算
` : ''}
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** {phase_req_ids}

**Project instructions:** 如存在，读取 ./CLAUDE.md —— 遵循项目特定指南
**Project skills:** 检查 .claude/skills/ 或 .agents/skills/ 目录（若任一存在）——读取 SKILL.md 文件，计划应考虑项目技能规则

${TDD_MODE === 'true' ? `
<tdd_mode_active>
**TDD Mode is ENABLED.** 对所有适用任务应用 @~/.claude/get-shit-done/references/tdd.md 中的 TDD 启发式：
- 具有明确 I/O 的业务逻辑 → type: tdd
- 有 request/response contracts 的 API endpoints → type: tdd
- 数据转换、验证、算法 → type: tdd
- UI、config、glue code、CRUD → 标准计划（type: execute）
每个 TDD plan 只处理一个 feature，并采用 RED/GREEN/REFACTOR gate sequence。
</tdd_mode_active>
` : ''}
</planning_context>

<downstream_consumer>
输出会被 /gsd-execute-phase 消费。Plans 需要：
- Frontmatter（wave, depends_on, files_modified, autonomous）
- XML 格式的 Tasks，并带有 read_first 和 acceptance_criteria 字段（每个 task 都是强制要求）
- Verification criteria
- 用于 goal-backward verification 的 must_haves
</downstream_consumer>

<deep_work_rules>
## Anti-Shallow Execution Rules (MANDATORY)

每个 task 都 MUST 包含以下字段——它们不是可选项：

1. **`<read_first>`** — executor 在动手前 MUST 读取的文件。始终包括：
   - 被修改的文件（让 executor 看到当前状态，而不是依赖假设）
   - CONTEXT.md 中引用的任何 "source of truth" 文件（参考实现、现有模式、config files、schemas）
   - 任何其 patterns、signatures、types 或 conventions 必须被复用或遵守的文件

2. **`<acceptance_criteria>`** — 可验证的条件，用来证明任务已正确完成。规则：
   - 每条 criterion 都必须能通过 grep、文件读取、测试命令或 CLI 输出检查
   - NEVER 使用主观语言（"looks correct", "properly configured", "consistent with"）
   - ALWAYS 包含必须出现的精确字符串、patterns、values 或 command outputs
   - 示例：
     - Code: `auth.py contains def verify_token(` / `test_auth.py exits 0`
     - Config: `.env.example contains DATABASE_URL=` / `Dockerfile contains HEALTHCHECK`
     - Docs: `README.md contains '## Installation'` / `API.md lists all endpoints`
     - Infra: `deploy.yml has rollback step` / `docker-compose.yml has healthcheck for db`

3. **`<action>`** — 必须包含具体值，而不是引用。规则：
   - NEVER 在未明确目标状态时写 "align X with Y", "match X to Y", "update to be consistent"
   - ALWAYS 写出实际值：config keys、function signatures、SQL statements、class names、import paths、env vars 等
   - 如果 CONTEXT.md 中有 comparison table 或 expected values，请逐字复制到 action 中
   - executor 应只凭 action 文本就能完成任务，无需再读 CONTEXT.md 或参考文件（read_first 用于验证，不用于探索）

**Why this matters:** Executor agents 是依据 plan text 执行的。像 "update the config to match production" 这样的模糊指令，会产生浅层的一行改动。而像 "add DATABASE_URL=postgresql://... , set POOL_SIZE=20, add REDIS_URL=redis://..." 这样的具体指令，才会产出完整工作。详细计划的成本，远低于返工浅执行的成本。
</deep_work_rules>

<quality_gate>
- [ ] 已在 phase 目录中创建 PLAN.md files
- [ ] 每个 plan 都有有效的 frontmatter
- [ ] 任务具体且可执行
- [ ] 每个 task 都有 `<read_first>`，且至少包含被修改的文件
- [ ] 每个 task 都有 `<acceptance_criteria>`，且条件可用 grep 验证
- [ ] 每个 `<action>` 都包含具体值（不能只写 "align X with Y" 而不说明具体内容）
- [ ] 已正确识别依赖关系
- [ ] 已为并行执行分配 waves
- [ ] must_haves 已从 phase goal 反推得出
</quality_gate>
```

**如果 `CHUNKED_MODE` 为 `false`（默认）：** 以单个长生命周期 Task 启动 planner：

```text
Task(
  prompt=filled_prompt,
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Plan Phase {phase}"
)
```

**如果 `CHUNKED_MODE` 为 `true`：** 跳过上面的 Task() 调用——继续到 step 8.5。

## 8.5. Chunked Planning Mode

**如果 `CHUNKED_MODE` 为 `false`，则跳过。**

Chunked 模式会把单个长生命周期 planner Task 拆分为一个短时的 outline Task，后跟
N 个短时的逐计划 Tasks。每个 Task 约束在 ~3–5 分钟；每个 plan 会单独提交，
以增强崩溃恢复能力。如果某个 Task 卡住且终端被强制杀掉，
重新运行 `/gsd-plan-phase {N} --chunked` 会从上一次成功提交的 plan 继续。

**适用于新的或进行中的 chunked 运行。** 若要恢复先前
*非 chunked* 运行已写出的 plans，请使用 step 6 的 "Add more plans"，或直接进入 `/gsd-execute-phase`
——不要在现有的非 chunked plans 之上重新开启一轮新的 chunked 运行。

### 8.5.1 Outline Phase (outline-only mode, ~2 min)

**恢复检测：** 如果 `${PHASE_DIR}/${PADDED_PHASE}-PLAN-OUTLINE.md` 已存在且**有效**
（包含 `## OUTLINE COMPLETE` 标记），则跳过此子步骤——outline
来自之前运行已存在。直接进入 8.5.2。

```bash
OUTLINE_FILE="${PHASE_DIR}/${PADDED_PHASE}-PLAN-OUTLINE.md"
if [[ -f "$OUTLINE_FILE" ]] && grep -q "^## OUTLINE COMPLETE" "$OUTLINE_FILE"; then
  # 复用现有 outline —— 跳到 8.5.2
fi
```

显示：
```text
◆ Chunked mode: 正在启动 outline planner...
```

以 **outline-only** 模式启动 planner——它只能写 outline manifest，不能写任何
PLAN.md files：

```javascript
Task(
  prompt="{same planning_context as step 8, plus:}

  **Chunked mode: outline-only.**
  在此 Task 中不要写任何 PLAN.md files。
  只写：{PHASE_DIR}/{PADDED_PHASE}-PLAN-OUTLINE.md

  outline 必须是一个 markdown table，列为：
  Plan ID | Objective | Wave | Depends On | Requirements

  返回：## OUTLINE COMPLETE with plan count.",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Outline Phase {phase} (chunked)"
)
```

处理返回：
- **`## OUTLINE COMPLETE`：** 读取 `PLAN-OUTLINE.md`，提取 plan 列表。继续到 8.5.2。
- **任何其他返回或空返回：** 显示错误。提供：1) Retry outline，2) Stop。

### 8.5.2 Per-Plan Tasks (single-plan mode, ~3-5 min each)

对从 `PLAN-OUTLINE.md` 提取出的每个 plan 条目：

1. **恢复检查：** 如果磁盘上已存在 `${PHASE_DIR}/{plan_id}-PLAN.md`，且具有
   有效 YAML frontmatter（存在开头的 `---` delimiter），则跳过该 plan（不要
   覆盖已完成工作——确保恢复安全）。

   ```bash
   PLAN_FILE="${PHASE_DIR}/${plan_id}-PLAN.md"
   if [[ -f "$PLAN_FILE" ]] && head -1 "$PLAN_FILE" | grep -q '^---'; then
     continue  # plan 已写入，跳过
   fi
   ```

2. 显示：
   ```text
   ◆ Chunked mode: 正在规划 {plan_id} ({k}/{N})...
   ```

3. 以 **single-plan** 模式启动 planner——它必须只写一个 PLAN.md 文件：
   ```javascript
   Task(
     prompt="{same planning_context as step 8, plus:}

     **Chunked mode: single-plan.**
     只写且必须写一个计划文件：{PHASE_DIR}/{plan_id}-PLAN.md
     要写的 plan：{plan_id} — {objective}
     Wave: {wave} | Depends on: {depends_on}
     该 plan 需要覆盖的 Phase requirement IDs：{plan_requirements}

     返回：## PLAN COMPLETE with the plan ID.",
     subagent_type="gsd-planner",
     model="{planner_model}",
     description="Plan {plan_id} (chunked {k}/{N})"
   )
   ```

4. **检查磁盘：** 确认 `${PHASE_DIR}/{plan_id}-PLAN.md` 存在。若缺失：提供 1) Retry，2) Stop。

5. **逐 plan 提交：**
   ```bash
   gsd-sdk query commit "docs(${PADDED_PHASE}): plan ${plan_id} (chunked)" "${PHASE_DIR}/${plan_id}-PLAN.md"
   ```

当全部 N 个 plans 都写入并提交后，将其视为 `## PLANNING COMPLETE`，继续
到 step 9。

## 9. Handle Planner Return

- **`## PLANNING COMPLETE`：** 显示计划数量。如果存在 `--skip-verify` 或 `plan_checker_enabled` 为 false（来自 init）：跳到 step 13。否则：进入 step 10。
- **`## PHASE SPLIT RECOMMENDED`：** planner 判断该 phase 超出了上下文预算，无法高保真地实现所有 source items。在 step 9b 处理。
- **`## ⚠ Source Audit: Unplanned Items Found`：** planner 的 multi-source coverage audit 发现 REQUIREMENTS.md、RESEARCH.md、ROADMAP goal 或 CONTEXT.md decisions 中的部分项目未被任何 plan 覆盖。在 step 9c 处理。
- **`## CHECKPOINT REACHED`：** 展示给用户，获取响应，启动 continuation（step 12）
- **`## PLANNING INCONCLUSIVE`：** 显示尝试结果，并提供：Add context / Retry / Manual
- **空 / 截断 / 无可识别标记：** → Filesystem fallback（step 9a）。

## 9a. Filesystem Fallback (Planner)

**触发条件：** Task() 已返回，但返回内容不包含任何已识别标记（`## PLANNING COMPLETE`、`## PHASE SPLIT RECOMMENDED`、`## ⚠ Source Audit`、`## CHECKPOINT REACHED`、`## PLANNING INCONCLUSIVE`）。

```bash
DISK_PLANS=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
```

**如果 `DISK_PLANS` > 0：** planner 已把 plans 写到磁盘，但 Task() 返回为空或
被截断（Windows stdio hang pattern——subagent 已完成，但返回未送达）。显示：

```text
◆ Planner 已将 {DISK_PLANS} 个 plans 写入磁盘，但没有输出 PLANNING COMPLETE marker。
  这是已知的 Windows stdio hang pattern——工作大概率是可恢复的。

  磁盘上找到的 plans：
  {ls output of *-PLAN.md}
```

提供 3 个选项：
1. **Accept plans** — 视为 `## PLANNING COMPLETE`，并按 step 9 中 `## PLANNING COMPLETE` 的处理继续（这样 `--skip-verify` / `plan_checker_enabled=false` 也会生效——可能跳到 step 13 而不是 step 10）
2. **Retry planner** — 用相同 prompt 重新启动 planner（回到 step 8）
3. **Stop** — 退出；用户可重新运行 `/gsd-plan-phase {N}` 继续

**如果 `DISK_PLANS` 为 0 且无 marker：** planner 未产出任何内容。按
`## PLANNING INCONCLUSIVE` 处理。

## 9b. Handle Phase Split Recommendation

当 planner 返回 `## PHASE SPLIT RECOMMENDED` 时，表示该 phase 的 source items 超出了高保真实现所允许的上下文预算。planner 会提出分组建议。

**从 planner 返回中提取：**
- 建议的子 phases（例如 "17a: processing core (D-01 to D-19)", "17b: billing + config UX (D-20 to D-27)"）
- 各子 phase 包含哪些 source items（REQ-IDs、D-XX decisions、RESEARCH items）
- 为什么必须拆分（上下文成本估算、文件数）

**向用户展示：**
```text
## Phase {X} 超出了高保真实现的上下文预算

planner 发现有 {N} 个 source items 会导致
按高保真方式规划时超出上下文预算。与其降低质量，我们建议拆分：

**Option 1: Split into sub-phases**
- Phase {X}a: {name} — {items} ({N} source items, ~{P}% context)
- Phase {X}b: {name} — {items} ({M} source items, ~{Q}% context)

**Option 2: Proceed anyway**（planner 将尝试全部规划，但超过 50% context 后质量可能下降）

**Option 3: Prioritize** — 由你选择本次先实现哪些 items，
其余作为后续 phase
```

使用 AskUserQuestion 提供这 3 个选项。

**如果选择 "Split"：** 使用 `/gsd-insert-phase` 创建子 phases，然后分别重新规划。
**如果选择 "Proceed"：** 返回 planner，并指示其尝试对所有 items 进行高保真规划，接受更多 plans/tasks。
**如果选择 "Prioritize"：** 使用 AskUserQuestion（multiSelect）让用户选择哪些 items 属于 "now"，哪些属于 "later"。为每个子 phase 创建 CONTEXT.md，记录所选 items。

## 9c. Handle Source Audit Gaps

当 planner 返回 `## ⚠ Source Audit: Unplanned Items Found` 时，表示 REQUIREMENTS.md、RESEARCH.md、ROADMAP goal 或 CONTEXT.md decisions 中的某些 items 没有对应 plan。

**从 planner 返回中提取：**
- 每个未规划 item 及其 source artifact 和 section
- planner 给出的建议选项（A: add plan，B: split phase，C: defer with confirmation）

**向用户逐项展示缺口。** 对每个未规划 item：

```text
## ⚠ Unplanned: {item description}

Source: {RESEARCH.md / REQUIREMENTS.md / ROADMAP goal / CONTEXT.md}
Details: {why the planner flagged this}

Options:
1. Add a plan to cover this item (recommended)
2. Split phase — move to a sub-phase with related items
3. Defer — add to backlog (developer confirms this is intentional)
```

对每个缺口使用 AskUserQuestion（如果缺口较多，也可批量处理）。

**如果选择 "Add plan"：** 返回 planner（step 8），要求其在保留现有 plans 的前提下，新增覆盖缺失 items 的 plans。
**如果选择 "Split"：** 对溢出 items 使用 `/gsd-insert-phase`，然后重新规划。
**如果选择 "Defer"：** 在 CONTEXT.md 的 `## Deferred Ideas` 中记录，并附上 developer 的确认。继续到 step 10。

## 10. Spawn gsd-plan-checker Agent

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在启动 plan checker...
```

Checker prompt：

```markdown
<verification_context>
**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (待验证的 plans)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (来自 /gsd-discuss-phase 的 USER DECISIONS)
- {research_path} (Technical Research — 包含 Validation Architecture)
</files_to_read>

${AGENT_SKILLS_CHECKER}

**Phase requirement IDs (MUST ALL be covered):** {phase_req_ids}

**Project instructions:** 如存在，读取 ./CLAUDE.md —— 验证 plans 是否遵守项目指南
**Project skills:** 检查 .claude/skills/ 或 .agents/skills/ 目录（若任一存在）——验证 plans 是否考虑项目技能规则
</verification_context>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```text
Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} plans"
)
```

## 11. Handle Checker Return

- **`## VERIFICATION PASSED`：** 显示确认信息，继续到 step 13。
- **`## ISSUES FOUND`：** 显示问题，检查迭代次数，继续到 step 12。
- **空 / 截断 / 无可识别标记：** → Filesystem fallback（step 11a）。

**Thinking partner for architectural tradeoffs（条件启用）：**
如果启用了 `features.thinking_partner`，扫描 checker 的问题中是否包含架构权衡关键词
（"architecture"、"approach"、"strategy"、"pattern"、"vs"、"alternative"）。如果找到：

```text
plan-checker 标记了一个架构决策点：
{issue description}

简要分析：
- Option A: {approach_from_plan} — {pros/cons}
- Option B: {alternative_approach} — {pros/cons}
- Recommendation: {choice}，与 {phase_goal} 对齐

是否将此建议应用到修订中？ [Yes] / [No, I'll decide]
```

如果选择 yes：在 revision prompt 中包含该建议。如果选择 no：按正常流程进入修订循环。
如果 thinking_partner 被禁用：完全跳过此块。

## 11a. Filesystem Fallback (Checker)

**触发条件：** Checker Task() 已返回，但返回内容既不包含 `## VERIFICATION PASSED`，也不包含 `## ISSUES FOUND`。

```bash
DISK_PLANS=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
```

**如果 `DISK_PLANS` > 0：** 磁盘上存在 plans；checker 返回为空或被截断（
Windows stdio hang pattern——subagent 已完成，但返回未送达）。显示：

```text
◆ Checker 返回为空或被截断。磁盘上存在 {DISK_PLANS} 个 plans。
  这是已知的 Windows stdio hang pattern——checker 可能已完成但未返回结果。
```

提供 3 个选项：
1. **Accept verification** — 视为 `## VERIFICATION PASSED`，继续到 step 13
2. **Retry checker** — 用相同 prompt 重新启动 checker（回到 step 10）
3. **Stop** — 退出；用户可重新运行 `/gsd-plan-phase {N}` 继续

**如果 `DISK_PLANS` 为 0：** 磁盘上没有 plans——说明问题严重。显示错误并停止。

## 12. Revision Loop (Max 3 Iterations)

跟踪 `iteration_count`（初始 plan + check 后从 1 开始）。
跟踪 `prev_issue_count`（在循环开始前初始化为 `Infinity`）。
跟踪 `stall_reentry_count`（从 0 开始；每次 "Adjust approach" 重新进入 step 8 时递增）。

**如果 iteration_count < 3：**

从 checker 返回中解析 issue 数量：统计 YAML issues block 中 BLOCKER + WARNING 条目数（gsd-plan-checker 的 structured output）。如果 checker 返回中没有 YAML issues block（即 plan 被批准且无问题），则将 `issue_count` 视为 0，并跳过 stall 检查——计划已通过。继续到 step 13。

显示：`Revision iteration {N}/3 -- {blocker_count} blockers, {warning_count} warnings`

**Stall detection：** 如果 `issue_count >= prev_issue_count`：
  显示：`Revision loop stalled — issue count not decreasing ({issue_count} issues remain after {N} iterations)`

  **如果 `stall_reentry_count < 2`：**
    询问用户：
      Question: "经过 {N} 次修订尝试后，问题仍未减少。是否继续使用当前结果？"
      Options: "Proceed anyway" | "Adjust approach"
    如果选择 "Proceed anyway"：接受当前 plans，继续到 step 13。
    如果选择 "Adjust approach"：递增 `stall_reentry_count`，开启自由讨论，然后重新进入 step 8（完整重新规划）。注意：重新进入会重置 `iteration_count` 和 `prev_issue_count`，但 `stall_reentry_count` 会跨重入保留，且上限为 2。

  **如果 `stall_reentry_count >= 2`：**
    显示：`在 2 次重新规划尝试后，仍然停滞。以下问题无法自动解决：`
    列出 checker 剩余的问题。
    建议："请考虑手动解决这些问题，或运行 `/gsd-debug` 调查根因。"
    Options: "Proceed anyway" | "Abandon"
    如果选择 "Proceed anyway"：接受当前 plans，继续到 step 13。
    如果选择 "Abandon"：停止工作流。

设置 `prev_issue_count = issue_count`。

Revision prompt：

```markdown
<revision_context>
**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (现有 plans)
- {context_path} (来自 /gsd-discuss-phase 的 USER DECISIONS)
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Checker issues:** {structured_issues_from_checker}
</revision_context>

<instructions>
进行有针对性的修改以修复 checker 提出的问题。
除非问题属于根本性问题，否则不要从头重新规划。
返回修改内容。
</instructions>
```

```text
Task(
  prompt=revision_prompt,
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

planner 返回后 -> 再次启动 checker（step 10），并递增 iteration_count。

**如果 iteration_count >= 3：**

显示：`Max iterations reached. {N} issues remain:` + 问题列表

提供：1) Force proceed，2) Provide guidance and retry，3) Abandon

## 12.5. Plan Bounce (Optional External Refinement)

**跳过条件：** 存在 `--skip-bounce` 标志、`--gaps` 标志，或 bounce 未激活。

**激活方式：** 当存在 `--bounce` 标志，或 `workflow.plan_bounce` 配置为 `true` 时执行 bounce。`--skip-bounce` 始终优先（即使配置启用，也会禁用 bounce）。`--gaps` 也会禁用 bounce（gap-closure 模式不应对 plans 做外部修改）。

**前提条件：** `workflow.plan_bounce_script` 必须设置为有效脚本路径。如果 bounce 已激活但未配置脚本，则显示警告并跳过：
```text
⚠ Plan bounce 已激活，但未配置脚本。
请将 workflow.plan_bounce_script 设置为你的 refinement script 路径。
跳过 bounce 步骤。
```

**读取 pass 次数：**
```bash
BOUNCE_PASSES=$(gsd-sdk query config-get workflow.plan_bounce_passes 2>/dev/null || echo "2")
BOUNCE_SCRIPT=$(gsd-sdk query config-get workflow.plan_bounce_script 2>/dev/null | jq -r '.' 2>/dev/null || true)
```

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► BOUNCING PLANS (External Refinement)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Script: ${BOUNCE_SCRIPT}
Max passes: ${BOUNCE_PASSES}
```

**对 phase 目录中的每个 PLAN.md 文件：**

1. **备份：** 将 `*-PLAN.md` 复制为 `*-PLAN.pre-bounce.md`
```bash
cp "${PLAN_FILE}" "${PLAN_FILE%.md}.pre-bounce.md"
```

2. **调用 bounce script：**
```bash
"${BOUNCE_SCRIPT}" "${PLAN_FILE}" "${BOUNCE_PASSES}"
```

3. **验证 bounced plan——YAML frontmatter 完整性：**
script 返回后，检查 bounced 文件是否仍具有有效 YAML frontmatter（开头和结尾的 `---` delimiters，且其间内容可解析）。如果 bounced plan 破坏了 YAML frontmatter 验证，则从 pre-bounce.md 备份恢复原文件，并继续处理下一个 plan：
```text
⚠ Bounced plan ${PLAN_FILE} 的 YAML frontmatter 已损坏——从 pre-bounce 备份恢复原文件。
```

4. **处理脚本失败：** 如果 bounce script 以非零状态退出，则从 pre-bounce.md 备份恢复原 plan，并继续处理下一个 plan：
```text
⚠ ${PLAN_FILE} 的 bounce script 失败（exit code ${EXIT_CODE}）——从 pre-bounce 备份恢复原文件。
```

5. **在 bounced plans 上重新运行 plan checker：** 对所有已修改的 plans 启动 gsd-plan-checker（与 step 10 相同）。如果某个 bounced plan 未通过 checker，则从其 pre-bounce.md 备份恢复原文件：
```text
⚠ Bounced plan ${PLAN_FILE} 未通过 checker 验证——从 pre-bounce 备份恢复原文件。
```

6. **提交保留下来的 bounced plans：** 如果至少有一个 plan 同时通过了 frontmatter 验证和 checker 重跑，则提交这些更改：
```bash
gsd-sdk query commit "refactor(${padded_phase}): bounce plans through external refinement" "${PHASE_DIR}/*-PLAN.md"
```

显示摘要：
```text
Plan bounce complete: {survived}/{total} plans refined
```

**清理：** 在 bounce 步骤完成后（无论 plans 被保留还是被恢复），删除所有 `*-PLAN.pre-bounce.md` 备份文件。

## 13. Requirements Coverage Gate

在 plans 通过 checker（或跳过 checker）后，验证所有 phase requirements 是否至少被一个 plan 覆盖。

**跳过条件：** `phase_req_ids` 为 null 或 TBD（该 phase 未映射 requirements）。

**Step 1: Extract requirement IDs claimed by plans**
```bash
# 从 plan frontmatter 收集所有 requirement IDs
PLAN_REQS=$(grep -h "requirements_addressed\|requirements:" ${PHASE_DIR}/*-PLAN.md 2>/dev/null | tr -d '[]' | tr ',' '\n' | sed 's/^[[:space:]]*//' | sort -u)
```

**Step 2: Compare against phase requirements from ROADMAP**

对 `phase_req_ids` 中的每个 REQ-ID：
- 如果 REQ-ID 出现在 `PLAN_REQS` 中 → 已覆盖 ✓
- 如果 REQ-ID 未出现在任何 plan 中 → 未覆盖 ✗

**Step 3: Check CONTEXT.md features against plan objectives**

读取 CONTEXT.md 的 `<decisions>` 部分。提取 feature/capability 名称。将每项与 plan 的 `<objective>` blocks 对比。未在任何 plan objective 中提到的 feature → 可能被遗漏。

**Step 4: Report**

如果所有 requirements 都已覆盖，且没有遗漏的 features：
```text
✓ Requirements coverage: {N}/{N} REQ-IDs covered by plans
```
→ 继续到 step 14。

如果发现缺口：
```text
## ⚠ Requirements Coverage Gap

{M} of {N} phase requirements are not assigned to any plan:

| REQ-ID | Description | Plans |
|--------|-------------|-------|
| {id} | {from REQUIREMENTS.md} | None |

{K} CONTEXT.md features not found in plan objectives:
- {feature_name} — 在 CONTEXT.md 中有描述，但没有 plan 覆盖它

Options:
1. Re-plan to include missing requirements (recommended)
2. Move uncovered requirements to next phase
3. Proceed anyway — accept coverage gaps
```

如果 `TEXT_MODE` 为 true，则以纯文本编号列表展示（上面的块中已给出选项）。否则使用 AskUserQuestion 展示这些选项。

## 13b. Record Planning Completion in STATE.md

在 plans 通过所有 gates 后，记录规划已完成，以便 STATE.md 反映新的 phase 状态：

```bash
gsd-sdk query state.planned-phase --phase "${PHASE_NUMBER}" --name "${PHASE_NAME}" --plans "${PLAN_COUNT}"
```

这会将 STATUS 更新为 "Ready to execute"，设置正确的计划数，并为 Last Activity 添加时间戳。

## 13c. Annotate ROADMAP with Wave Dependencies and Cross-cutting Constraints

在 plans 最终确定后，为该 phase 的 ROADMAP.md plan 列表添加以下注释：
- **Wave dependency notes** — 在每个 wave 分组前加入加粗标题（"Wave 2 *(blocked on Wave 1 completion)*"）
- **Cross-cutting constraints** — 添加一个 "Cross-cutting constraints:" 子节，列出出现在 2 个或更多 plans 中的 `must_haves.truths` 条目

这一步完全基于现有 PLAN frontmatter 推导——不需要额外的 LLM pass。

```bash
gsd-sdk query roadmap.annotate-dependencies "${PHASE_NUMBER}"
```

该操作是幂等的：如果 ROADMAP phase section 中已存在 wave headers 或 cross-cutting constraints，命令会直接返回而不修改文件。如果 `plan_count` 为 0，则跳过此步骤。

## 13d. Commit Plans if commit_docs is true

如果 `commit_docs` 为 true（来自 step 1 中解析的 init JSON），则提交生成的计划产物（包括 step 13c 中对 ROADMAP.md 的任何注释）：

```bash
gsd-sdk query commit "docs(${PADDED_PHASE}): create phase plan" --files "${PHASE_DIR}"/*-PLAN.md .planning/STATE.md .planning/ROADMAP.md
```

这会将该 phase 的所有 PLAN.md 文件，以及更新后的 STATE.md 和 ROADMAP.md 一并提交，以便对规划产物进行版本控制。如果 `commit_docs` 为 false，则跳过此步骤。

## 14. Present Final Status

根据 flags/config 路由到 `<offer_next>` 或 `auto_advance`。

## 15. Auto-Advance Check

使用 step 1 中已加载的值检查 auto-advance 触发条件：

1. 从 $ARGUMENTS 解析 `--auto` 和 `--chain` flags
2. 使用 step 1 中已解析的 INIT JSON 里的 `auto_chain_active` 和 `auto_advance` —— **不要为这些值额外发起 `config-get` 调用**（它们已存在于 init 输出中）。对已在 INIT 中的值重复发起 `config-get` 调用，在某些运行时会导致无限读取循环。
3. **将 chain flag 与意图同步** —— 如果用户是手动调用（没有 `--auto` 且没有 `--chain`），则清除任何来自之前中断的 `--auto` chain 的临时 chain flag。这**不会**修改 `workflow.auto_advance`（用户持久的设置偏好）：
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]] && [[ ! "$ARGUMENTS" =~ --chain ]]; then
     gsd-sdk query config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```

从 INIT 设置本地变量（在 step 1 中解析一次）：
- `AUTO_CHAIN` = INIT JSON 中的 `auto_chain_active`（boolean，默认 false）
- `AUTO_CFG` = INIT JSON 中的 `auto_advance`（boolean，默认 false）

**如果存在 `--auto` 或 `--chain` flag，且 `AUTO_CHAIN` 不为 true：** 将 chain flag 持久化到 config 中（处理未经过 discuss-phase 的直接调用）：
```bash
if ([[ "$ARGUMENTS" =~ --auto ]] || [[ "$ARGUMENTS" =~ --chain ]]) && [[ "$AUTO_CHAIN" != "true" ]]; then
  gsd-sdk query config-set workflow._auto_chain_active true
fi
```

**如果存在 `--auto` 或 `--chain` flag，或 `AUTO_CHAIN` 为 true，或 `AUTO_CFG` 为 true：**

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO EXECUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plans 已就绪。正在启动 execute-phase...
```

使用 Skill tool 启动 execute-phase，以避免嵌套 Task sessions（深层 agent 嵌套会导致运行时卡死）：
```text
Skill(skill="gsd-execute-phase", args="${PHASE} --auto --no-transition ${GSD_WS}")
```

`--no-transition` flag 会告知 execute-phase 在验证后返回状态，而不是继续链式到后续步骤。这样可以保持 auto-advance chain 扁平化——每个 phase 都在同一嵌套层级运行，而不是继续生成更深的 Task agents。

**处理 execute-phase 返回：**
- **PHASE COMPLETE** → 显示最终摘要：
  ```text
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${PHASE} COMPLETE ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline 已完成。

  Next: /gsd-discuss-phase ${NEXT_PHASE} --auto ${GSD_WS}
  ```
- **GAPS FOUND / VERIFICATION FAILED** → 显示结果，并停止 chain：
  ```text
  Auto-advance 已停止：Execution needs review.

  请查看上方输出并手动继续：
  /gsd-execute-phase ${PHASE} ${GSD_WS}
  ```

**如果既没有 `--auto`，配置也未启用：**
路由到 `<offer_next>`（现有行为）。

</process>

<offer_next>
直接输出以下 markdown（不要作为代码块）：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {X} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} 个 plan，分布在 {M} 个 wave 中

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Used existing | Skipped}
Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────────────────────────

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Execute Phase {X}** — 运行全部 {N} 个 plans

/clear then:

/gsd-execute-phase {X} ${GSD_WS}

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase-dir}/*-PLAN.md — 审查 plans
- /gsd-plan-phase {X} --research — 先重新 research
- /gsd-review --phase {X} --all — 使用外部 AIs 对 plans 做 peer review
- /gsd-plan-phase {X} --reviews — 融合 review feedback 后重新规划

───────────────────────────────────────────────────────────────
</offer_next>

<windows_troubleshooting>
**Windows users:** 如果 plan-phase 在启动 agent 时卡住（Windows 上常见，原因是
MCP servers 导致的 stdio deadlocks——见 Claude Code issue anthropics/claude-code#28126）：

1. **强制结束：** 关闭终端（Ctrl+C 可能不起作用）
2. **清理孤儿进程：**
   ```powershell
   # 杀掉来自陈旧 MCP servers 的孤儿 node 进程
   Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.StartTime -lt (Get-Date).AddHours(-1)} | Stop-Process -Force
   ```
3. **清理陈旧 task 目录：**
   ```powershell
   # 删除陈旧的 subagent task dirs（Claude Code 崩溃时从不清理这些）
   Remove-Item -Recurse -Force "$env:USERPROFILE\.claude\tasks\*" -ErrorAction SilentlyContinue
   ```
4. **减少 MCP server 数量：** 在 settings.json 中临时禁用非关键的 MCP servers
5. **重试：** 重启 Claude Code 并再次运行 `/gsd-plan-phase`

如果仍然卡住，可尝试 `--skip-research`，将 agent chain 从 3 个减少到 2 个：
```text
/gsd-plan-phase N --skip-research
```
</windows_troubleshooting>

<success_criteria>
- [ ] 已验证 .planning/ 目录
- [ ] 已根据 roadmap 验证 phase
- [ ] 必要时已创建 phase 目录
- [ ] 已提前加载 CONTEXT.md（step 4）并传递给所有 agents
- [ ] 已完成 research（除非 --skip-research 或 --gaps 或已存在）
- [ ] 已使用 CONTEXT.md 启动 gsd-phase-researcher
- [ ] 已检查现有 plans
- [ ] 已使用 CONTEXT.md + RESEARCH.md 启动 gsd-planner
- [ ] 已创建 plans（已处理 PLANNING COMPLETE 或 CHECKPOINT）
- [ ] 已使用 CONTEXT.md 启动 gsd-plan-checker
- [ ] 验证已通过，或用户覆盖，或达到最大迭代后由用户作出决定
- [ ] 用户能在各 agent 启动之间看到状态
- [ ] 用户清楚下一步操作
</success_criteria>
