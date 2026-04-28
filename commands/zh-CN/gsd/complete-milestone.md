---
type: prompt
name: gsd:complete-milestone
description: 归档已完成的 milestone，并为下一个版本做准备
argument-hint: <version>
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
将 milestone {{version}} 标记为完成，归档到 `milestones/`，并更新 `ROADMAP.md` 与 `REQUIREMENTS.md`。

目的：为已发布版本创建历史记录，归档 milestone 产物（roadmap + requirements），并为下一个 milestone 做准备。
输出：Milestone 已归档（roadmap + requirements），`PROJECT.md` 已演进，已打 git tag。
</objective>

<execution_context>
**现在就加载这些文件（继续之前）：**

- @~/.claude/get-shit-done/workflows/complete-milestone.md (main workflow)
- @~/.claude/get-shit-done/templates/milestone-archive.md (archive template)
  </execution_context>

<context>
**项目文件：**
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/PROJECT.md`

**用户输入：**

- Version: {{version}}（例如：`"1.0"`、`"1.1"`、`"2.0"`）
  </context>

<process>

**遵循 complete-milestone.md 工作流：**

0. **检查 audit：**

   - 查找 `.planning/v{{version}}-MILESTONE-AUDIT.md`
   - 如果缺失或已过期：建议先运行 `/gsd-audit-milestone`
   - 如果 audit 状态为 `gaps_found`：建议先运行 `/gsd-plan-milestone-gaps`
   - 如果 audit 状态为 `passed`：继续步骤 1

   ```markdown
   ## 起飞前检查

   {If no v{{version}}-MILESTONE-AUDIT.md:}
   ⚠ 未找到 milestone audit。请先运行 `/gsd-audit-milestone`，以验证
   需求覆盖、跨 phase 集成和 E2E 流程。

   {If audit has gaps:}
   ⚠ Milestone audit 发现缺口。请运行 `/gsd-plan-milestone-gaps` 创建
   用于补齐缺口的 phases，或者仍然继续并将其视为技术债接受。

   {If audit passed:}
   ✓ Milestone audit 已通过。继续完成流程。
   ```

1. **验证是否就绪：**

   - 检查 milestone 中所有 phases 是否都有已完成的 plan（存在 `SUMMARY.md`）
   - 展示 milestone 范围和统计信息
   - 等待确认

2. **收集统计信息：**

   - 统计 phases、plans、tasks 数量
   - 计算 git 范围、文件变更和 LOC
   - 从 git log 提取时间线
   - 展示摘要并确认

3. **提取成果：**

   - 读取 milestone 范围内所有 phase 的 `SUMMARY.md`
   - 提取 4-6 项关键成果
   - 展示并等待批准

4. **归档 milestone：**

   - 创建 `.planning/milestones/v{{version}}-ROADMAP.md`
   - 从 `ROADMAP.md` 提取完整 phase 详情
   - 填充 `milestone-archive.md` 模板
   - 将 `ROADMAP.md` 更新为带链接的单行摘要

5. **归档 requirements：**

   - 创建 `.planning/milestones/v{{version}}-REQUIREMENTS.md`
   - 将所有 v1 requirements 标记为完成（勾选复选框）
   - 记录 requirement 结果（validated、adjusted、dropped）
   - 删除 `.planning/REQUIREMENTS.md`（下一个 milestone 会创建新的）

6. **更新 `PROJECT.md`：**

   - 添加 “Current State” 区段，写入已发布版本
   - 添加 “Next Milestone Goals” 区段
   - 将旧内容归档到 `<details>` 中（如果是 v1.1+）

7. **提交并打 tag：**

   - Stage：`MILESTONES.md`、`PROJECT.md`、`ROADMAP.md`、`STATE.md`、归档文件
   - Commit：`chore: archive v{{version}} milestone`
   - Tag：`git tag -a v{{version}} -m "[milestone summary]"`
   - 询问是否推送 tag

8. **提供后续步骤：**
   - `/gsd-new-milestone` — 开始下一个 milestone（提问 → 研究 → requirements → roadmap）

</process>

<success_criteria>

- Milestone 已归档到 `.planning/milestones/v{{version}}-ROADMAP.md`
- Requirements 已归档到 `.planning/milestones/v{{version}}-REQUIREMENTS.md`
- `.planning/REQUIREMENTS.md` 已删除（下一个 milestone 使用新的）
- `ROADMAP.md` 已折叠为单行条目
- `PROJECT.md` 已更新当前状态
- Git tag `v{{version}}` 已创建
- 提交成功
- 用户清楚下一步（包括需要新的 requirements）
  </success_criteria>

<critical_rules>

- **先加载工作流：** 执行前先读取 `complete-milestone.md`
- **验证完成情况：** 所有 phases 都必须有 `SUMMARY.md` 文件
- **用户确认：** 在验证关卡处等待批准
- **先归档再删除：** 更新/删除原文件前，必须先创建归档文件
- **单行摘要：** `ROADMAP.md` 中折叠后的 milestone 应为带链接的单行
- **上下文效率：** 归档使 `ROADMAP.md` 和 `REQUIREMENTS.md` 在每个 milestone 之后都保持恒定大小
- **新的 requirements：** 下一个 milestone 从 `/gsd-new-milestone` 开始，其中包含 requirements 定义
  </critical_rules>
