# 继续位置模板

复制并填写下面的结构，用于 `.planning/phases/XX-name/.continue-here.md`：

```yaml
---
phase: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: 2025-01-15T14:30:00Z
---
```

```markdown
<current_state>
[我们现在具体处于哪里？当前的直接上下文是什么？]
</current_state>

<completed_work>
[本次会话完成了什么，需具体说明]

- Task 1: [name] - 已完成
- Task 2: [name] - 已完成
- Task 3: [name] - 进行中，[其上已完成的内容]
</completed_work>

<remaining_work>
[这个阶段还剩什么]

- Task 3: [name] - [剩余待做内容]
- Task 4: [name] - 未开始
- Task 5: [name] - 未开始
</remaining_work>

<decisions_made>
[关键决策及其原因，便于下次会话不再重复讨论]

- 决定使用 [X]，因为 [reason]
- 选择 [approach] 而不是 [alternative]，因为 [reason]
</decisions_made>

<blockers>
[任何卡住的点，或依赖外部因素等待处理的事项]

- [Blocker 1]: [状态/临时应对方案]
</blockers>

<context>
[心理状态、整体“氛围”，以及任何有助于顺畅继续的信息]

[当时你在想什么？计划是什么？
这里要提供“从中断点原样接上”的上下文。]
</context>

<next_action>
[恢复后要做的第一件事]

开始于： [具体动作]
</next_action>
```

<yaml_fields>
必需的 YAML frontmatter：

- `phase`: 目录名（例如 `02-authentication`）
- `task`: 当前任务编号
- `total_tasks`: 本阶段任务总数
- `status`: `in_progress`、`blocked`、`almost_done`
- `last_updated`: ISO 时间戳
</yaml_fields>

<guidelines>
- 要写得足够具体，让一个全新的 Claude 实例能立刻理解
- 要包含决策原因，而不只是是什么
- `<next_action>` 应该无需阅读其他内容就能直接执行
- 这个文件会在恢复后被删除，不是永久存储
</guidelines>
