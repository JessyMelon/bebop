<purpose>

将一个已发布版本（`v1.0`、`v1.1`、`v2.0`）标记为完成。在 `MILESTONES.md` 中创建历史记录，执行完整的 `PROJECT.md` 演进审查，按 milestone 分组重组 `ROADMAP.md`，并在 git 中打 release tag。

</purpose>

<required_reading>

1. templates/milestone.md
2. templates/milestone-archive.md
3. `.planning/ROADMAP.md`
4. `.planning/REQUIREMENTS.md`
5. `.planning/PROJECT.md`

</required_reading>

<archival_behavior>

当一个 milestone 完成时：

1. 将完整的 milestone 详情提取到 `.planning/milestones/v[X.Y]-ROADMAP.md`
2. 将 requirements 归档到 `.planning/milestones/v[X.Y]-REQUIREMENTS.md`
3. 更新 `ROADMAP.md`，就地覆盖为 milestone 分组结构（保留 Backlog section）
4. 对归档文件和更新后的 `ROADMAP.md` 做 safety commit，然后执行 `git rm REQUIREMENTS.md`（为下一个 milestone 留出全新文件）
5. 执行完整的 `PROJECT.md` 演进审查
6. 提供内联创建下一个 milestone 的选项
7. 将 UI 产物（`*-UI-SPEC.md`、`*-UI-REVIEW.md`）与其他 phase 文档一同归档
8. 清理 `.planning/ui-reviews/` 中的截图文件（二进制资产，永不归档）

**Context Efficiency:** 归档能让 `ROADMAP.md` 保持恒定大小，并让 `REQUIREMENTS.md` 只聚焦当前 milestone。

**ROADMAP archive** 使用 `templates/milestone-archive.md`，包含 milestone header（状态、phases、日期）、完整 phase 详情，以及 milestone 摘要（决策、问题、技术债）。

**REQUIREMENTS archive** 包含所有已标记完成的 requirements 及其结果、带最终状态的 traceability table，以及对已变更 requirements 的说明。

</archival_behavior>

<process>

<step name="pre_close_artifact_audit">
在继续关闭 milestone 之前，先运行全面的 open artifact 审计。

```bash
gsd-sdk query audit-open 2>/dev/null
```

如果输出中存在 open item（任一 section 的 count > 0）：

向用户展示完整的审计报告。

然后询问：
```
These items are open. Choose an action:
[R] Resolve — stop and fix items, then re-run /gsd-complete-milestone
[A] Acknowledge all — document as deferred and proceed with close
[C] Cancel — exit without closing
```

如果用户选择 `[A]`（Acknowledge）：
1. 重新运行 `gsd-sdk query audit-open --json` 以获取结构化数据
2. 将 acknowledged item 写入 `STATE.md` 的 `## Deferred Items` section：
   ```markdown
   ## Deferred Items

   Items acknowledged and deferred at milestone close on {date}:

   | Category | Item | Status |
   |----------|------|--------|
   | debug | {slug} | {status} |
   | quick_task | {slug} | {status} |
   ...
   ```
   写入前，始终通过 `sanitizeForDisplay()` 清洗所有 slug 和 status 值。绝不要将原始文件内容直接注入 `STATE.md`。
3. 在 `MILESTONES.md` 条目中记录：`Known deferred items at close: {count} (see STATE.md Deferred Items)`
4. 继续关闭 milestone。

如果输出显示全部清空（无 open item）：打印 `All artifact types clear.` 并继续。

SECURITY: 审计 JSON 输出是来自 `audit-open` query handler 的结构化数据（与旧版 `gsd-tools.cjs audit-open` 使用同一 JSON contract），在源头已完成校验和清洗。写入 `STATE.md` 时，item 的 slug 和 description 在包含前都会通过 `sanitizeForDisplay()` 清洗。绝不要在未清洗的情况下将原始用户输入内容注入 `STATE.md`。
</step>

<step name="verify_readiness">

**使用 `roadmap analyze` 做全面的 readiness 检查：**

```bash
ROADMAP=$(gsd-sdk query roadmap.analyze)
```

