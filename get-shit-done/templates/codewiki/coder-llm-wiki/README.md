# LLM Wiki

本目录用于保存一个长期维护、证据驱动、可恢复的仓库知识库。

## 核心规则

- 每个重要结论都必须有源码、配置、测试、脚本或 Git diff 证据。
- 明确区分事实、推断和待确认问题。
- 优先做局部增量更新，不要轻易重写整套 wiki。
- 无法确认的内容写入开放问题，不要猜测成事实。

## 从这里开始

如果要开始或恢复一次 wiki 工作，先读取这些文件：

1. `coder-llm-wiki/00-meta/project-charter.md`
2. `coder-llm-wiki/00-meta/workflow-contract.md`
3. `coder-llm-wiki/00-meta/quality-gates.md`
4. `coder-llm-wiki/00-meta/status-dashboard.md`
5. `coder-llm-wiki/00-meta/opencode-dispatch-checklist.md`

这些文件的职责不同：
- `project-charter.md`：定义目标和非目标
- `workflow-contract.md`：定义阶段输入、输出和退出条件
- `quality-gates.md`：定义什么才算完成
- `status-dashboard.md`：展示当前进度、阻塞和下一步
- `opencode-dispatch-checklist.md`：日常执行用的操作清单

如果需要可直接复制给 OpenCode 的提示词，见：
- `coder-llm-wiki/00-meta/opencode-starter-prompts.md`

## 目录结构

- `00-meta/`：项目规则、进度、队列、提示词、术语表
- `01-inventory/`：仓库地图、技术栈、入口点、模块候选
- `02-index/`：路由、模型、任务、符号、测试索引
- `03-modules/`：每个模块一篇文档
- `04-flows/`：每个重要流程一篇文档
- `05-data/`：schema、缓存、事件、存储相关说明
- `06-ops/`：运行、构建、部署、监控、恢复说明
- `07-risks/`：脆弱区域、技术债、隐藏约束
- `08-evidence/`：支撑各文档的文件和行号引用
- `09-review/`：冲突、问题、人工 review 待办
- `10-snapshots/`：任务或批次级检查点和恢复状态

## 工作流

推荐按阶段推进：

1. `Initialize`
2. `Inventory`
3. `Index`
4. `Prepare Module Queue`
5. `Module Analysis`
6. `Lightweight Review`
7. `Flow Planning`
8. `Flow Analysis`
9. `Cross Review`
10. `Snapshot`
11. `Incremental Update`

完整契约见 `coder-llm-wiki/00-meta/workflow-contract.md`。

## 工作方式

### 执行模式

`coder-llm-wiki` 支持三种执行方式：

- `supervised`：需要人工判断时优先询问或暂停。
- `deferred-review`：能继续就继续，把需要人工判断的事项写入 `09-review/human-review.md`，不立即阻塞。
- `unattended`：除非缺文件、权限不足、状态冲突等会导致产物不可靠的硬阻塞，否则自动推进。

长时间仓库分析推荐默认使用 `deferred-review`，既保留人工审查入口，也不依赖同步回复。

当前执行策略写入 `coder-llm-wiki/00-meta/progress.json.execution`，并同步反映到 `00-meta/status-dashboard.md`。

### 新仓库分析

1. 先建立 inventory。
2. 基于真实入口点建立 index 文档。
3. 将模块工作拆成可 review 的队列任务。
4. 编写带证据和开放问题的模块文档。
5. 任务标记完成前先 review。
6. 规划并编写高价值 flow 文档。
7. 执行交叉 review 并写入 snapshot。

### 恢复中断任务

1. Read `00-meta/progress.json`.
2. Read `00-meta/task-queue.json`.
3. Read the latest file under `10-snapshots/`.
4. Read `00-meta/status-dashboard.md`.
5. 从当前 phase 恢复，不要重新扫描全部内容。

### 代码变更后的更新

1. 读取当前 diff 或变更文件。
2. 将变更映射到受影响模块和流程。
3. 只更新受影响的文档和证据。
4. 重新执行轻量 review。
5. 批次结束后写入新的 snapshot。

详细策略见 `coder-llm-wiki/00-meta/incremental-update-policy.md`。

## 状态文件

主要状态文件：

- `00-meta/progress.json`：当前 phase、批次、覆盖率、阻塞、snapshot 指针
- `00-meta/task-queue.json`：任务生命周期和 review 状态
- `00-meta/status-dashboard.md`：给人阅读的状态摘要
- `10-snapshots/`：可恢复的检查点

这些文件是运行状态，不是可选笔记。

## 完成定义

wiki 任务不是写了文字就算完成。只有满足以下条件才算完成：

1. 目标文档已经写入。
2. 关键结论有证据。
3. 不确定项已写入 review 文档。
4. 队列和进度状态已更新。
5. 相关 quality gates 已通过。

## 运行原则

这套 wiki 应该像一个轻量知识系统，而不是松散总结的集合。
