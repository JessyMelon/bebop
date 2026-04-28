---
name: gsd:pause-work
description: 在 phase 中途暂停工作时创建上下文交接
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
创建 `.continue-here.md` 交接文件，以便在不同会话之间完整保留工作状态。

会路由到 pause-work workflow，该 workflow 负责：
- 根据最近文件检测当前 phase
- 完整收集状态（当前位置、已完成工作、剩余工作、决策、阻塞项）
- 创建包含全部上下文分区的交接文件
- 以 WIP 形式进行 Git 提交
- 提供恢复说明
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/pause-work.md
</execution_context>

<context>
状态和 phase 进度会在 workflow 内通过定向读取来收集。
</context>

<process>
**遵循** `@~/.claude/get-shit-done/workflows/pause-work.md` 中的 pause-work workflow。

该 workflow 负责全部逻辑，包括：
1. phase 目录检测
2. 结合用户澄清收集状态
3. 写入带时间戳的交接文件
4. Git 提交
5. 带恢复说明的确认
</process>
