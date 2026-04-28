---
name: gsd:settings
description: 配置 GSD 工作流开关和模型配置档位
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
通过多问题交互提示，交互式配置 GSD 工作流 agents 和模型配置档位。

转到 settings 工作流，由它处理以下内容：
- 确保配置存在
- 读取并解析当前设置
- 交互式 5 问提示（model、research、plan_check、verifier、branching）
- 合并并写入配置
- 显示确认信息和快捷命令参考
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/settings.md
</execution_context>

<process>
**遵循** `@~/.claude/get-shit-done/workflows/settings.md` 中的 settings 工作流。

该工作流处理全部逻辑，包括：
1. 若配置文件缺失则按默认值创建
2. 读取当前配置
3. 以预选项展示交互式设置
4. 解析回答并合并配置
5. 写入文件
6. 显示确认信息
</process>