它会返回所有 phase 及其 plan/summary 计数和磁盘状态。用它来验证：
- 哪些 phase 属于这个 milestone？
- 所有 phase 是否都已完成（所有 plan 都有 summary）？检查每个 phase 的 `disk_status === 'complete'`。
- `progress_percent` 应该为 `100%`。

**Requirements completion check（展示前必须执行）：**

解析 `REQUIREMENTS.md` traceability table：
- 统计 v1 requirements 总数，以及已勾选（`[x]`）的 requirements 数量
- 找出 traceability table 中所有非 `Complete` 的行

展示：

```
Milestone: [Name, e.g., "v1.0 MVP"]

Includes:
- Phase 1: Foundation (2/2 plans complete)
- Phase 2: Authentication (2/2 plans complete)
- Phase 3: Core Features (3/3 plans complete)
- Phase 4: Polish (1/1 plan complete)

Total: {phase_count} phases, {total_plans} plans, all complete
Requirements: {N}/{M} v1 requirements checked off
```

**如果 requirements 未完成**（`N < M`）：

```
⚠ Unchecked Requirements:

- [ ] {REQ-ID}: {description} (Phase {X})
- [ ] {REQ-ID}: {description} (Phase {Y})
```

必须给出 3 个选项：
1. **Proceed anyway**，即使有已知缺口也继续将 milestone 标记为完成
2. **Run audit first**，运行 `/gsd-audit-milestone` 评估缺口严重性
3. **Abort**，返回开发流程

如果用户选择 `"Proceed anyway"`：在 `MILESTONES.md` 的 `### Known Gaps` 下记录未完成 requirements 的 `REQ-ID` 和描述。

<config-check>

```bash
cat .planning/config.json 2>/dev/null || true
```

</config-check>

<if mode="yolo">

```
⚡ Auto-approved: Milestone scope verification
[Show breakdown summary without prompting]
Proceeding to stats gathering...
```

继续到 `gather_stats`。

</if>

<if mode="interactive" OR="custom with gates.confirm_milestone_scope true">

```
Ready to mark this milestone as shipped?
(yes / wait / adjust scope)
```

等待确认。
- `"adjust scope"`：询问要包含哪些 phase。
- `"wait"`：停止，等用户准备好再继续。

</if>

</step>

<step name="gather_stats">

计算 milestone 统计信息：

```bash
git log --oneline --grep="feat(" | head -20
git diff --stat FIRST_COMMIT..LAST_COMMIT | tail -1
find . -name "*.swift" -o -name "*.ts" -o -name "*.py" | xargs wc -l 2>/dev/null || true
git log --format="%ai" FIRST_COMMIT | tail -1
git log --format="%ai" LAST_COMMIT | head -1
```

展示：

```
Milestone Stats:
- Phases: [X-Y]
- Plans: [Z] total
- Tasks: [N] total (from phase summaries)
- Files modified: [M]
- Lines of code: [LOC] [language]
- Timeline: [Days] days ([Start] → [End])
- Git range: feat(XX-XX) → feat(YY-YY)
```

</step>

<step name="extract_accomplishments">

使用 `summary-extract` 从 `SUMMARY.md` 文件中提取一句话总结：

```bash
# For each phase in milestone, extract one-liner
for summary in .planning/phases/*-*/*-SUMMARY.md; do
  [ -e "$summary" ] || continue
  gsd-sdk query summary-extract "$summary" --fields one_liner --pick one_liner
done
```

提取 4-6 条关键成果。展示：

```
Key accomplishments for this milestone:
1. [Achievement from phase 1]
2. [Achievement from phase 2]
3. [Achievement from phase 3]
4. [Achievement from phase 4]
5. [Achievement from phase 5]
```

</step>

<step name="create_milestone_entry">

**Note:** `MILESTONES.md` 条目现在会在 `archive_milestone` 步骤中由 `gsd-sdk query milestone.complete` 自动创建。该条目包含版本、日期、phase/plan/task 计数，以及从 `SUMMARY.md` 文件提取的 accomplishments。

如果还需要附加细节（例如用户提供的 `Delivered` 摘要、git range、LOC 统计），可在 CLI 创建基础条目后手动补充。

</step>

<step name="evolve_project_full_review">

