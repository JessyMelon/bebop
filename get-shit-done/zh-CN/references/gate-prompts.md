# Gate Prompt Patterns

用于工作流和 agents 中结构化 gate 检查的可复用 prompt 模式。

**For checkpoint box format details, see `references/ui-brand.md`** —— checkpoint boxes 使用双线边框，内部宽度为 62 个字符。

## Rules

- `header` 最多 12 个字符
- gate checks 中 `multiSelect` 始终为 `false`
- 一定要处理 `Other` 情况（用户输入自由文本而不是选择现成选项）
- 每个 prompt 最多 4 个选项 —— 如果需要更多，请拆成 2 步流程

---

## Pattern: approve-revise-abort
用于计划批准、gap-closure 批准的 3 选项 gate。
- question: `Approve these {noun}?`
- header: `Approve?`
- options: Approve | Request changes | Abort

## Pattern: yes-no
用于 re-planning、rebuild、replace plans、commit 的简单 2 选项确认。
- question: `{Specific question about the action}`
- header: `Confirm`
- options: Yes | No

## Pattern: stale-continue
用于 staleness warnings、timestamp freshness 的 2 选项刷新 gate。
- question: `{Artifact} may be outdated. Refresh or continue?`
- header: `Stale`
- options: Refresh | Continue anyway

## Pattern: yes-no-pick
用于 seed selection、item inclusion 的 3 选项选择。
- question: `Include {items} in planning?`
- header: `Include?`
- options: Yes, all | Let me pick | No

## Pattern: multi-option-failure
用于 build failures 的 4 选项失败处理器。
- question: `Plan {id} failed. How should we proceed?`
- header: `Failed`
- options: Retry | Skip | Rollback | Abort

## Pattern: multi-option-escalation
用于 review escalation（超过最大重试次数）的 4 选项升级处理。
- question: `Phase {N} has failed verification {attempt} times. How should we proceed?`
- header: `Escalate`
- options: Accept gaps | Re-plan (via /gsd-plan-phase) | Debug (via /gsd-debug) | Retry

## Pattern: multi-option-gaps
用于 review gaps-found 的 4 选项 gap 处理器。
- question: `{count} verification gaps need attention. How should we proceed?`
- header: `Gaps`
- options: Auto-fix | Override | Manual | Skip

## Pattern: multi-option-priority
用于 milestone gap priority 的 4 选项优先级选择。
- question: `Which gaps should we address?`
- header: `Priority`
- options: Must-fix only | Must + should | Everything | Let me pick

## Pattern: toggle-confirm
用于启用/禁用布尔特性的 2 选项确认。
- question: `Enable {feature_name}?`
- header: `Toggle`
- options: Enable | Disable

## Pattern: action-routing
提供最多 4 个建议后续动作的选择模式（用于 status、resume workflows）。
- question: `What would you like to do next?`
- header: `Next Step`
- options: {primary action} | {alternative 1} | {alternative 2} | Something else
- Note: 选项按工作流状态动态生成。始终把 `Something else` 作为最后一个选项。

## Pattern: scope-confirm
用于快速任务范围校验的 3 选项确认。
- question: `This task looks complex. Proceed as quick task or use full planning?`
- header: `Scope`
- options: Quick task | Full plan (via /gsd-plan-phase) | Revise

## Pattern: depth-select
用于规划工作流偏好的 3 选项深度选择。
- question: `How thorough should planning be?`
- header: `Depth`
- options: Quick (3-5 phases, skip research) | Standard (5-8 phases, default) | Comprehensive (8-12 phases, deep research)

## Pattern: context-handling
用于 discuss workflow 中已有 CONTEXT.md 的 3 选项处理器。
- question: `Phase {N} already has a CONTEXT.md. How should we handle it?`
- header: `Context`
- options: Overwrite | Append | Cancel

## Pattern: gray-area-option
用于 discuss workflow 展示 gray area 选择的动态模板。
- question: `{Gray area title}`
- header: `Decision`
- options: {Option 1} | {Option 2} | Let Claude decide
- Note: 选项在运行时生成。始终把 `Let Claude decide` 作为最后一个选项。
