---
name: gsd:add-tests
description: 根据 UAT 标准和实现，为已完成的 phase 生成测试
argument-hint: "<phase> [additional instructions]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
argument-instructions: |
  将参数解析为 phase 编号（整数、小数或字母后缀），外加可选自由文本说明。
  示例：/gsd-add-tests 12
  示例：/gsd-add-tests 12 focus on edge cases in the pricing module
---
<objective>
为已完成的 phase 生成单元测试和 E2E 测试，并将其 `SUMMARY.md`、`CONTEXT.md` 与 `VERIFICATION.md` 作为规格说明。

分析实现文件，将其分类为 TDD（单元）、E2E（浏览器）或 Skip，向用户展示测试计划并在获批后，按 RED-GREEN 约定生成测试。

输出：提交测试文件，提交信息为 `test(phase-{N}): add unit and E2E tests from add-tests command`
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/add-tests.md
</execution_context>

<context>
Phase：$ARGUMENTS

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>
端到端执行 `@~/.claude/get-shit-done/workflows/add-tests.md` 中的 add-tests 工作流。
保留所有工作流关卡（分类审批、测试计划审批、RED-GREEN 验证、缺口报告）。
</process>
