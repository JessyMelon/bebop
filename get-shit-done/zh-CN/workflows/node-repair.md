<purpose>
针对失败任务验证的自治修复操作器。由 execute-plan 在任务未通过 done-criteria 时调用。在升级给用户前，先提出并尝试结构化修复。
</purpose>

<inputs>
- FAILED_TASK: 计划中的任务编号、名称和 done-criteria
- ERROR: verification 产生的内容——实际结果与预期结果的对比
- PLAN_CONTEXT: 相邻任务和 phase goal（用于感知约束）
- REPAIR_BUDGET: 剩余的最大修复尝试次数（默认：2）
</inputs>

<repair_directive>
分析失败原因，并且只选择一种修复策略：

**RETRY** — 方向是对的，但执行失败。做出明确调整后重试。
- Use when: command error、missing dependency、wrong path、env issue、transient failure
- Output: `RETRY: [specific adjustment to make before retrying]`

**DECOMPOSE** — 任务粒度过粗。拆成更小且可验证的子步骤。
- Use when: done-criteria 覆盖多个关注点，或实现缺口属于结构性问题
- Output: `DECOMPOSE: [sub-task 1] | [sub-task 2] | ...`（最多 3 个 sub-task）
- 每个 sub-task 都必须只有一个可验证结果

**PRUNE** — 在当前约束下任务不可行。给出理由后跳过。
- Use when: prerequisite 缺失且无法在此处修复、超出范围、与更早决策冲突
- Output: `PRUNE: [one-sentence justification]`

**ESCALATE** — 修复预算已耗尽，或这属于架构决策（Rule 4）。
- Use when: RETRY 用不同方法失败超过一次，或修复需要结构性变更
- Output: `ESCALATE: [what was tried] | [what decision is needed]`
</repair_directive>

<process>

<step name="diagnose">
仔细阅读错误信息和 done-criteria。问自己：
1. 这是暂时性/环境性问题吗？→ RETRY
2. 这个任务是否明显过宽且可验证地过于粗糙？→ DECOMPOSE
3. 是否确实缺少 prerequisite，且在当前范围内无法修复？→ PRUNE
4. 这个任务是否已经尝试过 RETRY？检查 REPAIR_BUDGET。如果为 0 → ESCALATE
</step>

<step name="execute_retry">
如果是 RETRY：
1. 应用 directive 中写明的具体调整
2. 重新运行任务实现
3. 重新运行 verification
4. 如果通过 → 正常继续，并记录 `[Node Repair - RETRY] Task [X]: [adjustment made]`
5. 如果再次失败 → 递减 REPAIR_BUDGET，并用更新后的上下文重新调用 node-repair
</step>

<step name="execute_decompose">
如果是 DECOMPOSE：
1. 以内联方式用 sub-task 替换失败任务（不要修改磁盘上的 PLAN.md）
2. 按顺序执行 sub-task，并分别进行 verification
3. 如果所有 sub-task 都通过 → 将原任务视为成功，并记录 `[Node Repair - DECOMPOSE] Task [X] → [N] sub-tasks`
4. 如果某个 sub-task 失败 → 针对该 sub-task 重新调用 node-repair（REPAIR_BUDGET 按每个 sub-task 计算）
</step>

<step name="execute_prune">
如果是 PRUNE：
1. 将任务标记为 skipped，并附上理由
2. 记录到 SUMMARY 的 "Issues Encountered"：`[Node Repair - PRUNE] Task [X]: [justification]`
3. 继续下一个任务
</step>

<step name="execute_escalate">
如果是 ESCALATE：
1. 通过 verification_failure_gate 将完整修复历史展示给用户
2. 提供：尝试过什么（每次 RETRY/DECOMPOSE 尝试）、阻塞点是什么、有哪些可选方案
3. 等待用户指示后再继续
</step>

</process>

<logging>
所有修复动作都必须出现在 SUMMARY.md 的 "## Deviations from Plan" 下：

| Type | Format |
|------|--------|
| RETRY success | `[Node Repair - RETRY] Task X: [adjustment] — resolved` |
| RETRY fail → ESCALATE | `[Node Repair - RETRY] Task X: [N] attempts exhausted — escalated to user` |
| DECOMPOSE | `[Node Repair - DECOMPOSE] Task X split into [N] sub-tasks — all passed` |
| PRUNE | `[Node Repair - PRUNE] Task X skipped: [justification]` |
</logging>

<constraints>
- 每个任务的 REPAIR_BUDGET 默认是 2。可通过 config.json `workflow.node_repair_budget` 配置。
- 绝不要修改磁盘上的 PLAN.md —— 分解后的 sub-task 只存在于内存中。
- DECOMPOSE 的 sub-task 必须比原任务更具体，不能只是同义改写。
- 如果 config.json `workflow.node_repair` 为 `false`，则直接跳过到 verification_failure_gate（用户保留原始行为）。
</constraints>
