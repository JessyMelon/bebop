# Context Budget Rules

用于保持 orchestrator 上下文精简的标准规则。在会启动 subagents 或读取大量内容的工作流中引用它。

另见：`references/universal-anti-patterns.md`，其中包含完整的通用规则集。

---

## Universal Rules

所有会启动 agents 或读取大量内容的工作流都必须遵循这些规则：

1. **Never** 读取 agent 定义文件（`agents/*.md`）—— `subagent_type` 会自动加载它们
2. **Never** 把大文件内联进 subagent prompts —— 应告诉 agents 自己从磁盘读取文件
3. **Read depth scales with context window** —— 检查 `.planning/config.json` 中的 `context_window`：
   - 小于 500000 tokens（默认 200k）时：只读 frontmatter、status fields 或 summaries。不要读取完整的 SUMMARY.md、VERIFICATION.md 或 RESEARCH.md 正文。
   - 大于等于 500000 tokens（1M model）时：在需要内联展示或做决策时，**可以** 读取完整的 subagent output 正文。但仍应避免不必要的读取。
4. **Delegate** 重工作给 subagents —— orchestrator 负责路由，不负责执行
5. **Proactive warning**：如果你已经消耗了大量上下文（大文件读取、多份 subagent 结果），提醒用户：`Context budget is getting heavy. Consider checkpointing progress.`

## Read Depth by Context Window

| Context Window | Subagent Output Reading | SUMMARY.md | VERIFICATION.md | PLAN.md (other phases) |
|---------------|------------------------|------------|-----------------|------------------------|
| < 500k (200k model) | 仅 frontmatter | 仅 frontmatter | 仅 frontmatter | 仅当前 phase |
| >= 500k (1M model) | 允许完整正文 | 允许完整正文 | 允许完整正文 | 仅当前 phase |

**How to check:** 读取 `.planning/config.json` 并检查 `context_window`。如果该字段缺失，则按 200k 处理（保守默认）。

## Context Degradation Tiers

监控上下文使用量，并相应调整行为：

| Tier | Usage | Behavior |
|------|-------|----------|
| PEAK | 0-30% | 完整操作。读取正文、启动多个 agents、内联结果。 |
| GOOD | 30-50% | 正常操作。优先读取 frontmatter，积极委派。 |
| DEGRADING | 50-70% | 节省使用。只读 frontmatter、最少内联、提醒用户预算正在变重。 |
| POOR | 70%+ | 紧急模式。立即 checkpoint 进度。除非关键，否则不再新增读取。 |

## Context Degradation Warning Signs

质量会在触发恐慌阈值前逐步下降。注意这些早期信号：

- **Silent partial completion** —— agent 声称任务完成，但实现并不完整。Self-check 能捕获文件存在与否，却捕获不了语义完整性。务必验证 agent 输出是否满足计划中的 must_haves，而不是只看文件是否存在。
- **Increasing vagueness** —— agent 开始使用 “appropriate handling” 或 “standard patterns” 之类表述，而不是具体代码。这说明即使预算告警尚未触发，也已承受上下文压力。
- **Skipped steps** —— agent 略过了平时会执行的协议步骤。如果某个 agent 的 success criteria 有 8 项，但它只汇报了 5 项，要怀疑上下文压力。

当把工作委派给 agents 时，orchestrator 无法验证 agent 输出的语义正确性 —— 只能验证结构完整性。这是根本限制。可通过 must_haves.truths 和抽查验证来缓解。
