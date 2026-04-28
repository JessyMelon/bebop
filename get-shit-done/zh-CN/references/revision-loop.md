# 修订循环模式

带反馈的迭代式 agent 修订标准模式。用于 checker/validator 发现问题，而生成输出的 agent 需要修订其结果时。

---

## 模式：检查-修订-升级（最多 3 轮）

此模式适用于以下情况：
1. 某个 agent 产出结果（计划、imports、gap-closure plans）
2. 某个 checker/validator 评估该结果
3. 发现了需要修订的问题

### 流程

```
prev_issue_count = Infinity
iteration = 0

循环:
  1. 在当前输出上运行 checker/validator
  2. 读取 checker 结果
  3. 如果 PASSED 或只有 INFO-level 问题：
     -> 接受输出，退出循环
  4. 如果发现 BLOCKER 或 WARNING 问题：
     a. iteration += 1
     b. 如果 iteration > 3:
        -> 升级给用户（见下方“3 轮之后”）
     c. 从 checker 输出中解析问题数量
     d. 如果 issue_count >= prev_issue_count:
        -> 升级给用户："Revision loop stalled (issue count not decreasing)"
     e. prev_issue_count = issue_count
     f. 重新启动生成该输出的 agent，并附加 checker 反馈
     g. 修订完成后，回到循环
```

### 问题计数跟踪

跟踪 checker 在每一轮返回的 BLOCKER + WARNING 问题总数。如果相邻两轮之间数量没有下降，说明生成输出的 agent 卡住了，继续迭代也无助于解决。应提前中断并升级给用户。

在每次重新触发修订前显示迭代进度：
`修订轮次 {N}/3 -- {blocker_count} 个 blocker，{warning_count} 个 warning`

### 重新触发时的提示结构

重新触发生成输出的 agent 进行修订时，传入 checker 的 YAML 格式问题。checker 的输出包含一个 `## Issues` 标题，后面跟着一个 YAML 块。解析这个块，并原样传给 revision agent。

```
<checker_issues>
以下问题采用 YAML 格式。每项都包含：dimension、severity、finding、
affected_field、suggested_fix。处理全部 BLOCKER 问题。尽可能处理 WARNING
问题。

{YAML issues block from checker output -- passed verbatim}
</checker_issues>

<revision_instructions>
处理以上识别出的全部 BLOCKER 和 WARNING 问题。
- 对每个 BLOCKER：做出所需变更
- 对每个 WARNING：处理它，或说明为什么可以接受
- 修复现有问题时不要引入新问题
- 保留所有未被 checker 标记的内容
这是最多 3 轮中的第 {N} 轮修订。上一轮有 {prev_count}
个问题。你必须减少问题数量，否则循环将终止。
</revision_instructions>
```

### 3 轮之后

如果经过 3 轮修订后问题仍然存在：

1. 向用户展示剩余问题
2. 使用 gate prompt（模式：来自 `references/gate-prompts.md` 的 yes-no）：
   question: "3 次修订后仍有问题。是否继续使用当前输出？"
   header: "继续吗？"
   options:
      - label: "仍然继续"   description: "接受带剩余问题的输出"
      - label: "调整方法"  description: "讨论不同的方法"
3. 如果选择 "仍然继续"：接受当前输出并继续
4. 如果选择 "调整方法" 或 "Other"：与用户讨论，然后带着更新后的上下文重新进入生成步骤

### 按工作流区分的变体

| 工作流 | 生成 Agent | Checker Agent | 说明 |
|--------|-------------|---------------|------|
| plan-phase | gsd-planner | gsd-plan-checker | 通过 planner-revision.md 提供修订提示 |
| execute-phase | gsd-executor | gsd-verifier | 执行后的验证 |
| discuss-phase | orchestrator | gsd-plan-checker | orchestrator 内联修订 |

---

## 重要说明

- **INFO-level 问题始终可接受** - 它们不会触发修订
- **每一轮都会重新启动一个全新的 agent** - 不要试图在同一个上下文里继续
- **必须内联 checker 反馈** - revision agent 需要准确看到哪里失败了
- **不要悄悄吞掉问题** - 退出循环后，始终要向用户展示最终状态
