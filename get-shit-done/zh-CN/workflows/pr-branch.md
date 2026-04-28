<purpose>
通过过滤掉临时 .planning/ commits 来为 pull requests 创建干净分支。
PR branch 只包含代码变更和结构化规划状态，因此 reviewer
不会看到 GSD 的临时产物（PLAN.md、SUMMARY.md、CONTEXT.md、RESEARCH.md 等），
但 milestone archives、STATE.md、ROADMAP.md 和 PROJECT.md 的变更会被保留。

使用 git cherry-pick 配合路径过滤来重建干净历史。
</purpose>

<process>

<step name="detect_state">
解析 `$ARGUMENTS` 以获取目标分支（默认：`main`）。

```bash
CURRENT_BRANCH=$(git branch --show-current)
TARGET=${1:-main}
```

检查前置条件：
- 必须位于 feature branch（不能是 main/master）
- 必须有领先于目标分支的 commits

```bash
AHEAD=$(git rev-list --count "$TARGET".."$CURRENT_BRANCH" 2>/dev/null)
if [ "$AHEAD" = "0" ]; then
  echo "No commits ahead of $TARGET — nothing to filter."
  exit 0
fi
```

显示：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PR BRANCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch: {CURRENT_BRANCH}
Target: {TARGET}
Commits: {AHEAD} ahead
```
</step>

<step name="analyze_commits">
对 commits 进行分类：

```bash
# Get all commits ahead of target
git log --oneline "$TARGET".."$CURRENT_BRANCH" --no-merges
```

**Structural planning files** - 始终保留（仓库规划状态）：
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/MILESTONES.md`
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/milestones/**`

**Transient planning files** - 从 PR branch 中排除（reviewer 噪音）：
- `.planning/phases/**` (PLAN.md, SUMMARY.md, CONTEXT.md, RESEARCH.md, etc.)
- `.planning/quick/**`
- `.planning/research/**`
- `.planning/threads/**`
- `.planning/todos/**`
- `.planning/debug/**`
- `.planning/seeds/**`
- `.planning/codebase/**`
- `.planning/ui-reviews/**`

对每个 commit，检查它修改了什么：

```bash
# For each commit hash
FILES=$(git diff-tree --no-commit-id --name-only -r $HASH)
NON_PLANNING=$(echo "$FILES" | grep -v "^\.planning/" | wc -l)
STRUCTURAL=$(echo "$FILES" | grep -E "^\.planning/(STATE|ROADMAP|MILESTONES|PROJECT|REQUIREMENTS)\.md|^\.planning/milestones/" | wc -l)
TRANSIENT_ONLY=$(echo "$FILES" | grep "^\.planning/" | grep -vE "^\.planning/(STATE|ROADMAP|MILESTONES|PROJECT|REQUIREMENTS)\.md|^\.planning/milestones/" | wc -l)
```

分类规则：
- **Code commits**: 至少修改一个非 `.planning/` 文件 → INCLUDE
- **Structural planning commits**: 只修改结构化 `.planning/` 文件（STATE.md、ROADMAP.md、MILESTONES.md、PROJECT.md、REQUIREMENTS.md、milestones/**）→ INCLUDE
- **Transient planning commits**: 只修改临时 `.planning/` 文件（phases/、quick/、research/ 等）→ EXCLUDE
- **Mixed commits**: 修改代码 + 任意 planning 文件 → INCLUDE（临时 planning 变更会一起带上；在混合上下文中可以接受）

显示分析结果：
```
Commits to include: {N} (代码变更 + 结构化规划)
Commits to exclude: {N} (仅临时规划)
Mixed commits: {N} (代码 + planning - 已包含)
Structural planning commits: {N} (STATE/ROADMAP/milestone 更新 - 已包含)
```
</step>

<step name="create_pr_branch">
```bash
PR_BRANCH="${CURRENT_BRANCH}-pr"

# Create PR branch from target
git checkout -b "$PR_BRANCH" "$TARGET"
```

按顺序 cherry-pick 代码 commits 和结构化规划 commits：

```bash
for HASH in $CODE_AND_STRUCTURAL_COMMITS; do
  git cherry-pick "$HASH" --no-commit
  # Remove only transient .planning/ subdirectories that came along in mixed commits.
  # DO NOT remove structural files (STATE.md, ROADMAP.md, MILESTONES.md, PROJECT.md,
  # REQUIREMENTS.md, milestones/) — these must survive into the PR branch.
  for dir in phases quick research threads todos debug seeds codebase ui-reviews; do
    git rm -r --cached ".planning/$dir/" 2>/dev/null || true
  done
  git commit -C "$HASH"
done
```

返回原始分支：
```bash
git checkout "$CURRENT_BRANCH"
```
</step>

<step name="verify">
```bash
# Verify no .planning/ files in PR branch
PLANNING_FILES=$(git diff --name-only "$TARGET".."$PR_BRANCH" | grep "^\.planning/" | wc -l)
TOTAL_FILES=$(git diff --name-only "$TARGET".."$PR_BRANCH" | wc -l)
PR_COMMITS=$(git rev-list --count "$TARGET".."$PR_BRANCH")
```

显示结果：
```
✅ PR branch 已创建：{PR_BRANCH}

原始分支：{AHEAD} commits，{ORIGINAL_FILES} files
PR branch：{PR_COMMITS} commits，{TOTAL_FILES} files
Planning files：{PLANNING_FILES}（应为 0）

后续步骤：
  git push origin {PR_BRANCH}
  gh pr create --base {TARGET} --head {PR_BRANCH}

或者使用 /gsd-ship 自动创建 PR。
```
</step>

</process>

<success_criteria>
- [ ] 已从目标分支创建 PR branch
- [ ] 已排除仅 planning 的 commits
- [ ] PR branch diff 中没有 .planning/ 文件
- [ ] 已保留原始 commit messages
- [ ] 已向用户显示后续步骤
</success_criteria>