在 milestone 完成时，对 `PROJECT.md` 做完整的演进审查。

读取所有 phase summary：

```bash
cat .planning/phases/*-*/*-SUMMARY.md
```

**完整审查清单：**

1. **`"What This Is"` 准确性：**
   - 将当前描述与实际构建结果对比
   - 如果产品含义已明显变化，则更新

2. **Core Value 检查：**
   - 它仍然是正确的优先级吗？发布后是否暴露出不同的核心价值？
   - 如果那个唯一最重要的点已经变化，则更新

3. **Requirements 审计：**

   **Validated section：**
   - 本 milestone 已交付的所有 Active requirements → 移到 `Validated`
   - 格式：`- ✓ [Requirement] — v[X.Y]`

   **Active section：**
   - 移除已移到 `Validated` 的 requirement
   - 为下一个 milestone 添加新 requirement
   - 保留尚未处理的 requirement

   **Out of Scope 审计：**
   - 检查每一项，原先的理由是否仍然成立？
   - 移除无关项
   - 添加在本 milestone 中被判定无效的 requirement

4. **Context 更新：**
   - 当前代码库状态（LOC、tech stack）
   - 用户反馈主题（如果有）
   - 已知问题或技术债

5. **Key Decisions 审计：**
   - 从 milestone 各 phase 的 summary 中提取所有决策
   - 将它们连同结果添加到 Key Decisions 表中
   - 标记为 `✓ Good`、`⚠️ Revisit` 或 `— Pending`

6. **Constraints 检查：**
   - 开发过程中是否有任何 constraint 发生变化？若有则更新

直接就地更新 `PROJECT.md`。并更新 `Last updated` 页脚：

```markdown
---
*Last updated: [date] after v[X.Y] milestone*
```

**完整演进示例（v1.0 → v1.1 准备）：**

Before:

```markdown
## What This Is

A real-time collaborative whiteboard for remote teams.

## Core Value

Real-time sync that feels instant.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Canvas drawing tools
- [ ] Real-time sync < 500ms
- [ ] User authentication
- [ ] Export to PNG

### Out of Scope

- Mobile app — web-first approach
- Video chat — use external tools
```

After v1.0:

```markdown
## What This Is

A real-time collaborative whiteboard for remote teams with instant sync and drawing tools.

## Core Value

Real-time sync that feels instant.

## Requirements

### Validated

- ✓ Canvas drawing tools — v1.0
- ✓ Real-time sync < 500ms — v1.0 (achieved 200ms avg)
- ✓ User authentication — v1.0

### Active

- [ ] Export to PNG
- [ ] Undo/redo history
- [ ] Shape tools (rectangles, circles)

### Out of Scope

- Mobile app — web-first approach, PWA works well
- Video chat — use external tools
- Offline mode — real-time is core value

## Context

Shipped v1.0 with 2,400 LOC TypeScript.
Tech stack: Next.js, Supabase, Canvas API.
Initial user testing showed demand for shape tools.
```

**在以下条件满足时，此步骤完成：**

- [ ] 已审查 `"What This Is"`，并在需要时更新
- [ ] 已确认 Core Value 仍然正确
- [ ] 已将所有已交付 requirement 移到 `Validated`
- [ ] 已为下一个 milestone 向 `Active` 添加新 requirement
- [ ] 已审计 `Out of Scope` 的理由
- [ ] 已用当前状态更新 `Context`
- [ ] 已将本 milestone 的所有决策加入 `Key Decisions`
- [ ] `Last updated` 页脚已反映 milestone 完成

</step>

<step name="reorganize_roadmap">

更新 `.planning/ROADMAP.md`，按已完成 milestone 对 phase 分组：

