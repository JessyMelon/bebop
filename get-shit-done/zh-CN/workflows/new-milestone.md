<purpose>

为现有项目开启一个新的 milestone 周期。加载项目上下文，收集 milestone 目标（来自 MILESTONE-CONTEXT.md 或当前对话），更新 PROJECT.md 和 STATE.md，可选地并行执行 research，定义带有 REQ-ID 的范围化 requirements，启动 roadmapper 生成分阶段执行计划，并提交所有产物。相当于 existing project 场景下的 new-project。

</purpose>

<required_reading>

开始前，读取调用 prompt 的 execution_context 中引用的所有文件。

</required_reading>

<available_agent_types>
有效的 GSD subagent types（使用精确名称，不要回退到 `general-purpose`）：
- gsd-project-researcher — 研究项目级技术决策
- gsd-research-synthesizer — 汇总并行 research agents 的发现
- gsd-roadmapper — 创建分阶段执行 roadmap
</available_agent_types>

<process>

## 1. 加载上下文

在做任何其他事情之前先解析 `$ARGUMENTS`：
- `--reset-phase-numbers` flag → 选择将 roadmap phase 编号重新从 `1` 开始
- 剩余文本 → 如果存在，则作为 milestone 名称

如果该 flag 不存在，则保持当前行为：phase 编号从上一个 milestone 延续。

- 读取 PROJECT.md（现有项目、已验证 requirements、决策）
- 读取 MILESTONES.md（之前交付了什么）
- 读取 STATE.md（待办事项、blockers）
- 检查是否存在 MILESTONE-CONTEXT.md（来自 /gsd-discuss-milestone）

## 2. 收集 Milestone Goals

**如果存在 MILESTONE-CONTEXT.md：**
- 使用 discuss-milestone 中的功能和范围
- 展示摘要供确认

**如果没有 context 文件：**
- 展示上一个 milestone 已交付的内容

**Text mode（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 `TEXT_MODE` 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。
- 内联提问（freeform，不要用 AskUserQuestion）：`"What do you want to build next?"`
- 等待用户回复，然后使用 AskUserQuestion 继续追问细节
- 如果用户在任何时点选择 `"Other"` 以提供 freeform 输入，后续追问要使用纯文本，而不是再次使用 AskUserQuestion

## 2.5. 扫描 Planted Seeds

检查 `.planning/seeds/` 中是否存在与 step 2 收集到的 milestone goals 匹配的 seed 文件。

```bash
ls .planning/seeds/SEED-*.md 2>/dev/null
```

**如果没有 seed 文件：** 静默跳过此步骤，不输出任何消息，也不提示用户。

**如果存在 seed 文件：** 读取每个 `SEED-*.md` 文件，并从 frontmatter 和正文中提取：
- **Idea** — seed 标题（frontmatter 后的 heading，例如 `# SEED-001: <idea>`）
- **Trigger conditions** — `trigger_when` frontmatter 字段，以及 `"When to Surface"` section 中的 bullet list
- **Planted during** — `planted_during` frontmatter 字段（作为上下文）

将每个 seed 的 trigger conditions 与 step 2 中的 milestone goals 进行比对。当 seed 的 trigger conditions 与该 milestone 的任一目标功能或目标相关时，即视为匹配。

**如果没有 seed 匹配：** 静默跳过，不提示用户。

**如果找到了匹配的 seeds：**

**`--auto` mode：** 自动选择所有匹配的 seeds。记录：`[auto] Selected N matching seed(s): [list seed names]`

**Text mode（`TEXT_MODE=true`）：** 将匹配的 seeds 以纯文本编号列表形式展示：
```
Seeds that match your milestone goals:
1. SEED-001: <idea> (trigger: <trigger_when>)
2. SEED-003: <idea> (trigger: <trigger_when>)

Enter numbers to include (comma-separated), or "none" to skip:
```

