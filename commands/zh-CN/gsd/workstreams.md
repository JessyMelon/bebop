---
name: gsd:workstreams
description: 管理并行 workstreams，包括列出、创建、切换、查看状态、进度、完成和恢复
allowed-tools:
  - Read
  - Bash
---

# /gsd-workstreams

管理并行 workstreams，用于并发推进 milestone 工作。

## Usage

`/gsd-workstreams [subcommand] [args]`

### Subcommands

| Command | Description |
|---------|-------------|
| `list` | 列出所有 workstream 及其状态 |
| `create <name>` | 创建新的 workstream |
| `status <name>` | 查看单个 workstream 的详细状态 |
| `switch <name>` | 设为当前活动 workstream |
| `progress` | 查看所有 workstream 的进度汇总 |
| `complete <name>` | 归档已完成的 workstream |
| `resume <name>` | 恢复某个 workstream 中的工作 |

## Step 1: Parse Subcommand

解析用户输入，确定要执行哪种 workstream 操作。
如果没有给出子命令，默认使用 `list`。

## Step 2: Execute Operation

### list
运行：`gsd-sdk query workstream.list --raw --cwd "$CWD"`
以表格形式显示 workstreams，包含名称、状态、当前 phase 和进度。

### create
运行：`gsd-sdk query workstream.create <name> --raw --cwd "$CWD"`
创建后，显示新 workstream 的路径，并建议下一步：
- `/gsd-new-milestone --ws <name>` 用于设置该 milestone

### status
运行：`gsd-sdk query workstream.status <name> --raw --cwd "$CWD"`
显示详细的 phase 拆分和状态信息。

### switch
运行：`gsd-sdk query workstream.set <name> --raw --cwd "$CWD"`
如果 runtime 支持，也为当前会话设置 `GSD_WORKSTREAM`。
如果 runtime 暴露了会话标识符，GSD 还会按会话本地存储活动 workstream，避免并发会话互相覆盖。

### progress
运行：`gsd-sdk query workstream.progress --raw --cwd "$CWD"`
显示所有 workstream 的进度总览。

### complete
运行：`gsd-sdk query workstream.complete <name> --raw --cwd "$CWD"`
将该 workstream 归档到 `milestones/`。

### resume
将该 workstream 设为活动状态，并建议使用 `/gsd-resume-work --ws <name>`。

## Step 3: Display Results

将 `gsd-sdk query` 的 JSON 输出格式化为人类可读的展示。
在所有路由建议中包含 `${GSD_WS}` flag。
