<purpose>
以 GSD 保证（原子提交、STATE.md 跟踪）执行小型临时任务。Quick 模式会启动 gsd-planner（quick 模式）和 gsd-executor，并在 `.planning/quick/` 中跟踪任务，同时更新 STATE.md 的 “Quick Tasks Completed” 表。

使用 `--full` 标志：启用完整质量流水线——讨论 + 研究 + 计划检查 + 验证。一个标志全部开启。

使用 `--validate` 标志：仅启用计划检查（最多 2 次迭代）和执行后的验证。适合想要质量保证但不需要讨论或研究时使用。

使用 `--discuss` 标志：在规划前加入轻量讨论阶段。用于暴露假设、澄清灰区，并将决策记录到 CONTEXT.md 中，使规划器将其视为已锁定。

使用 `--research` 标志：在规划前启动一个聚焦的研究代理。用于研究实现方案、库选型和潜在陷阱。适合你不确定该如何着手任务时使用。

细粒度标志可组合：`--discuss --research --validate` 与 `--full` 的效果相同。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 中引用的所有文件。
</required_reading>

<available_agent_types>
有效的 GSD 子代理类型（使用精确名称——不要回退到 'general-purpose'）：
- gsd-phase-researcher — 为某个阶段研究技术方案
- gsd-planner — 根据阶段范围创建详细计划
- gsd-plan-checker — 在执行前审查计划质量
- gsd-executor — 执行计划任务、提交并创建 SUMMARY.md
- gsd-verifier — 验证阶段完成情况并检查质量门
- gsd-code-reviewer — 审查源文件中的 bug、安全问题和代码质量
</available_agent_types>

<process>
**Step 1: Parse arguments and get task description**

解析 `$ARGUMENTS`：
- `--full` 标志 → 存储 `$FULL_MODE=true`, `$DISCUSS_MODE=true`, `$RESEARCH_MODE=true`, `$VALIDATE_MODE=true`
- `--validate` 标志 → 存储 `$VALIDATE_MODE=true`
- `--discuss` 标志 → 存储 `$DISCUSS_MODE=true`
- `--research` 标志 → 存储 `$RESEARCH_MODE=true`
- 剩余文本 → 若非空则作为 `$DESCRIPTION`

解析后进行归一化：如果 `$DISCUSS_MODE`、`$RESEARCH_MODE` 和 `$VALIDATE_MODE` 都为 true，则设置 `$FULL_MODE=true`。这样可确保 `--discuss --research --validate` 与 `--full` 被完全等同处理。

如果解析后 `$DESCRIPTION` 为空，则交互式提示用户：

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。当 TEXT_MODE 激活时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入所选编号。对于不支持 `AskUserQuestion` 的非 Claude 运行时（OpenAI Codex、Gemini CLI 等），这是必需的。

```text
AskUserQuestion(
  header: "Quick Task",
  question: "你想做什么？",
  followUp: null
)
```

将响应存为 `$DESCRIPTION`。

如果仍为空，重新提示："请提供任务描述。"

根据激活的标志显示横幅：