**Normal mode：** 通过 AskUserQuestion 展示：
```
AskUserQuestion(
  header: "Seeds",
  question: "These planted seeds match your milestone goals. Include any in this milestone's scope?",
  multiSelect: true,
  options: [
    { label: "SEED-001: <idea>", description: "Trigger: <trigger_when> | Planted during: <planted_during>" },
    ...
  ]
)
```

**选择完成后：**
- 被选中的 seeds 会在 step 9 中作为定义 requirements 的额外上下文。将它们存入一个累加器（例如 `$SELECTED_SEEDS`），这样 step 9 就可以在定义 requirements 时引用这些想法及其 `"Why This Matters"` sections。
- 未选中的 seeds 保持在 `.planning/seeds/` 中不变，绝不要在此 workflow 中删除或修改 seed 文件。

## 3. 确定 Milestone Version

- 从 MILESTONES.md 解析最后一个版本
- 建议下一个版本（v1.0 → v1.1，或大版本升级为 v2.0）
- 与用户确认

## 3.5. 验证对 Milestone 的理解

在写入任何文件之前，先展示已收集内容的摘要，并请求确认。

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

**Goal:** [One sentence]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]

**Key context:** [Any important constraints, decisions, or notes from questioning]
```

AskUserQuestion：
- header: `"Confirm?"`
- question: `"Does this capture what you want to build in this milestone?"`
- options:
  - `"Looks good"` — 继续写入 PROJECT.md
  - `"Adjust"` — 我来修正或补充细节

**如果选择 `"Adjust"`：** 询问需要修改什么（纯文本，不要用 AskUserQuestion）。合并这些修改后重新展示摘要。循环直到选择 `"Looks good"`。

**如果选择 `"Looks good"`：** 继续执行 Step 4。

## 4. 更新 PROJECT.md

添加或更新：

```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence describing milestone focus]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]
```

更新 Active requirements section 和 `Last updated` footer。

确保 PROJECT.md 中存在 `## Evolution` section。如果缺失（例如创建于此功能之前的项目），就在 footer 前补上：

```markdown
## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
```

## 5. 更新 STATE.md

```markdown
## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: [today] — Milestone v[X.Y] started
```

保留上一个 milestone 的 `Accumulated Context` section。

## 6. 清理并 Commit

如果存在 MILESTONE-CONTEXT.md，则删除它（已消费）。

清理上一个 milestone 残留的 phase 目录：

```bash
gsd-sdk query phases.clear --confirm
```

```bash
gsd-sdk query commit "docs: start milestone v[X.Y] [Name]" .planning/PROJECT.md .planning/STATE.md
```

## 7. 加载上下文并解析 Models

```bash
INIT=$(gsd-sdk query init.new-milestone)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_RESEARCHER=$(gsd-sdk query agent-skills gsd-project-researcher 2>/dev/null)
AGENT_SKILLS_SYNTHESIZER=$(gsd-sdk query agent-skills gsd-synthesizer 2>/dev/null)
AGENT_SKILLS_ROADMAPPER=$(gsd-sdk query agent-skills gsd-roadmapper 2>/dev/null)
```

从 init JSON 中提取：`researcher_model`、`synthesizer_model`、`roadmapper_model`、`commit_docs`、`research_enabled`、`current_milestone`、`project_exists`、`roadmap_exists`、`latest_completed_milestone`、`phase_dir_count`、`phase_archive_path`、`agents_installed`、`missing_agents`。

**如果 `agents_installed` 为 false：** 继续前先显示警告：
```
⚠ GSD agents not installed. The following agents are missing from your agents directory:
  {missing_agents joined with newline}

Subagent spawns (gsd-project-researcher, gsd-research-synthesizer, gsd-roadmapper) will fail
with "agent type not found". Run the installer with --global to make agents available:

  npx get-shit-done-cc@latest --global

Proceeding without research subagents — roadmap will be generated inline.
```
跳过并行 research 启动步骤，直接内联生成 roadmap。

## 7.5 Reset-phase 安全检查（仅当使用 `--reset-phase-numbers`）

如果启用了 `--reset-phase-numbers`：

