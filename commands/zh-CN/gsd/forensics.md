---
type: prompt
name: gsd:forensics
description: 针对失败的 GSD 工作流进行事后取证调查，分析 git 历史、产物和状态以诊断问题
argument-hint: "[problem description]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
---

<objective>
调查一次 GSD 工作流执行过程中哪里出了问题。分析 git 历史、`.planning/` 产物和文件系统状态，以检测异常并生成结构化诊断报告。

目的：诊断失败或卡住的工作流，帮助用户理解根因并采取纠正措施。
输出：取证报告保存到 `.planning/forensics/`，内联展示，并可选择创建 issue。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/forensics.md
</execution_context>

<context>
**数据来源：**
- `git log`（近期提交、模式、时间间隔）
- `git status` / `git diff`（未提交工作、冲突）
- `.planning/STATE.md`（当前位置、会话历史）
- `.planning/ROADMAP.md`（阶段范围与进度）
- `.planning/phases/*/`（PLAN.md、SUMMARY.md、VERIFICATION.md、CONTEXT.md）
- `.planning/reports/SESSION_REPORT.md`（上一次会话结果）

**用户输入：**
- 问题描述：$ARGUMENTS（可选，未提供时将询问）
</context>

<process>
读取并端到端执行 @~/.claude/get-shit-done/workflows/forensics.md 中的 forensics workflow。
</process>

<success_criteria>
- 从所有可用数据源收集证据
- 至少检查 4 类异常（卡住循环、缺失产物、已放弃工作、崩溃/中断）
- 将结构化取证报告写入 `.planning/forensics/report-{timestamp}.md`
- 内联展示报告，包括发现、异常和建议
- 提供更深入分析的交互式调查选项
- 如果存在可执行的发现，提供创建 GitHub issue 的选项
</success_criteria>

<critical_rules>
- **只读调查：** 取证期间不要修改项目源码文件。只允许写入取证报告并更新 STATE.md 的会话跟踪。
- **脱敏敏感数据：** 从报告和 issue 中移除绝对路径、API keys、tokens。
- **基于证据得出结论：** 每个异常都必须引用具体的提交、文件或状态数据。
- **没有证据就不要猜测：** 如果数据不足，请明确说明，不要编造根因。
</critical_rules>