```markdown
# Roadmap: [Project Name]

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped YYYY-MM-DD)
- 🚧 **v1.1 Security** — Phases 5-6 (in progress)
- 📋 **v2.0 Redesign** — Phases 7-10 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED YYYY-MM-DD</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed YYYY-MM-DD
- [x] Phase 2: Authentication (2/2 plans) — completed YYYY-MM-DD
- [x] Phase 3: Core Features (3/3 plans) — completed YYYY-MM-DD
- [x] Phase 4: Polish (1/1 plan) — completed YYYY-MM-DD

</details>

### 🚧 v[Next] [Name] (In Progress / Planned)

- [ ] Phase 5: [Name] ([N] plans)
- [ ] Phase 6: [Name] ([N] plans)

## Progress

| Phase             | Milestone | Plans Complete | Status      | Completed  |
| ----------------- | --------- | -------------- | ----------- | ---------- |
| 1. Foundation     | v1.0      | 2/2            | Complete    | YYYY-MM-DD |
| 2. Authentication | v1.0      | 2/2            | Complete    | YYYY-MM-DD |
| 3. Core Features  | v1.0      | 3/3            | Complete    | YYYY-MM-DD |
| 4. Polish         | v1.0      | 1/1            | Complete    | YYYY-MM-DD |
| 5. Security Audit | v1.1      | 0/1            | Not started | -          |
| 6. Hardening      | v1.1      | 0/2            | Not started | -          |
```

</step>

<step name="archive_milestone">

**将归档工作委托给 `gsd-sdk query milestone.complete`：**

```bash
ARCHIVE=$(gsd-sdk query milestone.complete "v[X.Y]" --name "[Milestone Name]")
```

CLI 会处理：
- 创建 `.planning/milestones/` 目录
- 将 `ROADMAP.md` 归档到 `milestones/v[X.Y]-ROADMAP.md`
- 将 `REQUIREMENTS.md` 归档到 `milestones/v[X.Y]-REQUIREMENTS.md`，并附加归档 header
- 如果 audit file 存在，则移动到 milestones
- 使用 `SUMMARY.md` 文件中的 accomplishments 创建或追加 `MILESTONES.md` 条目
- 更新 `STATE.md`（状态、最近活动）

从结果中提取：`version`, `date`, `phases`, `plans`, `tasks`, `accomplishments`, `archived`。

验证：`✅ Milestone archived to .planning/milestones/`

**Phase archival（可选）：** 归档完成后，询问用户：


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 后，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对无法使用 `AskUserQuestion` 的非-Claude runtime（OpenAI Codex、Gemini CLI 等）是必需的。
AskUserQuestion(header="Archive Phases", question="Archive phase directories to milestones/?", options: "Yes — move to milestones/v[X.Y]-phases/" | "Skip — keep phases in place")

如果选择 `"Yes"`：将 phase 目录移动到 milestone archive：
```bash
mkdir -p .planning/milestones/v[X.Y]-phases
# For each phase directory in .planning/phases/:
mv .planning/phases/{phase-dir} .planning/milestones/v[X.Y]-phases/
```
验证：`✅ Phase directories archived to .planning/milestones/v[X.Y]-phases/`

如果选择 `"Skip"`：phase 目录保留在 `.planning/phases/` 中，作为原始执行历史。之后可以用 `/gsd-cleanup` 做补充归档。

归档之后，AI 仍需处理：
- 按 milestone 分组重组 `ROADMAP.md`（需要判断）并在提取 Backlog section 后就地覆盖
- 完整的 `PROJECT.md` 演进审查（需要理解内容）
- 对归档文件和更新后的 `ROADMAP.md` 做 safety commit，然后执行 `git rm .planning/REQUIREMENTS.md`
- 这些步骤**不会**完全委托出去，因为它们需要 AI 对内容进行解释判断

</step>

<step name="reorganize_roadmap_and_delete_originals">

在 `milestone complete` 完成归档之后，按 milestone 分组重组 `ROADMAP.md`，然后在删除原文件之前先提交归档内容，作为 safety checkpoint。

**Backlog preservation：** 重写 `ROADMAP.md` 之前，**先做这一步**：

在做任何修改前，从当前 `ROADMAP.md` 中提取 Backlog section：

```bash
# Extract lines under ## Backlog through end of file (or next ## section)
BACKLOG_SECTION=$(awk '/^## Backlog/{found=1} found{print}' .planning/ROADMAP.md)
```

如果 `$BACKLOG_SECTION` 为空，则说明没有 Backlog section，静默跳过。

**重组 `ROADMAP.md`**，按 milestone 分组就地覆盖（**不要**先删除）：