1. 将即将生成的 roadmap 的起始 phase 编号设为 `1`。
2. 如果 `phase_dir_count > 0`，则在进行 roadmapping 之前先归档旧的 phase 目录，避免新的 `01-*` / `02-*` 目录与旧 milestone 的目录冲突。

如果 `phase_dir_count > 0` 且 `phase_archive_path` 可用：

```bash
mkdir -p "${phase_archive_path}"
find .planning/phases -mindepth 1 -maxdepth 1 -type d -exec mv {} "${phase_archive_path}/" \;
```

然后确认 `.planning/phases/` 中已不再包含旧 milestone 目录，再继续。

如果 `phase_dir_count > 0` 但缺少 `phase_archive_path`：
- 停止并说明：在没有已完成 milestone 归档目标的情况下，重置编号是不安全的。
- 告诉用户先完成并归档上一个 milestone，然后再重新运行 `/gsd-new-milestone --reset-phase-numbers ${GSD_WS}`。

## 8. Research Decision

检查 init JSON（来自 config）中的 `research_enabled`。

**如果 `research_enabled` 为 `true`：**

AskUserQuestion: `"Research the domain ecosystem for new features before defining requirements?"`
- `"Research first (Recommended)"` — 为新能力发现模式、功能和架构
- `"Skip research for this milestone"` — 直接进入 requirements（不会改变你的默认设置）

**如果 `research_enabled` 为 `false`：**

AskUserQuestion: `"Research the domain ecosystem for new features before defining requirements?"`
- `"Skip research (current default)"` — 直接进入 requirements
- `"Research first"` — 为新能力发现模式、功能和架构

**IMPORTANT：** 不要将这个选择持久化到 `config.json`。`workflow.research` 是用户的持久偏好，会控制整个项目中 plan-phase 的行为。如果在这里修改它，会悄悄改变未来 `/gsd-plan-phase` 的行为。要修改默认值，请使用 `/gsd-settings`。

**如果用户选择 `"Research first"`：**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning 4 researchers in parallel...
  → Stack, Features, Architecture, Pitfalls
