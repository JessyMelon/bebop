<purpose>
在规划 phase 前，把 Claude 对该 phase 的假设显式展示出来，让用户能尽早纠正误解。

与 discuss-phase 的关键区别：这里分析的是 Claude 的理解，而不是采集用户已知信息。不输出文件，仅用于对话，促发讨论。
</purpose>

<process>

<step name="validate_phase" priority="first">
Phase 编号：$ARGUMENTS（必填）

**如果缺少参数：**

```
Error: Phase number required.

Usage: /gsd-list-phase-assumptions [phase-number]
Example: /gsd-list-phase-assumptions 3
```

退出 workflow。

**如果提供了参数：**
验证该 phase 在 roadmap 中存在：

```bash
cat .planning/ROADMAP.md | grep -i "Phase ${PHASE}"
```

**如果未找到 phase：**

```
Error: Phase ${PHASE} not found in roadmap.

Available phases:
[list phases from roadmap]
```

退出 workflow。

**如果找到了 phase：**
从 roadmap 解析 phase 详情：

- Phase 编号
- Phase 名称
- Phase 描述/目标
- 提到的任何范围细节

继续进入 analyze_phase。
</step>

<step name="analyze_phase">
基于 roadmap 描述和项目上下文，从五个方面识别假设：

**1. Technical Approach:**
Claude 会使用哪些库、框架、模式或工具？
- "I'd use X library because..."
- "I'd follow Y pattern because..."
- "I'd structure this as Z because..."

**2. Implementation Order:**
Claude 会先做什么、后做什么？
- "I'd start with X because it's foundational"
- "Then Y because it depends on X"
- "Finally Z because..."

**3. Scope Boundaries:**
在 Claude 的理解里，哪些内容包含在内，哪些不包含？
- "This phase includes: A, B, C"
- "This phase does NOT include: D, E, F"
- "Boundary ambiguities: G could go either way"

**4. Risk Areas:**
Claude 预计哪里会有复杂度或挑战？
- "The tricky part is X because..."
- "Potential issues: Y, Z"
- "I'd watch out for..."

**5. Dependencies:**
Claude 假设哪些内容已经存在，或需要先准备好？
- "This assumes X from previous phases"
- "External dependencies: Y, Z"
- "This will be consumed by..."

如实表达不确定性。为假设标记置信度：
- "Fairly confident: ..."（从 roadmap 中可以清楚看出）
- "Assuming: ..."（合理推断）
- "Unclear: ..."（可能有多种解释）
</step>

<step name="present_assumptions">
以清晰、易扫读的格式展示假设：

```
## My Assumptions for Phase ${PHASE}: ${PHASE_NAME}

### Technical Approach
[List assumptions about how to implement]

### Implementation Order
[List assumptions about sequencing]

### Scope Boundaries
**In scope:** [what's included]
**Out of scope:** [what's excluded]
**Ambiguous:** [what could go either way]

### Risk Areas
[List anticipated challenges]

### Dependencies
**From prior phases:** [what's needed]
**External:** [third-party needs]
**Feeds into:** [what future phases need from this]

---

**What do you think?**

Are these assumptions accurate? Let me know:
- What I got right
- What I got wrong
- What I'm missing
```

等待用户回复。
</step>

<step name="gather_feedback">
**如果用户给出纠正：**

确认这些纠正：

```
Key corrections:
- [correction 1]
- [correction 2]

This changes my understanding significantly. [Summarize new understanding]
```

**如果用户确认这些假设：**

```
Assumptions validated.
```

继续进入 offer_next。
</step>

<step name="offer_next">
给出下一步：

```
What's next?
1. Discuss context (/gsd-discuss-phase ${PHASE}) - Let me ask you questions to build comprehensive context
2. Plan this phase (/gsd-plan-phase ${PHASE}) - Create detailed execution plans
3. Re-examine assumptions - I'll analyze again with your corrections
4. Done for now
```

等待用户选择。

如果是 "Discuss context"：说明 CONTEXT.md 会纳入这里讨论出的更正
如果是 "Plan this phase"：在假设已明确的前提下继续
如果是 "Re-examine"：带着更新后的理解返回 analyze_phase
</step>

</process>

<success_criteria>
- 已根据 roadmap 验证 phase 编号
- 已从五个方面显式展示假设：技术方案、实现顺序、范围、风险、依赖
- 已在适当处标记置信度
- 已展示 "What do you think?" 提示
- 已确认用户反馈
- 已提供清晰的下一步
</success_criteria>
