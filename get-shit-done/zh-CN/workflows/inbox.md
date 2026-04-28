<purpose>
分流并审查所有打开的 GitHub issue 和 PR，对照项目贡献模板检查。生成结构化报告，展示每一项的合规状态、标出缺失的必填字段、识别标签缺口，并可选执行操作（label、comment、close）。
</purpose>

<required_reading>
开始前，读取以下项目文件以理解审查标准：
- `.github/ISSUE_TEMPLATE/feature_request.yml` — feature issue 的必填字段
- `.github/ISSUE_TEMPLATE/enhancement.yml` — enhancement issue 的必填字段
- `.github/ISSUE_TEMPLATE/chore.yml` — chore issue 的必填字段
- `.github/ISSUE_TEMPLATE/bug_report.yml` — bug report 的必填字段
- `.github/PULL_REQUEST_TEMPLATE/feature.md` — feature PR 的必填 checklist
- `.github/PULL_REQUEST_TEMPLATE/enhancement.md` — enhancement PR 的必填 checklist
- `.github/PULL_REQUEST_TEMPLATE/fix.md` — fix PR 的必填 checklist
- `CONTRIBUTING.md` — issue-first 规则和 approval gate
</required_reading>

<process>

<step name="preflight">
验证前置条件：

1. **`gh` CLI 可用并已认证吗？**
   ```bash
   which gh && gh auth status 2>&1
   ```
   如果不可用：打印设置说明并退出。

2. **检测仓库：**
   如果传入 `--repo` flag，就使用它。否则：
   ```bash
   gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null
   ```
   如果未检测到 repo：报错，必须在带 GitHub remote 的 git repo 中执行。

3. **解析 flags：**
   - `--issues` → 设置 REVIEW_ISSUES=true, REVIEW_PRS=false
   - `--prs` → 设置 REVIEW_ISSUES=false, REVIEW_PRS=true
   - `--label` → 设置 AUTO_LABEL=true
   - `--close-incomplete` → 设置 AUTO_CLOSE=true
   - 默认（无 flags）：同时审查 issue 和 PR，只报告（不自动操作）
</step>

<step name="fetch_issues">
如果 REVIEW_ISSUES=false，则跳过。

获取所有打开的 issue：
```bash
gh issue list --state open --json number,title,labels,body,author,createdAt,updatedAt --limit 100
```

对每个 issue，按 labels 和 body 内容分类：

| Label/Pattern | Type | Template |
|---|---|---|
| `feature-request` | Feature | feature_request.yml |
| `enhancement` | Enhancement | enhancement.yml |
| `bug` | Bug | bug_report.yml |
| `type: chore` | Chore | chore.yml |
| No matching label | Unknown | Flag for manual triage |

如果 issue 没有 type label，尝试从 body 内容分类：
- 包含 "### Feature name" → 很可能是 Feature
- 包含 "### What existing feature" → 很可能是 Enhancement
- 包含 "### What happened?" → 很可能是 Bug
- 包含 "### What is the maintenance task?" → 很可能是 Chore
- 无法判断 → 标记为 `needs-triage`
</step>

<step name="review_issues">
如果 REVIEW_ISSUES=false，则跳过。

对每个已分类 issue，按对应模板要求审查。

**Feature Request Review Checklist:**
- [ ] 包含 pre-submission checklist（4 个 checkbox）
- [ ] 提供 feature name
- [ ] 选择了 addition 类型
- [ ] 填写了 problem statement（不是占位文本）
- [ ] 描述了新增内容，并给出示例
- [ ] 列出完整变更范围（创建/修改的文件/系统）
- [ ] 包含 user stories（至少 2 条）
- [ ] 包含 acceptance criteria（可测试条件）
- [ ] 选择了适用 runtime
- [ ] 包含 breaking changes 评估
- [ ] 描述了 maintenance burden
- [ ] 考虑了 alternatives（非空）
- **Label check:** 是否有 `needs-review` label？是否有 `approved-feature` label？
- **Gate check:** 如果已有与此 issue 关联的 PR，该 issue 是否有 `approved-feature`？

