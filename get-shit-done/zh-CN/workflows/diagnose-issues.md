<purpose>
编排并行 debug agents 调查 UAT 缺口并找出根因。

在 UAT 发现缺口后，为每个缺口启动一个 debug agent。每个 agent 使用 UAT 预填的症状自主调查。收集根因，用诊断结果更新 UAT.md 中的缺口，然后交给 plan-phase --gaps 基于真实诊断进行处理。

编排器保持精简：解析缺口、启动 agents、收集结果、更新 UAT。
</purpose>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-debugger — 诊断并修复问题
</available_agent_types>

<paths>
DEBUG_DIR=.planning/debug

调试文件使用 `.planning/debug/` 路径（带前导点的隐藏目录）。
</paths>

<core_principle>
**先诊断，再规划修复。**

UAT 告诉我们哪里坏了（症状）。Debug agents 找出为什么坏了（根因）。然后由 plan-phase --gaps 基于真实原因制定有针对性的修复，而不是猜测。

没有诊断时："Comment doesn't refresh" → 猜一个修复方案 → 可能不对
有诊断时："Comment doesn't refresh" → "useEffect missing dependency" → 精准修复
</core_principle>

<process>

<step name="parse_gaps">
**从 UAT.md 中提取缺口：**

读取 "Gaps" section（YAML 格式）：
```yaml
- truth: "Comment appears immediately after submission"
  status: failed
  reason: "User reported: works but doesn't show until I refresh the page"
  severity: major
  test: 2
  artifacts: []
  missing: []
```

对每个缺口，还要读取 "Tests" section 中对应的测试以获取完整上下文。

构建缺口列表：
```
gaps = [
  {truth: "Comment appears immediately...", severity: "major", test_num: 2, reason: "..."},
  {truth: "Reply button positioned correctly...", severity: "minor", test_num: 5, reason: "..."},
  ...
]
```
</step>

<step name="report_plan">
**读取 worktree config：**

```bash
USE_WORKTREES=$(gsd-sdk query config-get workflow.use_worktrees 2>/dev/null || echo "true")
```

**向用户报告诊断计划：**

```
## Diagnosing {N} Gaps

Spawning parallel debug agents to investigate root causes:

| Gap (Truth) | Severity |
|-------------|----------|
| Comment appears immediately after submission | major |
| Reply button positioned correctly | minor |
| Delete removes comment | blocker |

Each agent will:
1. Create DEBUG-{slug}.md with symptoms pre-filled
2. Investigate autonomously (read code, form hypotheses, test)
3. Return root cause

This runs in parallel - all gaps investigated simultaneously.
```
</step>

<step name="spawn_agents">
**加载 agent skills：**

```bash
AGENT_SKILLS_DEBUGGER=$(gsd-sdk query agent-skills gsd-debugger 2>/dev/null)
EXPECTED_BASE=$(git rev-parse HEAD)
```

**并行启动 debug agents：**

对于每个缺口，填充 debug-subagent-prompt 模板并启动：

```
Task(
  prompt=filled_debug_subagent_prompt + "\n\n<worktree_branch_check>\nFIRST ACTION: run git merge-base HEAD {EXPECTED_BASE} — if result differs from {EXPECTED_BASE}, run git reset --hard {EXPECTED_BASE} to correct the branch base (safe — runs before any agent work). Then verify: if [ \"$(git rev-parse HEAD)\" != \"{EXPECTED_BASE}\" ]; then echo \"ERROR: Could not correct worktree base\"; exit 1; fi. Fixes EnterWorktree creating branches from main on all platforms.\n</worktree_branch_check>\n\n<files_to_read>\n- {phase_dir}/{phase_num}-UAT.md\n- .planning/STATE.md\n</files_to_read>\n${AGENT_SKILLS_DEBUGGER}",
  subagent_type="gsd-debugger",
  ${USE_WORKTREES !== "false" ? 'isolation="worktree",' : ''}
  description="Debug: {truth_short}"
)
```

**所有 agents 在单条消息中启动**（并行执行）。

