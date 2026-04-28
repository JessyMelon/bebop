<purpose>
从已完成的 phase/milestone 工作创建 pull request，根据 planning artifacts 生成完整的 PR body，可选地运行 code review，并为 merge 做准备。闭合 plan → execute → verify → ship 的工作循环。
</purpose>

<required_reading>
开始前，读取调用 prompt 的 execution_context 中引用的所有文件。
</required_reading>

<process>

<step name="initialize">
解析参数并加载项目状态：

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 中解析：`phase_found`、`phase_dir`、`phase_number`、`phase_name`、`padded_phase`、`commit_docs`。

同时加载 config 以读取 branching strategy：
```bash
CONFIG=$(gsd-sdk query state.load)
```

提取：`branching_strategy`、`branch_name`。

检测 PR 和 merge 使用的 base branch：
```bash
BASE_BRANCH=$(gsd-sdk query config-get git.base_branch 2>/dev/null || echo "")
if [ -z "$BASE_BRANCH" ] || [ "$BASE_BRANCH" = "null" ]; then
  BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|^refs/remotes/origin/||')
  BASE_BRANCH="${BASE_BRANCH:-main}"
fi
```
</step>

<step name="preflight_checks">
确认工作已经可以 ship：

1. **Verification 通过了吗？**
   ```bash
   VERIFICATION=$(cat ${PHASE_DIR}/*-VERIFICATION.md 2>/dev/null)
   ```
   检查是否存在 `status: passed` 或 `status: human_needed`（且已有人类批准）。
   如果没有 VERIFICATION.md，或状态是 `gaps_found`：给出警告并请求用户确认。

2. **工作树干净吗？**
   ```bash
   git status --short
   ```
   如果存在未提交改动：要求用户先 commit 或 stash。

3. **在正确的分支上吗？**
   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   ```
   如果当前在 `${BASE_BRANCH}`：警告，不应直接在 feature branch 之外提交。
   如果 branching_strategy 是 `none`：提供立即创建分支的选项。

4. **配置了 remote 吗？**
   ```bash
   git remote -v | head -2
   ```
   检测 `origin` remote。如果没有 remote：报错，无法创建 PR。

5. **`gh` CLI 可用吗？**
   ```bash
   which gh && gh auth status 2>&1
   ```
   如果找不到 `gh` 或尚未认证：给出设置说明并退出。
</step>

<step name="push_branch">
将当前分支推送到 remote：

```bash
git push origin ${CURRENT_BRANCH} 2>&1
```

如果 push 失败（例如没有 upstream）：设置 upstream：
```bash
git push --set-upstream origin ${CURRENT_BRANCH} 2>&1
```

报告：`Pushed `{branch}` to origin ({commit_count} commits ahead of ${BASE_BRANCH})``
</step>

<step name="generate_pr_body">
根据 planning artifacts 自动生成完整的 PR body：

**1. 标题：**
```
Phase {phase_number}: {phase_name}
```
或对于 milestone：`Milestone {version}: {name}`

**2. Summary 部分：**
读取 ROADMAP.md 获取 phase goal。读取 VERIFICATION.md 获取 verification status。

```markdown
## Summary

**Phase {N}: {Name}**
**Goal:** {goal from ROADMAP.md}
**Status:** Verified ✓

{One paragraph synthesized from SUMMARY.md files — what was built}
```

**3. Changes 部分：**
对 phase 目录中的每个 SUMMARY.md：
```markdown
## Changes

### Plan {plan_id}: {plan_name}
{one_liner from SUMMARY.md frontmatter}

**Key files:**
{key-files.created and key-files.modified from SUMMARY.md frontmatter}
```

**4. Requirements 部分：**
```markdown
## Requirements Addressed

{REQ-IDs from plan frontmatter, linked to REQUIREMENTS.md descriptions}
```

**5. Testing 部分：**
```markdown
## Verification

- [x] Automated verification: {pass/fail from VERIFICATION.md}
- {human verification items from VERIFICATION.md, if any}
```

**6. Decisions 部分：**
```markdown
## Key Decisions

{Decisions from STATE.md accumulated context relevant to this phase}
```
</step>

<step name="create_pr">
使用生成的 body 创建 PR：

```bash
gh pr create \
  --title "Phase ${PHASE_NUMBER}: ${PHASE_NAME}" \
  --body "${PR_BODY}" \
  --base ${BASE_BRANCH}
```

如果传入了 `--draft` flag：追加 `--draft`。

报告：`PR #{number} created: {url}`
</step>

<step name="optional_review">

**外部 code review 命令（自动化子步骤）：**

在提示用户前，先检查是否配置了外部 review 命令：

```bash
REVIEW_CMD=$(gsd-sdk query config-get workflow.code_review_command 2>/dev/null | jq -r '.' 2>/dev/null || echo "")
```

如果 `REVIEW_CMD` 非空且不等于 `"null"`，运行外部 review：

1. **生成 diff 和统计：**
   ```bash
   DIFF=$(git diff ${BASE_BRANCH}...HEAD)
   DIFF_STATS=$(git diff --stat ${BASE_BRANCH}...HEAD)
   ```

2. **从 STATE.md 加载 phase 上下文：**
   ```bash
   STATE_STATUS=$(gsd-sdk query state.load 2>/dev/null | head -20)
   ```