**Enhancement Review Checklist:**
- [ ] 包含 pre-submission checklist（4 个 checkbox）
- [ ] 明确了改进对象
- [ ] 用示例描述当前行为
- [ ] 用示例描述提议行为
- [ ] 清楚说明了原因和收益（不能含糊）
- [ ] 列出了变更范围
- [ ] 评估了 breaking changes
- [ ] 考虑了 alternatives
- [ ] 选择了受影响区域
- **Label check:** 是否有 `needs-review` label？是否有 `approved-enhancement` label？
- **Gate check:** 如果已有与此 issue 关联的 PR，该 issue 是否有 `approved-enhancement`？

**Bug Report Review Checklist:**
- [ ] 提供了 GSD Version
- [ ] 选择了 Runtime
- [ ] 选择了 OS
- [ ] 提供了 Node.js version
- [ ] 描述了发生了什么
- [ ] 描述了期望行为
- [ ] 提供了复现步骤
- [ ] 选择了频率
- [ ] 选择了严重度/影响
- [ ] 确认了 PII checklist
- **Label check:** 是否有 `needs-triage` 或 `confirmed-bug` label？

**Chore Review Checklist:**
- [ ] 确认了 pre-submission checklist（无用户可见变更）
- [ ] 描述了 maintenance task
- [ ] 选择了 maintenance 类型
- [ ] 具体描述了当前状态
- [ ] 列出了提议工作
- [ ] 包含 acceptance criteria
- [ ] 选择了受影响区域
- **Label check:** 是否有 `needs-triage` label？

**Scoring:** 对每个 issue 计算完整度百分比：
- 统计已填写必填字段数 / 总必填字段数
- Score = (present / total) * 100
- Status: COMPLETE (100%), MOSTLY COMPLETE (75-99%), INCOMPLETE (50-74%), REJECT (<50%)
</step>

<step name="fetch_prs">
如果 REVIEW_PRS=false，则跳过。

获取所有打开的 PR：
```bash
gh pr list --state open --json number,title,labels,body,author,headRefName,baseRefName,isDraft,createdAt,reviewDecision,statusCheckRollup --limit 100
```

对每个 PR，按 body 内容和关联 issue 分类：

| Body Pattern | Type | Template |
|---|---|---|
| Contains "## Feature PR" or "## Feature summary" | Feature PR | feature.md |
| Contains "## Enhancement PR" or "## What this enhancement improves" | Enhancement PR | enhancement.md |
| Contains "## Fix PR" or "## What was broken" | Fix PR | fix.md |
| Uses default template | Wrong Template | Flag — must use typed template |
| Cannot determine | Unknown | Flag for manual review |

同时检查关联 issue：
```bash
gh pr view {number} --json body -q '.body' | grep -oE '(Closes|Fixes|Resolves) #[0-9]+'
```
</step>

<step name="review_prs">
如果 REVIEW_PRS=false，则跳过。

对每个已分类 PR，按对应模板要求审查。

**Feature PR Review Checklist:**
- [ ] 使用 feature PR template（不是默认模板）
- [ ] 通过 `Closes #NNN` 关联了 issue
- [ ] 关联 issue 存在且带有 `approved-feature` label
- [ ] 包含 feature summary
- [ ] 填写了 new files table
- [ ] 填写了 modified files table
- [ ] 包含 implementation notes
- [ ] 包含 spec compliance checklist（来自 issue 的 acceptance criteria）
- [ ] 描述了 test coverage
- [ ] 勾选了 tested platforms（macOS、Windows、Linux）
- [ ] 勾选了 tested runtimes
- [ ] 勾选了 scope confirmation
- [ ] 完成了完整 checklist
- [ ] 填写了 breaking changes section
- **CI check:** 所有 status checks 都通过了吗？
- **Review check:** 是否有 review approval？

