# 讨论日志模板

用于 `.planning/phases/XX-name/{phase_num}-DISCUSSION-LOG.md` 的模板，用作 discuss-phase 问答会话的审计轨迹。

**用途：** 作为决策过程的软件审计轨迹。记录所有被考虑过的选项，而不仅仅是最终选中的项。它与 CONTEXT.md 分离，后者是供下游 agent 使用的实现产物。

**不要供 LLM 使用。** 这个文件绝不能出现在 `<files_to_read>` block 或 agent prompt 中被引用。

## 格式

```markdown
# Phase [X]: [Name] - 讨论日志

> **仅用于审计轨迹。** 不要将其作为 planning、research 或 execution agents 的输入。
> 决策记录在 CONTEXT.md 中，这个日志只保留被考虑过的替代方案。

**Date:** [ISO date]
**Phase:** [phase number]-[phase name]
**讨论领域：** [以逗号分隔的列表]

---

## [Area 1 Name]

| Option | Description | Selected |
|--------|-------------|----------|
| [Option 1] | [Brief description] | |
| [Option 2] | [Brief description] | ✓ |
| [Option 3] | [Brief description] | |

**用户选择：** [选中的选项，或用户原样输入的自由文本]
**备注：** [讨论中给出的任何澄清或理由]

---

## [Area 2 Name]

...

---

## Claude 自主决定

[交由 Claude 判断的领域，列出延后处理的内容及原因]

## 延后想法

[提到过但不属于本阶段范围的想法]

---

*Phase: XX-name*
*讨论日志生成于：[date]*
```

## 规则

- 每次 discuss-phase 会话结束时自动生成
- 包含所有被考虑过的选项，而不仅是选中的那个
- 包含用户的自由文本备注和澄清
- 要清楚标明它仅用于审计，不是实现产物
- 不得干扰 CONTEXT.md 生成或下游 agent 行为
- 与 CONTEXT.md 一起在同一个 git commit 中提交