3. **构造 review prompt，并通过 stdin 传给命令：**
   构造一个包含 diff、diff 统计和 phase 上下文的 review prompt，然后通过管道传给已配置命令：
   ```bash
   REVIEW_PROMPT="You are reviewing a pull request.\n\nDiff stats:\n${DIFF_STATS}\n\nPhase context:\n${STATE_STATUS}\n\nFull diff:\n${DIFF}\n\nRespond with JSON: { \"verdict\": \"APPROVED\" or \"REVISE\", \"confidence\": 0-100, \"summary\": \"...\", \"issues\": [{\"severity\": \"...\", \"file\": \"...\", \"line_range\": \"...\", \"description\": \"...\", \"suggestion\": \"...\"}] }"
   REVIEW_OUTPUT=$(echo "${REVIEW_PROMPT}" | timeout 120 ${REVIEW_CMD} 2>/tmp/gsd-review-stderr.log)
   REVIEW_EXIT=$?
   ```

4. **处理超时（120s）和失败：**
   如果 `REVIEW_EXIT` 非零，或命令超时：
   ```bash
   if [ $REVIEW_EXIT -ne 0 ]; then
     REVIEW_STDERR=$(cat /tmp/gsd-review-stderr.log 2>/dev/null)
     echo "WARNING: External review command failed (exit ${REVIEW_EXIT}). stderr: ${REVIEW_STDERR}"
     echo "Continuing with manual review flow..."
   fi
   ```
   失败时，连同 stderr 输出一起警告，然后继续走下面的手动 review 流程。

5. **解析 JSON 结果：**
   如果命令成功，解析 JSON 输出并报告 verdict：
   ```bash
   # Parse verdict and summary from REVIEW_OUTPUT JSON
   VERDICT=$(echo "${REVIEW_OUTPUT}" | node -e "
     let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
       try { const r=JSON.parse(d); console.log(r.verdict); }
       catch(e) { console.log('INVALID_JSON'); }
     });
   ")
   ```
   - 如果 `verdict` 是 `"APPROVED"`：报告已通过，并附上 confidence 和 summary。
   - 如果 `verdict` 是 `"REVISE"`：报告发现的问题，逐项列出 severity、file、line_range、description 和 suggestion。
   - 如果 JSON 无效（`INVALID_JSON`）：提示 `External review returned invalid JSON`，附带 stderr，并继续。

   无论外部 review 结果如何，都继续进入下面的手动 review 选项。

---

**手动 review 选项：**

询问用户是否要触发 code review：


**文本模式（配置中 `workflow.text_mode: true` 或 `--text` flag）：** 如果 `$ARGUMENTS` 中有 `--text`，或 init JSON 中的 `text_mode` 为 `true`，则设置 `TEXT_MODE=true`。启用 TEXT_MODE 时，把每个 `AskUserQuestion` 调用替换为纯文本编号列表，并要求用户输入选项编号。这是非 Claude 运行时（OpenAI Codex、Gemini CLI 等）的必需方式，因为这些环境没有 `AskUserQuestion`。

```
AskUserQuestion:
  question: "PR created. Run a code review before merge?"
  options:
    - label: "Skip review"
      description: "PR is ready — merge when CI passes"
    - label: "Self-review"
      description: "I'll review the diff in the PR myself"
    - label: "Request review"
      description: "Request review from a teammate"
```

**如果选择 `"Request review"`：**
```bash
gh pr edit ${PR_NUMBER} --add-reviewer "${REVIEWER}"
```

**如果选择 `"Self-review"`：**
报告 PR URL，并建议：`Review the diff at {url}/files`
</step>

<step name="track_shipping">
更新 STATE.md，反映 ship 动作：

```bash
gsd-sdk query state.update "Last Activity" "$(date +%Y-%m-%d)"
gsd-sdk query state.update "Status" "Phase ${PHASE_NUMBER} shipped — PR #${PR_NUMBER}"
```

如果 `commit_docs` 为 true：
```bash
gsd-sdk query commit "docs(${padded_phase}): ship phase ${PHASE_NUMBER} — PR #${PR_NUMBER}" .planning/STATE.md
```
</step>

<step name="report">
```
───────────────────────────────────────────────────────────────

## ✓ Phase {X}: {Name} — Shipped

PR: #{number} ({url})
Branch: {branch} → ${BASE_BRANCH}
Commits: {count}
Verification: ✓ Passed
Requirements: {N} REQ-IDs addressed

下一步：
- Review/approve PR
- CI 通过后 merge
- /gsd-complete-milestone（如果这是 milestone 的最后一个 phase）
- /gsd-progress（查看下一步）

───────────────────────────────────────────────────────────────
```
</step>

</process>

<offer_next>
完成 shipping 后：

- /gsd-complete-milestone — 如果该 milestone 的所有 phases 都已完成
- /gsd-progress — 查看整体项目状态
- /gsd-execute-phase {next} — 继续下一个 phase
</offer_next>

<success_criteria>
- [ ] 已通过 preflight checks（verification、clean tree、branch、remote、gh）
- [ ] 已将 branch 推送到 remote
- [ ] 已用自动生成的完整 body 创建 PR
- [ ] 已更新 STATE.md 的 shipping 状态
- [ ] 用户已知晓 PR 编号和后续步骤
</success_criteria>
