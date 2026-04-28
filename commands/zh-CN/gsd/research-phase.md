---
name: gsd:research-phase
description: 研究如何实现某个 phase（独立命令，通常应改用 /gsd-plan-phase）
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Task
---

<objective>
研究如何实现某个 phase。会启动带有 phase 上下文的 gsd-phase-researcher agent。

**Note:** 这是一个独立研究命令。对于大多数 workflow，使用 `/gsd-plan-phase`，它会自动集成研究。

**Use this command when:**
- 你想先做研究，还不想开始规划
- 规划完成后，你想重新研究
- 你需要在决定某个 phase 是否可行之前先做调查

**Orchestrator role:** 解析 phase、对照 roadmap 校验、检查现有研究、收集上下文、启动 researcher agent，并展示结果。

**Why subagent:** 研究会很快消耗上下文（WebSearch、Context7 查询、源码核验）。给调查使用全新的 200k 上下文，主上下文则保持精简以便与用户交互。
</objective>

<available_agent_types>
有效的 GSD subagent type（使用精确名称，不要退回到 'general-purpose'）：
- gsd-phase-researcher — 研究某个 phase 的技术实现路径
</available_agent_types>

<context>
Phase number: $ARGUMENTS（必填）

在进行任何目录查找之前，于第 1 步规范化 phase 输入。
</context>

<process>

## 0. 初始化上下文

```bash
INIT=$(gsd-sdk query init.phase-op "$ARGUMENTS")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

从 init JSON 中提取：`phase_dir`、`phase_number`、`phase_name`、`phase_found`、`commit_docs`、`has_research`、`state_path`、`requirements_path`、`context_path`、`research_path`。

解析 researcher model：
```bash
RESEARCHER_MODEL=$(gsd-sdk query resolve-model gsd-phase-researcher --raw)
```

## 1. 校验 Phase

```bash
PHASE_INFO=$(gsd-sdk query roadmap.get-phase "${phase_number}")
```

**If `found` is false:** 报错并退出。**If `found` is true:** 从 JSON 中提取 `phase_number`、`phase_name`、`goal`。

## 2. 检查现有研究

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null
```

**If exists:** 提供选项：1) 更新研究，2) 查看已有研究，3) 跳过。等待回应。

**If doesn't exist:** 继续。

## 3. 收集 Phase 上下文

使用 INIT 中的路径（不要在 orchestrator 上下文中内联文件内容）：
- `requirements_path`
- `context_path`
- `state_path`

展示 phase 描述摘要，以及 researcher 将要读取的文件。

## 4. 启动 gsd-phase-researcher Agent

研究模式：ecosystem（默认）、feasibility、implementation、comparison。

```markdown
<research_type>
Phase Research — investigating HOW to implement a specific phase well.
</research_type>

<key_insight>
The question is NOT "which library should I use?"

The question is: "What do I not know that I don't know?"

For this phase, discover:
- What's the established architecture pattern?
- What libraries form the standard stack?
- What problems do people commonly hit?
- What's SOTA vs what Claude's training thinks is SOTA?
- What should NOT be hand-rolled?
</key_insight>

<objective>
Research implementation approach for Phase {phase_number}: {phase_name}
Mode: ecosystem
</objective>

<files_to_read>
- {requirements_path} (Requirements)
- {context_path} (Phase context from discuss-phase, if exists)
- {state_path} (Prior project decisions and blockers)
</files_to_read>

<additional_context>
**Phase description:** {phase_description}
</additional_context>

<downstream_consumer>
Your RESEARCH.md will be loaded by `/gsd-plan-phase` which uses specific sections:
- `## Standard Stack` → Plans use these libraries
- `## Architecture Patterns` → Task structure follows these
- `## Don't Hand-Roll` → Tasks NEVER build custom solutions for listed problems
- `## Common Pitfalls` → Verification steps check for these
- `## Code Examples` → Task actions reference these patterns

Be prescriptive, not exploratory. "Use X" not "Consider X or Y."
</downstream_consumer>

<quality_gate>
Before declaring complete, verify:
- [ ] All domains investigated (not just some)
- [ ] Negative claims verified with official docs
- [ ] Multiple sources for critical claims
- [ ] Confidence levels assigned honestly
- [ ] Section names match what plan-phase expects
</quality_gate>

<output>
Write to: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

## 5. 处理 Agent 返回

**`## RESEARCH COMPLETE`:** 显示摘要，并提供选项：规划 phase、继续深挖、查看全文、完成。

**`## CHECKPOINT REACHED`:** 展示给用户，获取回应，并启动续跑。

**`## RESEARCH INCONCLUSIVE`:** 展示已尝试内容，并提供选项：补充上下文、切换模式、手动处理。

## 6. 启动续跑 Agent

```markdown
<objective>
Continue research for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
<files_to_read>
- .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md (Existing research)
</files_to_read>
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}",
  description="Continue research Phase {phase}"
)
```

</process>

<success_criteria>
- [ ] 已对照 roadmap 校验 phase
- [ ] 已检查现有研究
- [ ] 已在带上下文的情况下启动 gsd-phase-researcher
- [ ] 已正确处理 checkpoints
- [ ] 用户清楚下一步可以做什么
</success_criteria>