```markdown
# Roadmap: [Project Name]

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped YYYY-MM-DD)
- 🚧 **v1.1 Security** — Phases 5-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED YYYY-MM-DD</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed YYYY-MM-DD
- [x] Phase 2: Authentication (2/2 plans) — completed YYYY-MM-DD

</details>
```

**重写后重新追加 Backlog section**（仅当 `$BACKLOG_SECTION` 非空时）：

将提取出的 Backlog 内容原样追加到新写入的 `ROADMAP.md` 末尾。这样可以确保 999.x backlog item 在 milestone 重组时永远不会被悄悄丢掉。

**Safety commit：** 在删除任何原文件**之前**，先提交归档文件：

```bash
gsd-sdk query commit "chore: archive v[X.Y] milestone files" .planning/milestones/v[X.Y]-ROADMAP.md .planning/milestones/v[X.Y]-REQUIREMENTS.md .planning/milestones/v[X.Y]-MILESTONE-AUDIT.md .planning/MILESTONES.md .planning/PROJECT.md .planning/STATE.md .planning/ROADMAP.md
```

这会在 git 历史中创建一个可靠的 checkpoint。如果之后任一步失败，都可以从 git 重建 working tree。

**通过 `git rm` 删除 `REQUIREMENTS.md`**（保留历史，并原子化地暂存删除）：

```bash
git rm .planning/REQUIREMENTS.md
```

</step>

<step name="write_retrospective">

**追加到持续维护的 retrospective：**

检查是否已有 retrospective：
```bash
ls .planning/RETROSPECTIVE.md 2>/dev/null || true
```

**如果存在：** 读取该文件，并在 `## Cross-Milestone Trends` section 之前追加新的 milestone section。

**如果不存在：** 使用 `~/.claude/get-shit-done/templates/retrospective.md` 模板创建。

**收集 retrospective 数据：**

1. 从 `SUMMARY.md` 文件中提取关键交付物、一句话总结和技术决策
2. 从 `VERIFICATION.md` 文件中提取验证分数和发现的缺口
3. 从 `UAT.md` 文件中提取测试结果和发现的问题
4. 从 `git log` 统计 commit 数并计算时间线
5. 结合 milestone 过程，反思哪些做法有效，哪些无效

**编写 milestone section：**

```markdown
## Milestone: v{version} — {name}

**Shipped:** {date}
**Phases:** {phase_count} | **Plans:** {plan_count}

### What Was Built
{Extract from SUMMARY.md one-liners}

### What Worked
{Patterns that led to smooth execution}

### What Was Inefficient
{Missed opportunities, rework, bottlenecks}

### Patterns Established
{New conventions discovered during this milestone}

### Key Lessons
{Specific, actionable takeaways}

### Cost Observations
- Model mix: {X}% opus, {Y}% sonnet, {Z}% haiku
- Sessions: {count}
- Notable: {efficiency observation}
```

**更新跨 milestone 趋势：**

如果存在 `## Cross-Milestone Trends` section，则用这个 milestone 的新数据更新其中的表格。

**Commit：**
```bash
gsd-sdk query commit "docs: update retrospective for v${VERSION}" .planning/RETROSPECTIVE.md
```

</step>

<step name="update_state">

`milestone complete` 已处理了大部分 `STATE.md` 更新，但仍需核对并更新剩余字段：

**Project Reference:**

```markdown
## Project Reference

See: .planning/PROJECT.md (updated [today])

**Core value:** [Current core value from PROJECT.md]
**Current focus:** [Next milestone or "Planning next milestone"]
```

**Accumulated Context:**
- 清晰的决策摘要（完整日志在 `PROJECT.md` 中）
- 清晰列出已解决的 blocker
- 为下一个 milestone 保留仍然开放的 blocker

</step>

<step name="handle_branches">

检查分支策略，并提供合并选项。

使用 `init milestone-op` 获取上下文，或直接读取 config：

