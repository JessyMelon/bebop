# Gates Taxonomy

GSD workflows 中使用的规范 gate 类型。每个验证检查点都映射到以下四类之一。

---

## Gate Types

### Pre-flight Gate
**Purpose:** 在操作开始前验证前置条件。
**Behavior:** 如果条件不满足则阻止进入。不会产生部分工作结果。
**Recovery:** 修复缺失的前置条件后再重试。
**Examples:**
- plan-phase 在规划前检查 REQUIREMENTS.md
- execute-phase 在执行前验证 PLAN.md 是否存在
- discuss-phase 确认 phase 在 ROADMAP.md 中存在

### Revision Gate
**Purpose:** 评估输出质量；如果不足，则路由回修订。
**Behavior:** 带着具体反馈回到生产者，受迭代次数上限约束。
**Recovery:** 生产者处理反馈；checker 重新评估。如果相邻两轮迭代之间问题数量没有减少，循环也会提前升级（stall detection）。达到最大迭代次数后，无条件升级。
**Examples:**
- plan-checker 审查 PLAN.md（最多 3 次迭代）
- verifier 按 success criteria 检查 phase 交付物

### Escalation Gate
**Purpose:** 将无法自动解决的问题暴露给开发者做决策。
**Behavior:** 暂停工作流，展示选项，等待人工输入。
**Recovery:** 开发者选择动作；工作流沿所选路径恢复。
**Examples:**
- 修订循环 3 次后仍未通过
- worktree cleanup 期间出现 merge conflict
- 需要澄清的模糊需求

### Abort Gate
**Purpose:** 终止操作，以防止损害或浪费。
**Behavior:** 立即停止，保留状态，并报告原因。
**Recovery:** 开发者调查根因、修复后，再从 checkpoint 重启。
**Examples:**
- 执行过程中 context window 严重不足
- STATE.md 进入错误状态，阻塞 `/gsd-next`
- 验证发现关键交付物缺失

---

## Gate Matrix

| Workflow | Phase | Gate Type | Artifacts Checked | Failure Behavior |
|----------|-------|-----------|-------------------|------------------|
| plan-phase | Entry | Pre-flight | REQUIREMENTS.md, ROADMAP.md | 用缺失文件消息阻塞 |
| plan-phase | Step 12 | Revision | PLAN.md 质量 | 回到 planner（最多 3 次） |
| plan-phase | Post-revision | Escalation | 未解决问题 | 暴露给开发者 |
| execute-phase | Entry | Pre-flight | PLAN.md | 用缺失计划消息阻塞 |
| execute-phase | Completion | Revision | SUMMARY.md 完整性 | 重跑未完成任务 |
| verify-work | Entry | Pre-flight | SUMMARY.md | 用缺失 summary 阻塞 |
| verify-work | Evaluation | Escalation | 失败标准 | 向开发者展示 gaps |
| next | Entry | Abort | 错误状态、checkpoints | 带诊断信息停止 |

---

## Implementing Gates

在设计或审查工作流验证点时，使用这个分类法：

- **Pre-flight** gates 应放在工作流入口。它们是廉价且确定性的检查，用于避免浪费工作。如果你能用文件存在性检查或 config 读取验证某个前置条件，就用 pre-flight gate。
- **Revision** gates 应放在生产者步骤之后，因为那里的输出质量可能有差异。始终给它配一个迭代上限，避免无限循环。上限应反映每轮迭代成本 —— 操作越昂贵，重试次数越少。
- **Escalation** gates 应放在自动化无法解决或存在歧义的地方。它是 revision loops 与 abort 之间的安全阀。要向开发者提供清晰选项和足够上下文，让他们能做决定。
- **Abort** gates 应放在继续执行会造成损害、浪费大量资源或产生无意义输出的位置。它们应保留状态，以便根因修复后恢复工作。

**Selection heuristic:** 从 pre-flight 开始。如果检查发生在工作产出之后，它就是 revision gate。如果 revision loop 也无法解决问题，就升级。如果继续执行有风险，就中止。
