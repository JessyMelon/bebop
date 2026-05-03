# Snapshot 格式

## 目的

本文件定义 `coder-llm-wiki/10-snapshots/` 下快照文件的统一格式。

目标：
- 让中断恢复不依赖长上下文回忆
- 让不同操作者都能快速接手当前批次
- 让 snapshot 成为真实工作锚点，而不是随手备注

## 命名约定

推荐命名：

`YYYY-MM-DD-HHMM-<batch-id>.md`

示例：

`2026-04-19-1530-bootstrap.md`

## 必需章节

每个 snapshot 文件都应包含以下章节。

### 1. Snapshot 元信息

- 时间戳：
- Batch ID：
- 当前 Phase：
- 操作者：
- 触发原因：
  - batch complete
  - pause
  - blocked
  - incremental update complete

### 2. 当前状态

- `progress.json` 摘要
- `task-queue.json` 摘要
- 当前覆盖摘要

### 3. 本批次完成内容

- `<task-id>` - `<变更内容>`
- `<task-id>` - `<变更内容>`

### 4. 写入产物

- `path/to/file`
- `path/to/file`

### 5. Review 状态

- Passed:
- Pass With Questions:
- Failed:
- Review-needed:

### 6. 当前阻塞

- `<blocker>`
  - 影响：
  - 需要动作：

### 7. 开放问题

- `<question>`
- `<question>`

### 8. 建议下一步

1. 
2. 
3. 

### 9. 恢复说明

- 先读取这些文件：
  - `00-meta/progress.json`
  - `00-meta/task-queue.json`
  - `00-meta/status-dashboard.md`
  - 当前 snapshot
- 从这里恢复：
  - `<task-id or phase>`

## 最小 Snapshot 模板

```md
# Snapshot: <batch-id>

## Snapshot 元信息
- 时间戳：
- Batch ID：
- 当前 Phase：
- 操作者：
- 触发原因：

## 当前状态
- 进度：
- 队列：
- 覆盖：

## 本批次完成内容
-

## 写入产物
-

## Review 模板 状态
- Passed:
- Pass With Questions:
- Failed:
- Review-needed:

## 当前阻塞
-

## 开放问题
-

## 建议下一步
1. 
2. 
3. 

## 恢复说明
- 先读取这些文件：
  - `00-meta/progress.json`
  - `00-meta/task-queue.json`
  - `00-meta/status-dashboard.md`
  - 当前 snapshot
- 从这里恢复：
```

## 写作规则

1. Snapshot 必须写“下一步做什么”，不能只写“做了什么”。
2. Snapshot 必须写 blocker 和 unresolved questions。
3. Snapshot 应引用实际产物路径，而不是抽象描述。
4. 如果 queue 与真实产物不一致，必须明确指出。
5. 如果本批次没有新产物，也要说明原因。

## 何时写 Snapshot

必须写 snapshot 的时机：

1. 完成一批 module tasks 后
2. 完成一批 flow tasks 后
3. 完成 cross review 后
4. 准备暂停工作时
5. 完成一次较大的 incremental update 后
6. 遇到 blocker 且短期无法继续时

## 反模式

不要这样写 snapshot：

- 只写一句“done”
- 不写 next steps
- 不写 blocker
- 不写实际产物
- 把 snapshot 写成和 dashboard 完全重复的泛化摘要

## 核心结论

snapshot 的价值在于“让下一个人能继续”，不是“证明上一个人工作过”。