```

```bash
mkdir -p .planning/research
```

并行启动 4 个 `gsd-project-researcher` agents。每个都使用以下模板，并替换各自维度相关字段：

**4 个 researchers 的通用结构：**
```
Task(prompt="
<research_type>Project Research — {DIMENSION} for [new features].</research_type>

<milestone_context>
SUBSEQUENT MILESTONE — Adding [target features] to existing app.
{EXISTING_CONTEXT}
Focus ONLY on what's needed for the NEW features.
</milestone_context>

<question>{QUESTION}</question>

<files_to_read>
- .planning/PROJECT.md (Project context)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<downstream_consumer>{CONSUMER}</downstream_consumer>

<quality_gate>{GATES}</quality_gate>

<output>
Write to: .planning/research/{FILE}
Use template: ~/.claude/get-shit-done/templates/research-project/{FILE}
</output>
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="{DIMENSION} research")
```

**各维度字段：**

| Field | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| EXISTING_CONTEXT | Existing validated capabilities (DO NOT re-research): [from PROJECT.md] | Existing features (already built): [from PROJECT.md] | Existing architecture: [from PROJECT.md or codebase map] | Focus on common mistakes when ADDING these features to existing system |
| QUESTION | What stack additions/changes are needed for [new features]? | How do [target features] typically work? Expected behavior? | How do [target features] integrate with existing architecture? | Common mistakes when adding [target features] to [domain]? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md |

4 个 agents 全部完成后，再启动 synthesizer：

```
Task(prompt="
Synthesize research outputs into SUMMARY.md.

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>

${AGENT_SKILLS_SYNTHESIZER}

Write to: .planning/research/SUMMARY.md
Use template: ~/.claude/get-shit-done/templates/research-project/SUMMARY.md
Commit after writing.
", subagent_type="gsd-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

展示 `SUMMARY.md` 中的关键发现：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Stack additions:** [from SUMMARY.md]
**Feature table stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]
```

**如果选择 `"Skip research"`：** 继续执行 Step 9。

## 9. 定义 Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

读取 PROJECT.md：core value、当前 milestone goals、validated requirements（当前已存在的内容）。

**如果 `$SELECTED_SEEDS` 非空（来自 step 2.5）：** 在定义 requirements 时，将选中的 seed 想法及其 `"Why This Matters"` sections 作为额外输入。Seeds 提供了已被用户验证的功能想法，应与 research 结果或对话中收集到的功能一起纳入 requirement 分类。

**如果存在 research：** 读取 FEATURES.md，提取 feature categories。

按 category 展示功能：
```
## [Category 1]
**Table stakes:** Feature A, Feature B
**Differentiators:** Feature C, Feature D
**Research notes:** [any relevant notes]
```

**如果没有 research：** 通过对话收集 requirements。提问：`"What are the main things users need to do with [new features]?"` 继续澄清、追问相关能力，并将内容按 category 分组。

通过 AskUserQuestion 为每个 category 设定范围（`multiSelect: true`，`header` 最长 12 个字符）：
- `"[Feature 1]"` — [简短说明]
- `"[Feature 2]"` — [简短说明]
- `"None for this milestone"` — 整个 category 延后

记录：选中项 → 本 milestone；未选中的 table stakes → 未来；未选中的 differentiators → out of scope。

通过 AskUserQuestion **识别缺口**：
- `"No, research covered it"` — 继续
- `"Yes, let me add some"` — 记录补充项

**生成 REQUIREMENTS.md：**
- 按 category 分组的 v1 Requirements（checkboxes、REQ-IDs）
- Future Requirements（延期项）
- Out of Scope（带理由的明确排除项）
- Traceability section（先留空，由 roadmap 填充）

**REQ-ID 格式：** `[CATEGORY]-[NUMBER]`（例如 `AUTH-01`，`NOTIF-02`）。编号从已有内容继续。

**Requirement 质量标准：**

好的 requirements 应该：
- **Specific and testable：** `"User can reset password via email link"`（而不是 `"Handle password reset"`）
- **User-centric：** `"User can X"`（而不是 `"System does Y"`）
- **Atomic：** 每条 requirement 只表达一个能力（而不是 `"User can login and manage profile"`）
- **Independent：** 对其他 requirements 的依赖尽量少

展示**完整的** requirements 列表供确认：

```
## Milestone v[X.Y] Requirements

### [Category 1]
- [ ] **CAT1-01**: User can do X
- [ ] **CAT1-02**: User can do Y

### [Category 2]
- [ ] **CAT2-01**: User can do Z

