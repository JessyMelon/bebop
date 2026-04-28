<purpose>
从已完成 phase 的工件中提取决策、经验教训、发现的模式以及遇到的意外，并写入结构化的 LEARNINGS.md 文件。把原本会在 phase 之间流失的机构性知识沉淀下来。
</purpose>

<required_reading>
开始前，读取 invoking prompt 的 execution_context 中引用的所有文件。
</required_reading>

<objective>
分析已完成 phase 的工件（PLAN.md、SUMMARY.md、VERIFICATION.md、UAT.md、STATE.md），并按 4 个类别提取结构化学习：decisions、lessons、patterns 和 surprises。每个提取项都包含来源归属。输出为一个 LEARNINGS.md 文件，并带有 YAML frontmatter，记录本次提取的元数据。
</objective>

<process>

<step name="initialize">
解析参数并加载项目状态：

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE_ARG}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 解析：`phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`。

如果 phase 未找到，则报错退出："Phase {PHASE_ARG} not found."。
</step>

<step name="collect_artifacts">
读取该 phase 的工件。PLAN.md 和 SUMMARY.md 为必需；VERIFICATION.md、UAT.md、STATE.md 为可选。

**必需工件：**
- `${PHASE_DIR}/*-PLAN.md` — 该 phase 的所有 plan 文件
- `${PHASE_DIR}/*-SUMMARY.md` — 该 phase 的所有 summary 文件

如果找不到或缺失 PLAN.md 或 SUMMARY.md，则报错退出："Required artifacts missing. PLAN.md and SUMMARY.md are required for learning extraction."。

**可选工件（如果有就读取，没有就跳过）：**
- `${PHASE_DIR}/*-VERIFICATION.md` — 验证结果
- `${PHASE_DIR}/*-UAT.md` — 用户验收测试结果
- `.planning/STATE.md` — 记录决策与阻塞项的项目状态

跟踪哪些可选工件缺失，并写入 frontmatter 的 `missing_artifacts` 字段。
</step>

<step name="extract_learnings">
分析所有收集到的工件，并按 4 个类别提取学习：

### 1. Decisions
该 phase 中做出的技术和架构决策。重点查找：
- 记录在 PLAN.md 或 SUMMARY.md 中的明确决策
- 技术选型及其理由
- 已评估的 trade-off
- 记录在 STATE.md 中的设计决策

每条 decision 必须包含：
- **What** 做了什么决策
- **Why** 为什么这么决定（rationale）
- **Source:** 决策来源工件的归属（例如 "Source: 03-01-PLAN.md"）

### 2. Lessons
执行过程中学到、事先并不知道的内容。重点查找：
- SUMMARY.md 中暴露的意外复杂度
- VERIFICATION.md 中发现的问题
- SUMMARY.md 中记录的失败尝试
- 暴露缺口的 UAT 反馈

每条 lesson 必须包含：
- **What** 学到了什么
- **Context** 这条经验的上下文
- **Source:** 来源工件归属

### 3. Patterns
发现的可复用模式、方法或技巧。重点查找：
- SUMMARY.md 中成功的实现模式
- VERIFICATION.md 或 UAT.md 中的测试模式
- 效果良好的工作流模式
- PLAN.md 中的代码组织模式

每条 pattern 必须包含：
- **Pattern** 模式名称/描述
- **When to use** 适用场景
- **Source:** 来源工件归属

### 4. Surprises
意料之外的发现、行为或结果。重点查找：
- 比预估更久或更快的事项
- 意外的依赖或交互
- 规划时未预料到的 edge case
- 与预期不一致的性能或行为

每条 surprise 必须包含：
- **What** 意外之处是什么
- **Impact** 该意外带来的影响
- **Source:** 来源工件归属
</step>

<step name="capture_thought_integration">
**这一节是什么：** `capture_thought` 是一种**可选约定**，不是内置的 GSD tool。GSD 不自带它，也不要求必须有它。这里预留给那些运行 memory / knowledge-base MCP server 的用户（例如 ExoCortex 风格 server、`claude-mem` 或 `mem0` 风格 server），前提是该 server 暴露了一个同名 tool。如果当前 session 中有任何 MCP server 提供了符合下述签名的 `capture_thought` tool，就将每一条提取出的 learning 连同元数据发送给它。如果没有这个 tool，则静默跳过，不做任何事；`LEARNINGS.md` 始终是主要输出。