```bash
INIT=$(gsd-sdk query init.execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 中提取 `branching_strategy`, `phase_branch_template`, `milestone_branch_template`, `commit_docs`。

检测 base branch：
```bash
BASE_BRANCH=$(gsd-sdk query config-get git.base_branch 2>/dev/null || echo "")
if [ -z "$BASE_BRANCH" ] || [ "$BASE_BRANCH" = "null" ]; then
  BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|^refs/remotes/origin/||')
  BASE_BRANCH="${BASE_BRANCH:-main}"
fi
```

**如果为 `"none"`：** 直接跳到 `git_tag`。

**对于 `"phase"` 策略：**

```bash
BRANCH_PREFIX=$(echo "$PHASE_BRANCH_TEMPLATE" | sed 's/{.*//')
PHASE_BRANCHES=$(git branch --list "${BRANCH_PREFIX}*" 2>/dev/null | sed 's/^\*//' | tr -d ' ')
```

**对于 `"milestone"` 策略：**

```bash
BRANCH_PREFIX=$(echo "$MILESTONE_BRANCH_TEMPLATE" | sed 's/{.*//')
MILESTONE_BRANCH=$(git branch --list "${BRANCH_PREFIX}*" 2>/dev/null | sed 's/^\*//' | tr -d ' ' | head -1)
```

**如果未找到任何分支：** 跳到 `git_tag`。

**如果存在分支：**

```
## Git Branches Detected

Branching strategy: {phase/milestone}
Branches: {list}

Options:
1. **Merge to main** — Merge branch(es) to main
2. **Delete without merging** — Already merged or not needed
3. **Keep branches** — Leave for manual handling
```

使用 `AskUserQuestion` 提供选项：`Squash merge (Recommended)`、`Merge with history`、`Delete without merging`、`Keep branches`。

**Squash merge：**

```bash
CURRENT_BRANCH=$(git branch --show-current)
git checkout ${BASE_BRANCH}

if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  for branch in $PHASE_BRANCHES; do
    git merge --squash "$branch"
    # Strip .planning/ from staging if commit_docs is false
    if [ "$COMMIT_DOCS" = "false" ]; then
      git reset HEAD .planning/ 2>/dev/null || true
    fi
    git commit -m "feat: $branch for v[X.Y]"
  done
fi

if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  git merge --squash "$MILESTONE_BRANCH"
  # Strip .planning/ from staging if commit_docs is false
  if [ "$COMMIT_DOCS" = "false" ]; then
    git reset HEAD .planning/ 2>/dev/null || true
  fi
  git commit -m "feat: $MILESTONE_BRANCH for v[X.Y]"
fi

git checkout "$CURRENT_BRANCH"
```

**Merge with history：**

```bash
CURRENT_BRANCH=$(git branch --show-current)
git checkout ${BASE_BRANCH}

if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  for branch in $PHASE_BRANCHES; do
    git merge --no-ff --no-commit "$branch"
    # Strip .planning/ from staging if commit_docs is false
    if [ "$COMMIT_DOCS" = "false" ]; then
      git reset HEAD .planning/ 2>/dev/null || true
    fi
    git commit -m "Merge branch '$branch' for v[X.Y]"
  done
fi

if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  git merge --no-ff --no-commit "$MILESTONE_BRANCH"
  # Strip .planning/ from staging if commit_docs is false
  if [ "$COMMIT_DOCS" = "false" ]; then
    git reset HEAD .planning/ 2>/dev/null || true
  fi
  git commit -m "Merge branch '$MILESTONE_BRANCH' for v[X.Y]"
fi

git checkout "$CURRENT_BRANCH"
```

**Delete without merging：**

```bash
if [ "$BRANCHING_STRATEGY" = "phase" ]; then
  for branch in $PHASE_BRANCHES; do
    git branch -d "$branch" 2>/dev/null || git branch -D "$branch"
  done
fi

if [ "$BRANCHING_STRATEGY" = "milestone" ]; then
  git branch -d "$MILESTONE_BRANCH" 2>/dev/null || git branch -D "$MILESTONE_BRANCH"
fi
```

**Keep branches：** 报告 `"Branches preserved for manual handling"`

</step>

<step name="git_tag">

创建 git tag：

```bash
git tag -a v[X.Y] -m "v[X.Y] [Name]

Delivered: [One sentence]

Key accomplishments:
- [Item 1]
- [Item 2]
- [Item 3]