Does this capture what you're building? (yes / adjust)
```

如果选择 `"adjust"`：返回 scoping。

**Commit requirements：**
```bash
gsd-sdk query commit "docs: define milestone v[X.Y] requirements" .planning/REQUIREMENTS.md
```

## 10. 创建 Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

**起始 phase 编号：**
- 如果启用了 `--reset-phase-numbers`，从 **Phase 1** 开始
- 否则，从上一个 milestone 的最后一个 phase 编号继续（例如 v1.0 结束于 phase 5，则 v1.1 从 phase 6 开始）

```
Task(prompt="
<planning_context>
<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/config.json
- .planning/MILESTONES.md
</files_to_read>

${AGENT_SKILLS_ROADMAPPER}

</planning_context>

<instructions>
Create roadmap for milestone v[X.Y]:
1. Respect the selected numbering mode:
   - `--reset-phase-numbers` → start at Phase 1
   - default behavior → continue from the previous milestone's last phase number
2. Derive phases from THIS MILESTONE's requirements only
3. Map every requirement to exactly one phase
4. Derive 2-5 success criteria per phase (observable user behaviors)
5. Validate 100% coverage
6. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
7. Return ROADMAP CREATED with summary

Write files first, then return.
</instructions>
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**处理返回结果：**

**如果返回 `## ROADMAP BLOCKED`：** 展示 blocker，与用户一起解决，然后重新启动。

**如果返回 `## ROADMAP CREATED`：** 读取 ROADMAP.md，并以内联形式展示：

```
## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| [N] | [Name] | [Goal] | [REQ-IDs] | [count] |

### Phase Details

**Phase [N]: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
```

通过 AskUserQuestion **请求批准**：
- `"Approve"` — Commit 并继续
- `"Adjust phases"` — 告诉我需要修改什么
- `"Review full file"` — 显示原始 ROADMAP.md

**如果选择 `"Adjust"`：** 获取备注，将其作为修订上下文重新启动 roadmapper，循环直到批准。
**如果选择 `"Review"`：** 显示原始 ROADMAP.md，然后再次询问。

**Commit roadmap**（批准后）：
```bash
gsd-sdk query commit "docs: create milestone v[X.Y] roadmap ([N] phases)" .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 10.5. 将 Pending Todos 关联到 Roadmap Phases

roadmap 获批后，对照新批准的 phases 扫描 pending todos。对于范围与某个 phase 匹配的 todo，在其 YAML frontmatter 中添加 `resolves_phase: N`。

**检查是否存在 pending todos：**
```bash
PENDING_TODOS=$(ls .planning/todos/pending/*.md 2>/dev/null | head -50)
```

**如果没有 pending todos：** 静默跳过此步骤。

**如果存在 pending todos：**

读取已批准的 ROADMAP.md，并提取 phase 列表：phase number、phase name、goal、requirement IDs。

对每个 pending todo，比较：
- todo frontmatter 中的 `title` 和 `area` 字段
- todo 正文（`Problem` 和 `Solution` sections）

与每个 phase 的以下内容进行比对：
- Phase goal
- Requirement IDs 及其描述

**匹配标准（尽力而为，不要过度匹配）：** 如果某个 phase 的 goal 或 requirements 直接描述了与该 todo 相同的功能、领域或能力，则认为该 todo 可由该 phase 解决。范围窄、描述具体的 todos 最适合链接。模糊或跨领域的 todos 应保持未关联。

**对每个匹配到的 todo**，在 YAML frontmatter 中添加 `resolves_phase: [N]`（放在已有字段之后）：
```yaml
---
created: [existing]
title: [existing]
area: [existing]
resolves_phase: [N]
files: [existing]
---
```

**只修改那些存在明确且高置信匹配的 todos。** 未匹配的 todos 保持不变。

**如果有任何 todos 被关联：**
```bash
gsd-sdk query commit "docs: tag [count] pending todos with resolves_phase after milestone v[X.Y] roadmap" .planning/todos/pending/*.md
```

打印摘要：
```
◆ Linked [N] pending todos to roadmap phases:
  → [todo title] → Phase [N]: [Phase Name]
  (Leave [M] unmatched todos in pending/)
```

## 11. 完成

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase [N]: [Phase Name]** — [Goal]

`/clear` then:

`/gsd-discuss-phase [N] ${GSD_WS}` — 收集上下文并澄清实现思路

Also: `/gsd-plan-phase [N] ${GSD_WS}` — 跳过讨论，直接规划
```

</process>

<success_criteria>
- [ ] PROJECT.md 已更新 `Current Milestone` section
- [ ] STATE.md 已为新 milestone 重置
- [ ] MILESTONE-CONTEXT.md 已消费并删除（如果存在）
- [ ] 已完成 Research（如果用户选择）— 启动 4 个并行 agents，且具备 milestone 上下文
- [ ] 已按 category 收集并划定 requirements 范围
- [ ] 已创建带有 REQ-IDs 的 REQUIREMENTS.md
- [ ] 已以 phase 编号上下文启动 gsd-roadmapper
- [ ] Roadmap 文件已立即写入（不是 draft）
- [ ] 已纳入用户反馈（如有）
- [ ] 已遵循 phase 编号模式（延续或重置）
- [ ] 已完成所有 commits（如果 planning docs 需要提交）
- [ ] 已扫描 pending todos 与 phase 的匹配；匹配的 todos 已打上 `resolves_phase: N`
- [ ] 用户知道下一步是：`/gsd-discuss-phase [N] ${GSD_WS}`

**Atomic commits：** 每个阶段都会立即提交其产物。
</success_criteria>
</output>