**检测方式：** 检查当前 session 是否有名为 `capture_thought` 的 tool。不要假设一定连接了某个 MCP server。

**如果可用**，每条提取的 learning 调用一次：

```
capture_thought({
  category: "decision" | "lesson" | "pattern" | "surprise",
  phase: PHASE_NUMBER,
  content: LEARNING_TEXT,
  source: ARTIFACT_NAME
})
```

**如果不可用**（当前 session 中没有任何 MCP server 暴露该 tool，或 runtime 不支持它），则静默跳过并继续。工作流不得失败，也不应警告，这对未运行 knowledge-base MCP 的用户来说是预期行为。
</step>

<step name="write_learnings">
将 LEARNINGS.md 写入 phase 目录。如果之前已存在 LEARNINGS.md，则直接覆盖（整文件替换）。

输出路径：`${PHASE_DIR}/${PADDED_PHASE}-LEARNINGS.md`

文件必须包含以下字段的 YAML frontmatter：
```yaml
---
phase: {PHASE_NUMBER}
phase_name: "{PHASE_NAME}"
project: "{PROJECT_NAME}"
generated: "{ISO_DATE}"
counts:
  decisions: {N}
  lessons: {N}
  patterns: {N}
  surprises: {N}
missing_artifacts:
  - "{ARTIFACT_NAME}"
---
```

单条条目可以带一个可选的 `graduated:` 注释（由 `graduation.md` 在某个 cluster 被提升时添加）：
```markdown
**Graduated:** {target-file}:{ISO_DATE}
```
这个注释会追加在该条目现有字段之后，用来防止它在未来的 graduation scan 中被再次浮现。提取阶段不要添加此字段，它只应由 graduation workflow 写入。

正文结构如下：
```markdown
# Phase {PHASE_NUMBER} Learnings: {PHASE_NAME}

## Decisions

### {Decision Title}
{What was decided}

**Rationale:** {Why}
**Source:** {artifact file}

---

## Lessons

### {Lesson Title}
{What was learned}

**Context:** {context}
**Source:** {artifact file}

---

## Patterns

### {Pattern Name}
{Description}

**When to use:** {applicability}
**Source:** {artifact file}

---

## Surprises

### {Surprise Title}
{What was surprising}

**Impact:** {impact description}
**Source:** {artifact file}
```
</step>

<step name="update_state">
更新 STATE.md，记录本次 learning extraction：

```bash
gsd-sdk query state.update "Last Activity" "$(date +%Y-%m-%d)"
```
</step>

<step name="report">
```
---------------------------------------------------------------

## Learnings Extracted: Phase {X} — {Name}

Decisions:  {N}
Lessons:    {N}
Patterns:   {N}
Surprises:  {N}
Total:      {N}

Output: {PHASE_DIR}/{PADDED_PHASE}-LEARNINGS.md

Missing artifacts: {list or "none"}

Next steps:
- Review extracted learnings for accuracy
- /gsd-progress — see overall project state
- /gsd-execute-phase {next} — continue to next phase

---------------------------------------------------------------
```
</step>

</process>

<success_criteria>
- [ ] 已成功定位并读取 phase 工件
- [ ] 已提取全部 4 个类别：decisions、lessons、patterns、surprises
- [ ] 每条提取项都带有来源归属
- [ ] LEARNINGS.md 已按正确的 YAML frontmatter 写出
- [ ] frontmatter 中已记录缺失的可选工件
- [ ] 如果 tool 可用，已尝试进行 capture_thought 集成
- [ ] 已更新 STATE.md 记录提取活动
- [ ] 用户已收到摘要报告
</success_criteria>

<critical_rules>
- PLAN.md 和 SUMMARY.md 是必需的；若缺失，必须以清晰错误退出
- VERIFICATION.md、UAT.md 和 STATE.md 是可选的；存在则提取，不存在则平滑跳过
- 每条提取出的 learning 都必须能追溯到来源工件
- 对同一 phase 运行两次 extract-learnings 时，必须覆盖（replace）之前的 LEARNINGS.md，而不是追加
- 不要编造 learnings；只提取工件中明确记录的内容
- 如果 capture_thought 不可用，工作流不得失败；要平滑降级为仅文件输出
- LEARNINGS.md 的 frontmatter 必须包含 4 个类别的计数，并列出所有 missing_artifacts
</critical_rules>
