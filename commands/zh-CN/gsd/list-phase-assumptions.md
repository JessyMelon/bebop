---
name: gsd:list-phase-assumptions
description: 在规划前展示 Claude 对某个阶段方案的假设
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

<objective>
分析一个 phase，并展示 Claude 对技术方案、实现顺序、范围边界、风险区域和依赖关系的假设。

目的：让用户在规划开始**之前**看到 Claude 的判断，以便在假设错误时尽早纠偏。
输出：仅对话式输出（不创建文件），并以 `What do you think?` 提示结束
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/list-phase-assumptions.md
</execution_context>

<context>
Phase number：$ARGUMENTS（必填）

项目状态和 roadmap 会在 workflow 中通过有针对性的读取加载。
</context>

<process>
1. 校验 phase number 参数（缺失或无效则报错）
2. 检查该 phase 是否存在于 roadmap 中
3. 按照 list-phase-assumptions.md workflow 执行：
   - 分析 roadmap 描述
   - 展示以下方面的假设：技术方案、实现顺序、范围、风险、依赖
   - 清晰地呈现这些假设
   - 提示 `What do you think?`
4. 收集反馈并提供后续步骤
</process>

<success_criteria>

- Phase 已对照 roadmap 完成校验
- 已在五个方面展示假设
- 已提示用户反馈
- 用户清楚后续步骤（讨论上下文、规划 phase，或纠正假设）
  </success_criteria>