**Enhancement PR Review Checklist:**
- [ ] 使用 enhancement PR template（不是默认模板）
- [ ] 通过 `Closes #NNN` 关联了 issue
- [ ] 关联 issue 存在且带有 `approved-enhancement` label
- [ ] 描述了改进内容
- [ ] 提供了 before/after
- [ ] 描述了 implementation approach
- [ ] 描述了 verification method
- [ ] 勾选了 tested platforms
- [ ] 勾选了 tested runtimes
- [ ] 勾选了 scope confirmation
- [ ] 完成了完整 checklist
- [ ] 填写了 breaking changes section
- **CI check:** 所有 status checks 都通过了吗？

**Fix PR Review Checklist:**
- [ ] 使用 fix PR template（不是默认模板）
- [ ] 通过 `Fixes #NNN` 关联了 issue
- [ ] 关联 issue 存在且带有 `confirmed-bug` label
- [ ] 描述了损坏内容
- [ ] 描述了修复内容
- [ ] 解释了 root cause
- [ ] 描述了 verification method
- [ ] 添加了 regression test（或解释为何未添加）
- [ ] 勾选了 tested platforms
- [ ] 勾选了 tested runtimes
- [ ] 完成了完整 checklist
- [ ] 填写了 breaking changes section
- **CI check:** 所有 status checks 都通过了吗？

**Cross-cutting PR Checks (all types):**
- [ ] PR title 足够明确（不能只是 "fix" 或 "update"）
- [ ] 一个 PR 只处理一个关注点（不要把 fix + enhancement 混在一起）
- [ ] diff 中没有无关的格式化改动
- [ ] 已更新 CHANGELOG.md
- [ ] 没有使用 `--no-verify` 或跳过 hooks

**Scoring:** 与 issue 相同，为每个 PR 计算完整度百分比。
</step>

<step name="check_gates">
交叉比对 issue 和 PR，以强制执行 issue-first 规则：

对每个打开的 PR：
1. 从 body 中提取关联 issue 编号
2. 如果没有关联 issue：**GATE VIOLATION** — PR 没有关联 issue
3. 如果有关联 issue，检查其 labels：
   - Feature PR → issue 必须有 `approved-feature`
   - Enhancement PR → issue 必须有 `approved-enhancement`
   - Fix PR → issue 必须有 `confirmed-bug`
4. 如果缺少 label：**GATE VIOLATION** — PR 在 approval 前就已打开

高亮报告 gate violation。这些是最重要的发现，因为项目会自动关闭未满足 approval gate 的 PR。
</step>

<step name="generate_report">
生成结构化 triage report：

```text
===================================================================
  GSD INBOX TRIAGE — {repo} — {date}
===================================================================

SUMMARY
-------
Open issues: {count}    Open PRs: {count}
  Features:    {n}        Feature PRs:      {n}
  Enhancements:{n}        Enhancement PRs:  {n}
  Bugs:        {n}        Fix PRs:          {n}
  Chores:      {n}        Wrong template:   {n}
  Unclassified:{n}        No linked issue:  {n}

GATE VIOLATIONS (action required)
---------------------------------
{For each violation:}
  PR #{number}: {title}
    Problem: {description — e.g., "No approved-feature label on linked issue #45"}
    Action:  {what to do — e.g., "Close PR or approve issue #45 first"}

ISSUES NEEDING ATTENTION
------------------------
{For each issue sorted by completeness score, lowest first:}
  #{number} [{type}] {title}
    Score: {percentage}% complete
    Missing: {list of missing required fields}
    Labels: {current labels} → Suggested: {recommended labels}
    Age: {days since created}

PRS NEEDING ATTENTION
---------------------
{For each PR sorted by completeness score, lowest first:}
  #{number} [{type}] {title}
    Score: {percentage}% complete
    Missing: {list of missing checklist items}
    CI: {passing/failing/pending}
    Review: {approved/changes_requested/none}
    Linked issue: #{issue_number} ({issue_status})
    Age: {days since created}

READY TO MERGE
--------------
{PRs that are 100% complete, CI passing, approved:}
  #{number} {title} — ready

STALE ITEMS (>30 days, no activity)
------------------------------------
{Issues and PRs with no updates in 30+ days}

===================================================================
```