See .planning/MILESTONES.md for full details."
```

确认：`"Tagged: v[X.Y]"`

询问：`"Push tag to remote? (y/n)"`

如果选择 yes：
```bash
git push origin v[X.Y]
```

</step>

<step name="git_commit_milestone">

提交 `REQUIREMENTS.md` 的删除（归档文件和 `ROADMAP.md` 已在 `reorganize_roadmap_and_delete_originals` 的 safety commit 中提交）。

```bash
git commit -m "chore: remove REQUIREMENTS.md for v[X.Y] milestone"
```

确认：`"Committed: chore: remove REQUIREMENTS.md for v[X.Y] milestone"`

</step>

<step name="offer_next">

```
✅ Milestone v[X.Y] [Name] complete

Shipped:
- [N] phases ([M] plans, [P] tasks)
- [One sentence of what shipped]

Archived:
- milestones/v[X.Y]-ROADMAP.md
- milestones/v[X.Y]-REQUIREMENTS.md

Summary: .planning/MILESTONES.md
Tag: v[X.Y]

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Start Next Milestone** — questioning → research → requirements → roadmap

`/clear` then:

`/gsd-new-milestone`

---
```

</step>

</process>

<milestone_naming>

**Version conventions:**
- **v1.0** — 初始 MVP
- **v1.1, v1.2** — 小版本更新、新功能、修复
- **v2.0, v3.0** — 大规模重写、breaking changes、新方向

**Names:** 简短 1-2 个词（`v1.0 MVP`、`v1.1 Security`、`v1.2 Performance`、`v2.0 Redesign`）。

</milestone_naming>

<what_qualifies>

**适合创建 milestone 的情况：** 初始发布、公开发布、已交付的大型功能集合、归档规划之前。

**不适合创建 milestone 的情况：** 每个 phase 完成时（太细）、进行中的工作、内部开发迭代（除非确实已经交付）。

经验判断：`"Is this deployed/usable/shipped?"` 如果答案是 yes → milestone。否则 → 继续工作。

</what_qualifies>

<success_criteria>

Milestone completion is successful when:

- [ ] 已运行关闭前 artifact 审计，并向用户展示输出
- [ ] 若用户选择 acknowledged，则已在 `STATE.md` 中记录 deferred item
- [ ] 已在 `MILESTONES.md` 条目中记录已知 deferred item 的数量

- [ ] 已创建包含统计信息和 accomplishments 的 `MILESTONES.md` 条目
- [ ] 已完成 `PROJECT.md` 的完整演进审查
- [ ] 已将所有已发布 requirements 移到 `PROJECT.md` 的 `Validated`
- [ ] 已用结果更新 `Key Decisions`
- [ ] 已在重写前提取 `ROADMAP.md` 的 Backlog section，并在之后重新追加（若不存在则跳过）
- [ ] 已按 milestone 分组重组 `ROADMAP.md`（就地覆盖，而不是删除后重建）
- [ ] 已创建 roadmap 归档（`milestones/v[X.Y]-ROADMAP.md`）
- [ ] 已创建 requirements 归档（`milestones/v[X.Y]-REQUIREMENTS.md`）
- [ ] 已在删除 `REQUIREMENTS.md` 之前完成 safety commit（归档文件 + 更新后的 `ROADMAP.md`）
- [ ] 已通过 `git rm` 删除 `REQUIREMENTS.md`（为下一个 milestone 留出全新文件，同时保留历史）
- [ ] 已使用最新的项目引用更新 `STATE.md`
- [ ] 已创建 git tag（`v[X.Y]`）
- [ ] 已完成 milestone commit（包含归档文件和删除）
- [ ] 已对照 `REQUIREMENTS.md` traceability table 检查 requirements 完成情况
- [ ] 已在 requirements 未完成时展示 proceed/audit/abort 选项
- [ ] 若用户在 requirements 未完成的情况下继续，已在 `MILESTONES.md` 中记录已知缺口
- [ ] 已使用 milestone section 更新 `RETROSPECTIVE.md`
- [ ] 已更新跨 milestone 趋势
- [ ] 用户已明确下一步（`/gsd-new-milestone`）

</success_criteria>
