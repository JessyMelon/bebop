---
name: gsd:update
description: 将 GSD 更新到最新版本并显示变更日志
allowed-tools:
  - Bash
  - AskUserQuestion
---

<objective>
检查 GSD 更新，如有可用版本则安装，并显示变更内容。

转到 update 工作流，由它处理以下内容：
- 版本检测（本地安装 vs 全局安装）
- npm 版本检查
- 获取并显示变更日志
- 带干净安装警告的用户确认
- 执行更新并清理缓存
- 提醒重启
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/update.md
</execution_context>

<process>
**遵循** `@~/.claude/get-shit-done/workflows/update.md` 中的 update 工作流。

该工作流处理全部逻辑，包括：
1. 检测已安装版本（本地/全局）
2. 通过 npm 检查最新版本
3. 比较版本
4. 获取并提取变更日志
5. 显示干净安装警告
6. 用户确认
7. 执行更新
8. 清理缓存
</process>
