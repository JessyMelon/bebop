---
name: gsd:profile-user
description: 生成人员开发行为画像，并创建可被 Claude 发现的产物
argument-hint: "[--questionnaire] [--refresh]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - Task
---

<objective>
通过会话分析（或问卷）生成开发者行为画像，并产出用于个性化 Claude 响应的文件（USER-PROFILE.md、/gsd-dev-preferences、CLAUDE.md section）。

会路由到 profile-user workflow，由其编排完整流程：同意关卡、会话分析或问卷兜底、画像生成、结果展示与产物选择。
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/profile-user.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
来自 $ARGUMENTS 的 Flags：
- `--questionnaire` -- 完全跳过会话分析，只走问卷路径
- `--refresh` -- 即使已有画像也重新生成，备份旧画像，并展示维度差异
</context>

<process>
端到端执行 profile-user workflow。

该 workflow 负责全部逻辑，包括：
1. 初始化与现有画像检测
2. 会话分析前的同意关卡
3. 会话扫描与数据充分性检查
4. 会话分析（profiler agent）或问卷兜底
5. 跨项目拆分处理
6. 将画像写入 USER-PROFILE.md
7. 用报告卡和亮点展示结果
8. 产物选择（dev-preferences、CLAUDE.md sections）
9. 依次生成各产物
10. 总结与 refresh 差异展示（如适用）
</process>
