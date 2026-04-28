<purpose>
研究如何实现某个 phase。它会携带 phase 上下文启动 gsd-phase-researcher。

这是独立的研究命令。对大多数 workflow，使用会自动集成研究的 `/gsd-plan-phase`。
</purpose>

<available_agent_types>
有效的 GSD subagent 类型（使用精确名称，不要回退到 'general-purpose'）：
- gsd-phase-researcher — 研究某个 phase 的技术实现方案
</available_agent_types>

<process>

## Step 0: Resolve Model Profile

@~/.claude/get-shit-done/references/model-profile-resolution.md

为以下对象解析 model：
- `gsd-phase-researcher`

## Step 1: Normalize and Validate Phase

@~/.claude/get-shit-done/references/phase-argument-parsing.md

```bash
PHASE_INFO=$(gsd-sdk query roadmap.get-phase "${PHASE}")
```

如果 `found` 为 false：报错并退出。

## Step 2: Check Existing Research

```bash
ls .planning/phases/${PHASE}-*/RESEARCH.md 2>/dev/null || true
```

如果存在：提供 update/view/skip 选项。

## Step 3: Gather Phase Context

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# Extract: phase_dir, padded_phase, phase_number, state_path, requirements_path, context_path
AGENT_SKILLS_RESEARCHER=$(gsd-sdk query agent-skills gsd-researcher 2>/dev/null)
```

## Step 4: Spawn Researcher

```
Task(
  prompt="<objective>
研究 Phase {phase}: {name} 的实现方案
</objective>

<files_to_read>
- {context_path} (来自 /gsd-discuss-phase 的 USER DECISIONS)
- {requirements_path} (项目 requirements)
- {state_path} (项目决策与历史)
</files_to_read>

${AGENT_SKILLS_RESEARCHER}

<additional_context>
Phase 描述: {description}
</additional_context>

<output>
写入到: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}"
)
```

## Step 5: Handle Return

- `## RESEARCH COMPLETE` — 显示摘要，并提供：Plan/Dig deeper/Review/Done
- `## CHECKPOINT REACHED` — 呈现给用户，并启动 continuation
- `## RESEARCH INCONCLUSIVE` — 显示尝试过程，并提供：Add context/Try different mode/Manual

</process>