模板占位符：
- `{truth}`: 失败的预期行为
- `{expected}`: 来自 UAT 测试
- `{actual}`: reason field 中的原始用户描述
- `{errors}`: UAT 中的任何错误信息（或 "None reported"）
- `{reproduction}`: "Test {test_num} in UAT"
- `{timeline}`: "Discovered during UAT"
- `{goal}`: `find_root_cause_only`（UAT 流程中由 plan-phase --gaps 处理修复）
- `{slug}`: 从 truth 生成
</step>

<step name="collect_results">
**从 agents 收集根因：**

每个 agent 返回内容如下：
```
## ROOT CAUSE FOUND

**Debug Session:** ${DEBUG_DIR}/{slug}.md

**Root Cause:** {specific cause with evidence}

**Evidence Summary:**
- {key finding 1}
- {key finding 2}
- {key finding 3}

**Files Involved:**
- {file1}: {what's wrong}
- {file2}: {related issue}

**Suggested Fix Direction:** {brief hint for plan-phase --gaps}
```

解析每个返回，提取：
- root_cause: 诊断出的原因
- files: 涉及的文件
- debug_path: 调试 session 文件路径
- suggested_fix: 缺口修复计划的提示

如果 agent 返回 `## INVESTIGATION INCONCLUSIVE`：
- root_cause: "Investigation inconclusive - manual review needed"
- 记录哪个问题需要人工关注
- 包含 agent 返回中的剩余可能性
</step>

<step name="update_uat">
**用诊断结果更新 UAT.md 中的缺口：**

对 Gaps section 中的每个缺口，添加 artifacts 和 missing 字段：

```yaml
- truth: "Comment appears immediately after submission"
  status: failed
  reason: "User reported: works but doesn't show until I refresh the page"
  severity: major
  test: 2
  root_cause: "useEffect in CommentList.tsx missing commentCount dependency"
  artifacts:
    - path: "src/components/CommentList.tsx"
      issue: "useEffect missing dependency"
  missing:
    - "Add commentCount to useEffect dependency array"
    - "Trigger re-render when new comment added"
  debug_session: .planning/debug/comment-not-refreshing.md
```

将 frontmatter 中的 status 更新为 "diagnosed"。

提交更新后的 UAT.md：
```bash
gsd-sdk query commit "docs({phase_num}): add root causes from diagnosis" ".planning/phases/XX-name/{phase_num}-UAT.md"
```
</step>

<step name="report_results">
**报告诊断结果并交接：**

显示：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DIAGNOSIS COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Gap (Truth) | Root Cause | Files |
|-------------|------------|-------|
| Comment appears immediately | useEffect missing dependency | CommentList.tsx |
| Reply button positioned correctly | CSS flex order incorrect | ReplyButton.tsx |
| Delete removes comment | API missing auth header | api/comments.ts |

Debug sessions: ${DEBUG_DIR}/

Proceeding to plan fixes...
```

返回 verify-work orchestrator 进行自动规划。
不要提供手动下一步建议，后续由 verify-work 处理。
</step>

</process>

<context_efficiency>
Agents 以 UAT 预填的症状启动（无需再收集症状）。
Agents 只做诊断，修复由 plan-phase --gaps 处理（不直接应用修复）。
</context_efficiency>

<failure_handling>
**Agent 未找到根因：**
- 将缺口标记为 "needs manual review"
- 继续处理其他缺口
- 报告诊断不完整

**Agent 超时：**
- 查看 DEBUG-{slug}.md 中的部分进展
- 可使用 /gsd-debug 恢复

**所有 agents 都失败：**
- 说明存在系统性问题（权限、git 等）
- 报告需要人工调查
- 回退为在没有根因的情况下使用 plan-phase --gaps（精度较低）
</failure_handling>

<success_criteria>
- [ ] 已从 UAT.md 解析缺口
- [ ] 已并行启动 debug agents
- [ ] 已从所有 agents 收集根因
- [ ] 已用 artifacts 和 missing 更新 UAT.md 中的缺口
- [ ] 调试 sessions 已保存到 ${DEBUG_DIR}/
- [ ] 已交给 verify-work 进行自动规划
</success_criteria>