如果 `$FULL_MODE`（所有阶段启用——`--full` 或所有细粒度标志）：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (FULL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 已启用讨论 + 研究 + 计划检查 + 验证
```

如果 `$DISCUSS_MODE` 和 `$VALIDATE_MODE`（无 research）：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS + VALIDATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 已启用讨论 + 计划检查 + 验证
```

如果 `$DISCUSS_MODE` 和 `$RESEARCH_MODE`（无 validate）：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS + RESEARCH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 已启用讨论 + 研究
```

如果 `$RESEARCH_MODE` 和 `$VALIDATE_MODE`（无 discuss）：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (RESEARCH + VALIDATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 已启用研究 + 计划检查 + 验证
```

如果仅 `$DISCUSS_MODE`：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (DISCUSS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 已启用讨论阶段——在规划前暴露灰区
```

如果仅 `$RESEARCH_MODE`：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (RESEARCH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 已启用研究阶段——在规划前研究方案
```

如果仅 `$VALIDATE_MODE`：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUICK TASK (VALIDATE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 已启用计划检查 + 验证
```

---

**Step 2: Initialize**

```bash
if ! command -v gsd-sdk &>/dev/null; then
  echo "⚠ PATH 中未找到 gsd-sdk — /gsd-quick 需要它。"
  echo ""
  echo "安装 GSD SDK："
  echo "  npm install -g @gsd-build/sdk"
  echo ""
  echo "或者更新 GSD 以获取最新软件包："
  echo "  /gsd-update"
  exit 1
fi
```

```bash
INIT=$(gsd-sdk query init.quick "$DESCRIPTION")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_PLANNER=$(gsd-sdk query agent-skills gsd-planner 2>/dev/null)
AGENT_SKILLS_EXECUTOR=$(gsd-sdk query agent-skills gsd-executor 2>/dev/null)
AGENT_SKILLS_CHECKER=$(gsd-sdk query agent-skills gsd-checker 2>/dev/null)
AGENT_SKILLS_VERIFIER=$(gsd-sdk query agent-skills gsd-verifier 2>/dev/null)
```

解析 JSON 中的以下字段：`planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `branch_name`, `quick_id`, `slug`, `date`, `timestamp`, `quick_dir`, `task_dir`, `roadmap_exists`, `planning_exists`。

```bash
USE_WORKTREES=$(gsd-sdk query config-get workflow.use_worktrees 2>/dev/null || echo "true")
```

如果项目使用 git submodule，则跳过 worktree 隔离：

```bash
if [ -f .gitmodules ]; then
  echo "[worktree] 检测到子模块项目（存在 .gitmodules）— 回退为串行执行"
  USE_WORKTREES=false
fi
```

**如果 `roadmap_exists` 为 false：** 报错——Quick 模式要求当前项目存在 ROADMAP.md。请先运行 `/gsd-new-project`。

Quick 任务可在 phase 中途运行——验证仅检查 ROADMAP.md 是否存在，不检查 phase 状态。

---

**Step 2.5: Handle quick-task branching**

**如果 `branch_name` 为空/null：** 跳过，继续使用当前分支。

**如果设置了 `branch_name`：** 在任何规划提交之前切换到 quick-task 分支：

```bash
git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"
```

本次运行的所有 quick-task 提交都保留在该分支上。后续 merge/rebase 由用户处理。

---

**Step 3: Create task directory**

```bash
mkdir -p "${task_dir}"
```

---

**Step 4: Create quick task directory**

为此 quick task 创建目录：

```bash
QUICK_DIR=".planning/quick/${quick_id}-${slug}"
mkdir -p "$QUICK_DIR"
```

向用户报告：
```text
正在创建 quick task ${quick_id}: ${DESCRIPTION}
目录：${QUICK_DIR}
```

存储 `$QUICK_DIR` 以供编排使用。

---

**Step 4.5: Discussion phase (only when `$DISCUSS_MODE`)**

如果不是 `$DISCUSS_MODE`，则完全跳过此步骤。

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DISCUSSING QUICK TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在为以下任务暴露灰区：${DESCRIPTION}
```

**4.5a. Identify gray areas**

分析 `$DESCRIPTION`，识别 2-4 个灰区——这些实现决策会改变结果，且需要用户参与判断。

使用领域感知启发式生成特定于该 phase 的灰区（而非泛泛而谈）：
- 用户**看到**的内容 → 布局、密度、交互、状态
- 用户**调用**的内容 → 响应、错误、认证、版本控制
- 用户**运行**的内容 → 输出格式、标志、模式、错误处理
- 用户**阅读**的内容 → 结构、语气、深度、流程
- 被**组织**的内容 → 标准、分组、命名、例外

每个灰区都应是具体决策点，而不是模糊类别。例如：用“加载行为”而不是“UX”。

**4.5b. Present gray areas**

```text
AskUserQuestion(
  header: "Gray Areas",
  question: "在规划前，哪些方面需要澄清？",
  options: [
    { label: "${area_1}", description: "${why_it_matters_1}" },
    { label: "${area_2}", description: "${why_it_matters_2}" },
    { label: "${area_3}", description: "${why_it_matters_3}" },
    { label: "All clear", description: "跳过讨论——我已清楚自己想要什么" }
  ],
  multiSelect: true
)
```

如果用户选择 "All clear" → 跳到 Step 5（不写 CONTEXT.md）。

**4.5c. Discuss selected areas**

对每个已选区域，通过 AskUserQuestion 提出 1-2 个聚焦问题：

```text
AskUserQuestion(
  header: "${area_name}",
  question: "${specific_question_about_this_area}",
  options: [
    { label: "${concrete_choice_1}", description: "${what_this_means}" },
    { label: "${concrete_choice_2}", description: "${what_this_means}" },
    { label: "${concrete_choice_3}", description: "${what_this_means}" },
    { label: "You decide", description: "由 Claude 自行裁量" }
  ],
  multiSelect: false
)
```

规则：
- 选项必须是具体选择，而不是抽象类别
- 如果你有明确建议，应突出推荐选项
- 如果用户选择带自由文本的 "Other"，切换为纯文本跟进（遵循 questioning.md 的自由输入规则）
- 如果用户选择 "You decide"，则在 CONTEXT.md 中记为 Claude's Discretion
- 每个区域最多 2 个问题——这是轻量讨论，不是深度访谈

将所有决策收集到 `$DECISIONS`。

**4.5d. Write CONTEXT.md**

按标准 context 模板结构写入 `${QUICK_DIR}/${quick_id}-CONTEXT.md`：

```markdown
# Quick Task ${quick_id}: ${DESCRIPTION} - Context

**Gathered:** ${date}
**Status:** Ready for planning

<domain>
## Task Boundary

${DESCRIPTION}

</domain>

<decisions>
## Implementation Decisions

### ${area_1_name}
- ${decision_from_discussion}

### ${area_2_name}
- ${decision_from_discussion}

### Claude's Discretion
${areas_where_user_said_you_decide_or_areas_not_discussed}

</decisions>

<specifics>
## Specific Ideas

${any_specific_references_or_examples_from_discussion}

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<canonical_refs>
## Canonical References

${any_specs_adrs_or_docs_referenced_during_discussion}

[If none: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>
```

注意：Quick task 的 CONTEXT.md 省略 `<code_context>` 和 `<deferred>` 部分（不做代码库侦察，也没有 phase 范围可延后）。保持精简。若引用了外部文档，则包含 `<canonical_refs>`；仅当没有适用外部文档时才省略。

报告：`Context captured: ${QUICK_DIR}/${quick_id}-CONTEXT.md`

---

**Step 4.75: Research phase (only when `$RESEARCH_MODE`)**

如果不是 `$RESEARCH_MODE`，则完全跳过此步骤。

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING QUICK TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在为以下任务研究方案：${DESCRIPTION}
```

启动一个聚焦的 researcher（不像完整 phase 那样并行启动 4 个 researcher——quick task 需要有针对性的研究，而不是宽泛的领域调研）：

```text
Task(
  prompt="
<research_context>

**Mode:** quick-task
**Task:** ${DESCRIPTION}
**Output:** ${QUICK_DIR}/${quick_id}-RESEARCH.md

<files_to_read>
- .planning/STATE.md (项目状态——已构建内容)
- .planning/PROJECT.md (项目上下文)
- ./CLAUDE.md (若存在——项目特定指南)
${DISCUSS_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-CONTEXT.md (用户决策——研究应与之保持一致)' : ''}
</files_to_read>

${AGENT_SKILLS_PLANNER}

</research_context>

<focus>
这是一个 quick task，不是完整 phase。研究应简洁且聚焦：
1. 适用于该特定任务的最佳库/模式
2. 常见陷阱及规避方式
3. 与现有代码库的集成点
4. 在规划前值得了解的约束或坑点

不要产出完整的领域调研。目标是 1-2 页可执行结论。
</focus>

<output>
将研究写入：${QUICK_DIR}/${quick_id}-RESEARCH.md
使用标准 research 格式，但保持精简——跳过不适用的部分。
返回：## RESEARCH COMPLETE with file path
</output>
",
  subagent_type="gsd-phase-researcher",
  model="{planner_model}",
  description="Research: ${DESCRIPTION}"
)
```

researcher 返回后：
1. 验证 `${QUICK_DIR}/${quick_id}-RESEARCH.md` 是否存在
2. 报告："Research complete: ${QUICK_DIR}/${quick_id}-RESEARCH.md"

如果未找到 research 文件，警告但继续："Research agent did not produce output — proceeding to planning without research."

---

**Step 5: Spawn planner (quick mode)**

**如果 `$VALIDATE_MODE`：** 使用 `quick-full` 模式并施加更严格约束。

**如果不是 `$VALIDATE_MODE`：** 使用标准 `quick` 模式。

```text
Task(
  prompt="
<planning_context>

**Mode:** ${VALIDATE_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<files_to_read>
- .planning/STATE.md (Project State)
- ./CLAUDE.md (if exists — follow project-specific guidelines)
${DISCUSS_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-CONTEXT.md (用户决策——已锁定，不要重新讨论)' : ''}
${RESEARCH_MODE ? '- ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md (研究结论——用于指导实现选择)' : ''}
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Project skills:** 检查 .claude/skills/ 或 .agents/skills/ 目录（若任一存在）——读取 SKILL.md 文件，计划需考虑项目技能规则

</planning_context>

<constraints>
- 创建一个 SINGLE plan，包含 1-3 个聚焦任务
- Quick task 应保持原子性和自包含
${RESEARCH_MODE ? '- 已有研究结论——用其指导库/模式选择' : '- 无研究阶段'}
${VALIDATE_MODE ? '- 目标约 ~40% 上下文使用率（为验证而结构化）' : '- 目标约 ~30% 上下文使用率（简单、聚焦）'}
${VALIDATE_MODE ? '- MUST 在 plan frontmatter 中生成 `must_haves`（truths、artifacts、key_links）' : ''}
${VALIDATE_MODE ? '- 每个 task MUST 具有 `files`, `action`, `verify`, `done` 字段' : ''}
</constraints>

<output>
将计划写入：${QUICK_DIR}/${quick_id}-PLAN.md
返回：## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Quick plan: ${DESCRIPTION}"
)
```

planner 返回后：
1. 验证 `${QUICK_DIR}/${quick_id}-PLAN.md` 是否存在
2. 提取计划数量（quick task 通常为 1）
3. 报告："Plan created: ${QUICK_DIR}/${quick_id}-PLAN.md"

如果未找到计划，报错："Planner failed to create ${quick_id}-PLAN.md"

---

**Step 5.5: Plan-checker loop (only when `$VALIDATE_MODE`)**

如果不是 `$VALIDATE_MODE`，则完全跳过此步骤。

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CHECKING PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在启动计划检查器...
```

Checker prompt：

```markdown
<verification_context>
**Mode:** quick-full
**Task Description:** ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (待验证的计划)
</files_to_read>

${AGENT_SKILLS_CHECKER}

**Scope:** 这是一个 quick task，不是完整 phase。跳过依赖 ROADMAP phase goal 的检查。
</verification_context>

<check_dimensions>
- Requirement coverage: 计划是否覆盖任务描述？
- Task completeness: 任务是否具有 files、action、verify、done 字段？
- Key links: 引用的文件是否真实存在？
- Scope sanity: 对 quick task 来说，范围大小是否合适（1-3 个任务）？
- must_haves derivation: must_haves 是否可追溯到任务描述？

跳过：cross-plan deps（单计划）、ROADMAP alignment
${DISCUSS_MODE ? '- Context compliance: 计划是否遵守 CONTEXT.md 中已锁定的决策？' : '- Skip: context compliance (无 CONTEXT.md)'}
</check_dimensions>

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
  description="Check quick plan: ${DESCRIPTION}"
)
```

**处理 checker 返回：**

- **`## VERIFICATION PASSED`：** 显示确认信息，进入 step 6。
- **`## ISSUES FOUND`：** 显示问题，检查迭代次数，进入修订循环。

**修订循环（最多 2 次迭代）：**

跟踪 `iteration_count`（初始 plan + check 后从 1 开始）。

**如果 iteration_count < 2：**

显示：`Sending back to planner for revision... (iteration ${N}/2)`

Revision prompt：

```markdown
<revision_context>
**Mode:** quick-full (revision)

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (现有计划)
</files_to_read>

${AGENT_SKILLS_PLANNER}

**Checker issues:** ${structured_issues_from_checker}

</revision_context>

<instructions>
进行有针对性的更新以修复 checker 提出的问题。
除非问题属于根本性问题，否则不要从头重新规划。
返回修改内容。
</instructions>
```

```text
Task(
  prompt=revision_prompt,
  subagent_type="gsd-planner",
  model="{planner_model}",
  description="Revise quick plan: ${DESCRIPTION}"
)
```

planner 返回后 → 再次启动 checker，并递增 iteration_count。

**如果 iteration_count >= 2：**

显示：`Max iterations reached. ${N} issues remain:` + 问题列表

提供：1) Force proceed, 2) Abort

---

**Step 5.6: Pre-dispatch plan commit (worktree mode only)**

当 `USE_WORKTREES !== "false"` 时，在启动 executor **之前** 将 PLAN.md 提交到当前分支。这样 worktree 会在其 branch HEAD 上继承 PLAN.md，executor 就能通过 worktree-rooted 路径读取它，从而避免主仓库路径预热引发的 CC #36182 路径解析漂移。

如果 `USE_WORKTREES === "false"`，则完全跳过此步骤（非 worktree 模式：PLAN.md 按常规在 Step 8 提交）。

```bash
if [ "${USE_WORKTREES}" != "false" ]; then
  COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
  if [ "$COMMIT_DOCS" != "false" ]; then
    git add "${QUICK_DIR}/${quick_id}-PLAN.md"
    git commit --no-verify -m "docs(${quick_id}): pre-dispatch plan for ${DESCRIPTION}" -- "${QUICK_DIR}/${quick_id}-PLAN.md" || true
  fi
fi
```

---

**Step 6: Spawn executor**

启动前捕获当前 HEAD（用于 worktree 分支检查）：
```bash
EXPECTED_BASE=$(git rev-parse HEAD)
```

使用 plan 引用启动 gsd-executor：

```text
Task(
  prompt="
Execute quick task ${quick_id}.

${USE_WORKTREES !== "false" ? `
<worktree_branch_check>
在进行任何其他工作前的 FIRST ACTION：验证此 worktree 分支是否基于正确的提交。
运行：git merge-base HEAD ${EXPECTED_BASE}
如果结果与 ${EXPECTED_BASE} 不同，则 hard-reset 到正确的 base（安全——在代理开始工作前执行）：
  git reset --hard ${EXPECTED_BASE}
然后验证：if [ "$(git rev-parse HEAD)" != "${EXPECTED_BASE}" ]; then echo "ERROR: Could not correct worktree base"; exit 1; fi
这用于修复一个已知问题：EnterWorktree 有时会从 main 而不是 feature branch HEAD 创建分支（影响所有平台）。
</worktree_branch_check>
` : ''}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (计划)
- .planning/STATE.md (项目状态)
- ./CLAUDE.md (项目说明，如存在)
- .claude/skills/ 或 .agents/skills/（若任一存在——列出技能，读取每个 SKILL.md，并在实现期间遵循相关规则）
</files_to_read>

${AGENT_SKILLS_EXECUTOR}

<constraints>
- 执行计划中的所有任务
- 以原子方式提交每个任务（仅代码变更）
- 在 ${QUICK_DIR}/${quick_id}-SUMMARY.md 创建 summary
- 不要提交文档产物（SUMMARY.md、STATE.md、PLAN.md）——这些文档提交由 orchestrator 在 Step 8 处理
- 不要更新 ROADMAP.md（quick task 独立于已规划的 phases）
</constraints>
",
  subagent_type="gsd-executor",
  model="{executor_model}",
  ${USE_WORKTREES !== "false" ? 'isolation="worktree",' : ''}
  description="Execute: ${DESCRIPTION}"
)
```

executor 返回后：
1. **Worktree cleanup：** 如果 executor 使用 `isolation="worktree"` 运行，则将 worktree 分支合并回主分支并清理：
   ```bash
   # 查找 executor 创建的 worktree
   WORKTREES=$(git worktree list --porcelain | grep "^worktree " | grep -v "$(pwd)$" | sed 's/^worktree //')
   for WT in $WORKTREES; do
     WT_BRANCH=$(git -C "$WT" rev-parse --abbrev-ref HEAD 2>/dev/null)
     if [ -n "$WT_BRANCH" ] && [ "$WT_BRANCH" != "HEAD" ]; then
       # --- Orchestrator file protection (#1756) ---
       # 合并前备份 STATE.md 和 ROADMAP.md（main 始终优先）
       STATE_BACKUP=$(mktemp)
       ROADMAP_BACKUP=$(mktemp)
       [ -f .planning/STATE.md ] && cp .planning/STATE.md "$STATE_BACKUP" || true
       [ -f .planning/ROADMAP.md ] && cp .planning/ROADMAP.md "$ROADMAP_BACKUP" || true

       # 快照 main 上的文件，用于检测“复活”的文件
       PRE_MERGE_FILES=$(git ls-files .planning/)

       # 合并前删除保护：阻止删除已跟踪 .planning/ 文件的合并
       DELETIONS=$(git diff --diff-filter=D --name-only HEAD..."$WT_BRANCH" 2>/dev/null || true)
       if [ -n "$DELETIONS" ]; then
         echo "BLOCKED: Worktree branch $WT_BRANCH contains file deletions: $DELETIONS"
         echo "请先审查这些删除。如果这是有意为之，请移除此保护并重新运行。"
         rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"
         continue
       fi

       git merge "$WT_BRANCH" --no-ff --no-edit -m "chore: merge quick task worktree ($WT_BRANCH)" 2>&1 || {
         echo "⚠ Worktree $WT_BRANCH 的合并发生冲突——请手动解决"
         echo "  STATE.md 备份：   $STATE_BACKUP"
         echo "  ROADMAP.md 备份： $ROADMAP_BACKUP"
         echo "  恢复命令：cp \$STATE_BACKUP .planning/STATE.md && cp \$ROADMAP_BACKUP .planning/ROADMAP.md"
         break
       }

       # 恢复由 orchestrator 管理的文件
       if [ -s "$STATE_BACKUP" ]; then cp "$STATE_BACKUP" .planning/STATE.md; fi
       if [ -s "$ROADMAP_BACKUP" ]; then cp "$ROADMAP_BACKUP" .planning/ROADMAP.md; fi
       rm -f "$STATE_BACKUP" "$ROADMAP_BACKUP"

       # 删除 main 上已删除但被 worktree 重新添加的文件（--no-ff 保证有 merge commit，因此 HEAD~1 可靠）
       DELETED_FILES=$(git diff --diff-filter=A --name-only HEAD~1 -- .planning/ 2>/dev/null || true)
       for RESURRECTED in $DELETED_FILES; do
         if ! echo "$PRE_MERGE_FILES" | grep -qxF "$RESURRECTED"; then
           git rm -f "$RESURRECTED" 2>/dev/null || true
         fi
       done

       if ! git diff --quiet .planning/STATE.md .planning/ROADMAP.md 2>/dev/null || \
          [ -n "$DELETED_FILES" ]; then
         COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
         if [ "$COMMIT_DOCS" != "false" ]; then
           git add .planning/STATE.md .planning/ROADMAP.md 2>/dev/null || true
           git commit --amend --no-edit 2>/dev/null || true
         fi
       fi

       # 安全网：在移除 worktree 前抢救未提交的 SUMMARY.md（#2296，镜像 #2070）
       UNCOMMITTED_SUMMARY=$(git -C "$WT" ls-files --modified --others --exclude-standard -- "*SUMMARY.md" 2>/dev/null || true)
       if [ -n "$UNCOMMITTED_SUMMARY" ]; then
         echo "⚠ executor 未提交 SUMMARY.md —— 现在提交以防止数据丢失"
         git -C "$WT" add -- "*SUMMARY.md" 2>/dev/null || true
         git -C "$WT" commit --no-verify -m "docs(recovery): rescue uncommitted SUMMARY.md before worktree removal (#2070)" 2>/dev/null || true
         git merge "$WT_BRANCH" --no-edit -m "chore: merge rescued SUMMARY.md from executor worktree ($WT_BRANCH)" 2>/dev/null || true
       fi

       if ! git worktree remove "$WT" --force; then
         WT_NAME=$(basename "$WT")
         if [ -f ".git/worktrees/${WT_NAME}/locked" ]; then
           echo "⚠ Worktree $WT 已锁定——尝试解锁后重试"
           git worktree unlock "$WT" 2>/dev/null || true
           if ! git worktree remove "$WT" --force; then
             echo "⚠ 残留 worktree 位于 $WT —— 会话结束后需手动清理："
             echo "    git worktree unlock \"$WT\" && git worktree remove \"$WT\" --force && git branch -D \"$WT_BRANCH\""
           fi
         else
           echo "⚠ 残留 worktree 位于 $WT（移除失败）——请手动排查"
         fi
       fi
       git branch -D "$WT_BRANCH" 2>/dev/null || true
     fi
   done
   ```
   如果 `workflow.use_worktrees` 为 `false`，则跳过此步骤。
2. 验证 `${QUICK_DIR}/${quick_id}-SUMMARY.md` 是否存在
3. 从 executor 输出中提取 commit hash
4. 报告完成状态

**已知 Claude Code bug (`classifyHandoffIfNeeded`)：** 如果 executor 报告 "failed"，并带有错误 `classifyHandoffIfNeeded is not defined`，这是 Claude Code 运行时 bug，不是真正失败。检查 summary 文件是否存在，以及 git log 中是否有提交。若存在，则视为成功。

如果未找到 summary，报错："Executor failed to create ${quick_id}-SUMMARY.md"

注意：对于会生成多个计划的 quick task（罕见情况），按 execute-phase 模式分波并行启动 executors。

---

**Step 6.25: Code review (auto)**

如果 `$FULL_MODE` 为 false，则完全跳过此步骤。

**Config gate:**
```bash
CODE_REVIEW_ENABLED=$(gsd-sdk query config-get workflow.code_review 2>/dev/null || echo "true")
```
如果为 `"false"`，则跳过并提示 "Code review skipped (workflow.code_review=false)"。

**从 executor 的提交中限定文件范围：**
```bash
# 找到 diff base：quick task 开始前的最后一个提交
# 用 git log 找到引用 quick task id 的提交，然后取最旧提交的父提交
QUICK_COMMITS=$(git log --oneline --format="%H" --grep="${quick_id}" 2>/dev/null)
if [ -n "$QUICK_COMMITS" ]; then
  DIFF_BASE=$(echo "$QUICK_COMMITS" | tail -1)^
  # 验证父提交存在（防止这是仓库中的第一个提交）
  git rev-parse "${DIFF_BASE}" >/dev/null 2>&1 || DIFF_BASE=$(echo "$QUICK_COMMITS" | tail -1)
else
  # 未找到此 quick task 的提交——跳过审查
  DIFF_BASE=""
fi

if [ -n "$DIFF_BASE" ]; then
  CHANGED_FILES=$(git diff --name-only "${DIFF_BASE}..HEAD" -- . ':!.planning' 2>/dev/null | tr '\n' ' ')
else
  CHANGED_FILES=""
fi
```

如果 `CHANGED_FILES` 为空，则跳过并提示 "No source files changed — skipping code review."

**调用 review：**
```text
Task(
  prompt="审查这些文件中的 bug、安全问题和代码质量。
  Files: ${CHANGED_FILES}
  Output: ${QUICK_DIR}/${quick_id}-REVIEW.md
  Depth: quick",
  subagent_type="gsd-code-reviewer",
  model="{executor_model}"
)
```

如果 review 产生发现，则显示建议信息。**错误处理：** 失败不阻塞流程——捕获后继续。

---

**Step 6.5: Verification (only when `$VALIDATE_MODE`)**

如果不是 `$VALIDATE_MODE`，则完全跳过此步骤。

显示横幅：
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► VERIFYING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ 正在启动 verifier...
```

```text
Task(
  prompt="验证 quick task 目标是否达成。
Task directory: ${QUICK_DIR}
Task goal: ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${quick_id}-PLAN.md (计划)
</files_to_read>

${AGENT_SKILLS_VERIFIER}

根据实际代码库检查 must_haves。在 ${QUICK_DIR}/${quick_id}-VERIFICATION.md 创建 VERIFICATION.md。",
  subagent_type="gsd-verifier",
  model="{verifier_model}",
  description="Verify: ${DESCRIPTION}"
)
```

读取 verification 状态：
```bash
grep "^status:" "${QUICK_DIR}/${quick_id}-VERIFICATION.md" | cut -d: -f2 | tr -d ' '
```

将其存为 `$VERIFICATION_STATUS`。

| Status | Action |
|--------|--------|
| `passed` | 存储 `$VERIFICATION_STATUS = "Verified"`，继续 step 7 |
| `human_needed` | 显示需要人工检查的项，存储 `$VERIFICATION_STATUS = "Needs Review"`，继续 |
| `gaps_found` | 显示缺口摘要，并提供：1) 重新运行 executor 以修复缺口，2) 按当前结果接受。存储 `$VERIFICATION_STATUS = "Gaps"` |

---

**Step 7: Update STATE.md**

在 STATE.md 中记录 quick task 完成情况。

**7a. Check if "Quick Tasks Completed" section exists:**

读取 STATE.md，检查是否存在 `### Quick Tasks Completed` 部分。

**7b. If section doesn't exist, create it:**

插入到 `### Blockers/Concerns` 部分之后：

**如果 `$VALIDATE_MODE`：**
```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
```

**如果不是 `$VALIDATE_MODE`：**
```markdown
### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
```

**注意：** 如果表已存在，则匹配其现有列格式。如果为已有 quick task 但无 Status 列的项目新增 `--validate`（或 `--full`），则为表头和分隔行添加 Status 列，并为旧行保留空的 Status 值。

**7c. Append new row to table:**

使用 init 中的 `date`：

**如果 `$VALIDATE_MODE`（或表中有 Status 列）：**
```markdown
| ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | ${VERIFICATION_STATUS} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
```

**如果不是 `$VALIDATE_MODE`（且表中无 Status 列）：**
```markdown
| ${quick_id} | ${DESCRIPTION} | ${date} | ${commit_hash} | [${quick_id}-${slug}](./quick/${quick_id}-${slug}/) |
```

**7d. Update "Last activity" line:**

使用 init 中的 `date`：
```text
Last activity: ${date} - Completed quick task ${quick_id}: ${DESCRIPTION}
```

使用 Edit tool 原子性地完成这些修改

---

**Step 8: Final commit and completion**

暂存并提交 quick task 产物。此步骤**必须始终执行**——即使 executor 已提交过部分文件（例如未使用 worktree 隔离时）。`gsd-sdk query commit` 命令（或旧版 `gsd-tools.cjs` commit）会妥善处理已提交文件。

构建文件列表：
- `${QUICK_DIR}/${quick_id}-PLAN.md`
- `${QUICK_DIR}/${quick_id}-SUMMARY.md`
- `.planning/STATE.md`
- 如果 `$DISCUSS_MODE` 且 context 文件存在：`${QUICK_DIR}/${quick_id}-CONTEXT.md`
- 如果 `$RESEARCH_MODE` 且 research 文件存在：`${QUICK_DIR}/${quick_id}-RESEARCH.md`
- 如果 `$VALIDATE_MODE` 且 verification 文件存在：`${QUICK_DIR}/${quick_id}-VERIFICATION.md`
- 如果存在 `${QUICK_DIR}/${quick_id}-deferred-items.md`：`${QUICK_DIR}/${quick_id}-deferred-items.md`

```bash
# 提交前显式暂存所有产物——如果 executor 未使用 worktree 隔离并提前提交了文档，
# PLAN.md 可能仍是未跟踪文件
# 若 commit_docs 被禁用，则从暂存中筛掉 .planning/ 文件 (#1783)
COMMIT_DOCS=$(gsd-sdk query config-get commit_docs 2>/dev/null || echo "true")
if [ "$COMMIT_DOCS" = "false" ]; then
  file_list_filtered=$(echo "${file_list}" | tr ' ' '\n' | grep -v '^\.planning/' | tr '\n' ' ')
  git add ${file_list_filtered} 2>/dev/null
else
  git add ${file_list} 2>/dev/null
fi
gsd-sdk query commit "docs(quick-${quick_id}): ${DESCRIPTION}" ${file_list}
```

获取最终 commit hash：
```bash
commit_hash=$(git rev-parse --short HEAD)
```

显示完成输出：

**如果 `$VALIDATE_MODE`：**
```text
---

GSD > QUICK TASK COMPLETE (VALIDATED)

Quick Task ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Research: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Summary: ${QUICK_DIR}/${quick_id}-SUMMARY.md
Verification: ${QUICK_DIR}/${quick_id}-VERIFICATION.md (${VERIFICATION_STATUS})
Commit: ${commit_hash}

---

Ready for next task: /gsd-quick ${GSD_WS}
```

**如果不是 `$VALIDATE_MODE`：**
```text
---

GSD > QUICK TASK COMPLETE

Quick Task ${quick_id}: ${DESCRIPTION}

${RESEARCH_MODE ? 'Research: ' + QUICK_DIR + '/' + quick_id + '-RESEARCH.md' : ''}
Summary: ${QUICK_DIR}/${quick_id}-SUMMARY.md
Commit: ${commit_hash}

---

Ready for next task: /gsd-quick ${GSD_WS}
```

</process>

<success_criteria>
- [ ] ROADMAP.md 验证通过
- [ ] 用户提供了任务描述
- [ ] 存在时，已从参数解析 `--full`、`--validate`、`--discuss` 和 `--research` 标志
- [ ] `--full` 会设置所有布尔值（`$FULL_MODE`, `$DISCUSS_MODE`, `$RESEARCH_MODE`, `$VALIDATE_MODE`）
- [ ] 已生成 slug（小写、连字符、最长 40 字符）
- [ ] 已生成 Quick ID（YYMMDD-xxx 格式，2s Base36 精度）
- [ ] 已在 `.planning/quick/YYMMDD-xxx-slug/` 创建目录
- [ ] (--discuss) 已识别并展示灰区，决策已记录到 `${quick_id}-CONTEXT.md`
- [ ] (--research) 已启动研究代理，并创建 `${quick_id}-RESEARCH.md`
- [ ] planner 已创建 `${quick_id}-PLAN.md`（在 --discuss 时遵守 CONTEXT.md 决策，在 --research 时使用 RESEARCH.md 结论）
- [ ] (--validate) 计划已通过 checker 验证，修订循环上限为 2 次
- [ ] executor 已创建 `${quick_id}-SUMMARY.md`
- [ ] (--validate) verifier 已创建 `${quick_id}-VERIFICATION.md`
- [ ] 已在 STATE.md 中添加 quick task 行（--validate 时包含 Status 列）
- [ ] 产物已提交
</success_criteria>
