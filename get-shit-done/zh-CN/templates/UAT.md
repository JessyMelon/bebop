# UAT 模板

用于 `.planning/phases/XX-name/{phase_num}-UAT.md` 的模板 —— 持久化 UAT 会话跟踪。

---

## 文件模板

```markdown
---
status: testing | partial | complete | diagnosed
phase: XX-name
source: [list of SUMMARY.md files tested]
started: [ISO timestamp]
updated: [ISO timestamp]
---

## Current Test
<!-- 每次测试都整体覆盖 - 显示当前进行到哪里 -->

number: [N]
name: [test name]
expected: |
  [用户应该观察到什么]
awaiting: user response

## Tests

### 1. [Test Name]
expected: [可观察行为 - 用户应看到什么]
result: [pending]

### 2. [Test Name]
expected: [可观察行为]
result: pass

### 3. [Test Name]
expected: [可观察行为]
result: issue
reported: "[verbatim user response]"
severity: major

### 4. [Test Name]
expected: [可观察行为]
result: skipped
reason: [跳过原因]

### 5. [Test Name]
expected: [可观察行为]
result: blocked
blocked_by: server | physical-device | release-build | third-party | prior-phase
reason: [阻塞原因]

...

## Summary

total: [N]
passed: [N]
issues: [N]
pending: [N]
skipped: [N]
blocked: [N]

## Gaps

<!-- 供 plan-phase --gaps 消费的 YAML 格式 -->
- truth: "[测试中的预期行为]"
  status: failed
  reason: "User reported: [verbatim response]"
  severity: blocker | major | minor | cosmetic
  test: [N]
  root_cause: ""     # 由 diagnosis 填充
  artifacts: []      # 由 diagnosis 填充
  missing: []        # 由 diagnosis 填充
  debug_session: ""  # 由 diagnosis 填充
```

---

<section_rules>

**Frontmatter:**
- `status`: 覆盖写入 - "testing"、"partial" 或 "complete"
- `phase`: 不可变 - 创建时设置
- `source`: 不可变 - 被测试的 SUMMARY 文件
- `started`: 不可变 - 创建时设置
- `updated`: 覆盖写入 - 每次变更都更新

**Current Test:**
- 每次测试切换时整体覆盖
- 显示当前激活的是哪个测试、在等待什么
- 完成时："[testing complete]"

**Tests:**
- 每个测试：用户响应后覆盖 `result` 字段
- `result` 取值： [pending]、pass、issue、skipped、blocked
- 若为 issue：添加 `reported`（原话）和 `severity`（推断）
- 若为 skipped：如有说明则添加 `reason`
- 若为 blocked：添加 `blocked_by`（标签）和 `reason`（如有）

**Summary:**
- 每次响应后覆盖计数
- 跟踪：total、passed、issues、pending、skipped

**Gaps:**
- 仅在发现 issue 时追加（YAML 格式）
- diagnosis 后填充 `root_cause`、`artifacts`、`missing`、`debug_session`
- 此区块会直接输入 /gsd-plan-phase --gaps

</section_rules>

<diagnosis_lifecycle>

**测试完成后（status: complete），如果存在 gaps：**

1. 用户运行 diagnosis（来自 verify-work 提示或手动执行）
2. diagnose-issues workflow 启动并行 debug agents
3. 每个 agent 调查一个 gap，并返回 root cause
4. 用诊断结果更新 UAT.md 的 Gaps 区块：
   - 为每个 gap 填入 `root_cause`、`artifacts`、`missing`、`debug_session`
5. status → "diagnosed"
6. 准备执行带 root cause 的 /gsd-plan-phase --gaps

**诊断后：**
```yaml
## Gaps

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
  debug_session: ".planning/debug/comment-not-refreshing.md"
```

</diagnosis_lifecycle>

<lifecycle>

**创建：** 当 /gsd-verify-work 启动新会话时
- 从 SUMMARY.md 文件中提取测试
- 将 status 设为 "testing"
- Current Test 指向测试 1
- 所有测试都设置 `result: [pending]`

**测试过程中：**
- 展示 Current Test 区块中的测试
- 用户回复通过确认或问题描述
- 更新测试结果（pass/issue/skipped）
- 更新 Summary 计数
- 若为 issue：追加到 Gaps 区块（YAML 格式），并推断 severity
- 将 Current Test 移到下一个 pending 测试

**完成时：**
- status → "complete"
- Current Test → "[testing complete]"
- 提交文件
- 展示摘要和后续步骤

**部分完成：**
- status → "partial"（如果仍有 pending、blocked 或未解决的 skipped 测试）
- Current Test → "[testing paused — {N} items outstanding]"
- 提交文件
- 展示摘要，并突出尚未完成的项

**恢复部分完成的会话：**
- `/gsd-verify-work {phase}` 从第一个 pending/blocked 测试继续
- 全部项解决后，status 变为 "complete"

**在 /clear 后恢复：**
1. 读取 frontmatter → 知道当前 phase 和 status
2. 读取 Current Test → 知道当前进度
3. 找到第一个 [pending] result → 从那里继续
4. Summary 展示当前累计进度

</lifecycle>

<severity_guide>

Severity 从用户自然语言中推断，不会主动询问。

| User describes | Infer |
|----------------|-------|
| Crash, error, exception, fails completely, unusable | blocker |
| Doesn't work, nothing happens, wrong behavior, missing | major |
| Works but..., slow, weird, minor, small issue | minor |
| Color, font, spacing, alignment, visual, looks off | cosmetic |

默认值：**major**（稳妥默认，用户如果觉得不对可以澄清）

</severity_guide>

<good_example>
```markdown
---
status: diagnosed
phase: 04-comments
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md
started: 2025-01-15T10:30:00Z
updated: 2025-01-15T10:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. View Comments on Post
expected: Comments section expands, shows count and comment list
result: pass

### 2. Create Top-Level Comment
expected: Submit comment via rich text editor, appears in list with author info
result: issue
reported: "works but doesn't show until I refresh the page"
severity: major

### 3. Reply to a Comment
expected: Click Reply, inline composer appears, submit shows nested reply
result: pass

### 4. Visual Nesting
expected: 3+ level thread shows indentation, left borders, caps at reasonable depth
result: pass

### 5. Delete Own Comment
expected: Click delete on own comment, removed or shows [deleted] if has replies
result: pass

### 6. Comment Count
expected: Post shows accurate count, increments when adding comment
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Comment appears immediately after submission in list"
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
  debug_session: ".planning/debug/comment-not-refreshing.md"
```
</good_example>