如果存在 `.planning/` 目录，将此报告写入 `.planning/INBOX-TRIAGE.md`；否则只打印到控制台。
</step>

<step name="auto_actions">
仅当设置了 `--label` 或 `--close-incomplete` flags 时执行。

**If --label:**
对每个缺少 label 或 label 不正确的 issue/PR：
```bash
gh issue edit {number} --add-label "{label}"
```
或：
```bash
gh pr edit {number} --add-label "{label}"
```

推荐 labels：
- 未分类 issue → 添加 `needs-triage`
- 未审查的 feature issue → 添加 `needs-review`
- 未审查的 enhancement issue → 添加 `needs-review`
- 未 triage 的 bug report → 添加 `needs-triage`
- 存在 gate violation 的 PR → 添加 `gate-violation`

**If --close-incomplete:**
对完整度低于 50% 的 issue：
```bash
gh issue close {number} --comment "Closed by GSD inbox triage: this issue is missing required fields per the issue template. Missing: {list}. Please reopen with a complete submission. See CONTRIBUTING.md for requirements."
```

对存在 gate violation 的 PR：
```bash
gh pr close {number} --comment "Closed by GSD inbox triage: this PR does not meet the issue-first requirement. {specific violation}. See CONTRIBUTING.md for the correct process."
```

在关闭任何内容前，始终先征得用户确认：

**Text mode (`workflow.text_mode: true` in config or `--text` flag):** 如果 `$ARGUMENTS` 中存在 `--text`，或 init JSON 中 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 时，将每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这对 `AskUserQuestion` 不可用的非 Claude runtime（OpenAI Codex、Gemini CLI 等）是必须的。

```
AskUserQuestion:
  question: "Found {N} items to close. Review the list above — proceed with closing?"
  options:
    - label: "Close all"
      description: "Close all {N} non-compliant items with explanation comments"
    - label: "Let me pick"
      description: "I'll choose which ones to close"
    - label: "Skip"
      description: "Don't close anything — report only"
```
</step>

<step name="report">
```
───────────────────────────────────────────────────────────────

## Inbox Triage Complete

Reviewed: {issue_count} issues, {pr_count} PRs
Gate violations: {violation_count}
Ready to merge: {ready_count}
Needing attention: {attention_count}
Stale (30+ days): {stale_count}
{If report saved: "Report saved to .planning/INBOX-TRIAGE.md"}

Next steps:
- Review gate violations first — these block the contribution pipeline
- Address incomplete submissions (comment or close)
- Merge ready PRs
- Triage unclassified issues

───────────────────────────────────────────────────────────────
```
</step>

</process>

<offer_next>
triage 完成后：

- /gsd-review — 对特定 phase plan 运行跨 AI peer review
- /gsd-ship — 从已完成工作创建 PR
- /gsd-progress — 查看整体项目状态
- /gsd-inbox --label — 重新运行，并启用自动打标
</offer_next>

<success_criteria>
- [ ] 获取并按类型分类所有打开的 issue
- [ ] 每个 issue 都按其模板要求审查
- [ ] 获取并按类型分类所有打开的 PR
- [ ] 每个 PR 都按其模板 checklist 审查
- [ ] 识别 issue-first gate violation
- [ ] 生成带分数和 action items 的结构化报告
- [ ] 仅在设置对应 flag 且用户确认后执行 auto-actions
</success_criteria>
