# 命令契约

## 目的

本文件定义 `coder-llm-wiki` 的 `/wiki-*` 命令接口合同。

目标：
- 统一不同操作者或代理对命令含义的理解
- 明确每个命令允许做什么、不做什么
- 明确命令对状态文件和产物的副作用

本文件与以下文档配套使用：
- `workflow-contract.md`
- `quality-gates.md`
- `prompt-templates.md`

## 全局规则

所有 `/wiki-*` 命令都必须遵守：

1. 不得绕过 evidence 要求。
2. 不得在未更新状态文件的情况下宣称完成。
3. 不得把不确定结论写成事实。
4. 不得无理由重写整批文档。
5. 如命令结果不足以通过 quality gates，必须返回 `needs-review` 或 `blocked` 语义，而不是伪装成功。

## 执行策略语义

命令是否应暂停等待人工，取决于当前 run 的执行策略：

- `supervised`: 可以在关键歧义处停止并等待人工回复
- `deferred-review`: 优先返回 `needs-review`，把待人工判断项写入 review 文档，不因可延期问题而暂停
- `unattended`: 优先返回 `success`、`partial` 或 `needs-review`，只有硬阻塞才返回 `blocked`

这里的“硬阻塞”包括：

- 必要输入文件缺失
- 权限或环境限制导致无法读取/写入关键产物
- 状态文件冲突且无法自动选择可信来源
- 继续执行会明显降低产物可靠性

## 通用命令结构

每个命令都应具备以下语义字段：

- `name`：命令名
- `purpose`：命令目标
- `inputs`：读取的主要文件或上下文
- `outputs`：写入或更新的目标文件
- `state_effects`：对 `progress.json`、`task-queue.json`、`status-dashboard.md`、`10-snapshots/` 的影响
- `success_conditions`：什么情况下算成功
- `failure_modes`：什么情况下应返回失败或阻塞

## `/wiki-init`

### 目的

初始化或恢复当前 wiki 工作上下文。

### 输入

- `README.md`
- `00-meta/project-charter.md`
- `00-meta/workflow-contract.md`
- `00-meta/quality-gates.md`
- `00-meta/progress.json`
- `00-meta/task-queue.json`
- `00-meta/status-dashboard.md`
- 最新 snapshot（如存在）

### 输出

- 更新 `00-meta/progress.json`
- 更新 `00-meta/task-queue.json`
- 必要时更新 `00-meta/status-dashboard.md`

### 状态影响

- 设置或修正 `phase`
- 设置或修正 `current_batch_id`
- 记录当前 blockers 或 notes

### 成功条件

- 当前阶段清楚
- 当前批次清楚
- 下一步任务清楚

### 失败模式

- 状态文件互相冲突且无法自动判断
- 缺关键 meta 文件

## `/wiki-inventory`

### 目的

生成仓库 inventory 文档。

### 输入

- 仓库根目录
- 顶层文档与配置

### 输出

- `01-inventory/repo-map.md`
- `01-inventory/tech-stack.md`
- `01-inventory/entrypoints.md`
- `01-inventory/module-candidates.json`

### 状态影响

- `progress.phase = inventory`
- 更新 `coverage.inventory`

### 成功条件

- 顶层目录和主要入口已识别
- 模块候选可供后续切分

### 失败模式

- 仓库结构过大但未分批
- 入口识别严重不完整且未记录限制

## `/wiki-index`

### 目的

建立索引层，支撑后续分析。

### 输入

- inventory 产物
- 真实入口
- 核心实现和测试

### 输出

- `02-index/routes.md`
- `02-index/symbols.md`
- `02-index/test-map.md`
- 可选的 `jobs.md` 或 `events.md`

### 状态影响

- `progress.phase = index`
- 更新 `coverage.index`

### 成功条件

- 入口、核心符号、测试建立了基本映射

### 失败模式

- 索引内容只是 README 摘录
- 动态系统无法解析但未记录限制

## `/wiki-module <name>`

### 目的

生成单模块文档、evidence 和问题清单。

### 输入

- queue 中对应模块任务
- 模块源码、配置、测试、入口、调用方

### 输出

- `03-modules/<name>.md`
- `08-evidence/<name>.refs.md`
- `09-review/<name>.questions.md`

### 状态影响

- 任务状态从 `pending` 推进到 `review-needed`
- 更新 `last_updated_at`
- 更新 `notes`
- 设置 `review_result = not_reviewed`

### 成功条件

- 文档字段完整
- evidence 已附
- open questions 已记录

### 失败模式

- 模块边界不清导致无法稳定文档化
- 证据不足却强行下结论

## `/wiki-flow <name>`

### 目的

生成单流程文档和必要的 supporting evidence。

### 输入

- queue 中对应 flow 任务
- 真实入口
- 调用链
- 相关模块文档和测试

### 输出

- `04-flows/<name>.md`
- 必要时更新 `08-evidence/*.md`

### 状态影响

- 任务状态从 `pending` 推进到 `review-needed`

### 成功条件

- 主路径、失败路径、状态变化、外部调用清楚

### 失败模式

- 只有函数列表，没有真实流程描述
- 忽略失败路径和补偿逻辑

## `/wiki-review`

### 目的

执行一致性、evidence、风险覆盖和 freshness 检查。

### 输入

- `02-index/`
- `03-modules/`
- `04-flows/`
- `08-evidence/`
- `09-review/` 现有记录

### 输出

- 更新 `09-review/conflict-log.md`
- 更新 `09-review/open-questions.md`
- 更新 `09-review/human-review.md`

### 状态影响

- 将任务标记为 `done`、`pending` 或 `blocked`
- 更新 `review_result`

### 成功条件

- 问题已被分类
- 关键冲突已修复或显式记录

### 失败模式

- review 只给主观评价，没有明确问题分类

## `/wiki-snapshot`

### 目的

记录当前批次的可恢复状态。

### 输入

- `progress.json`
- `task-queue.json`
- 当前 review 状态
- 本批次输出

### 输出

- `10-snapshots/<timestamp>-<batch>.md`

### 状态影响

- 更新 `progress.last_snapshot`
- 记录暂停点和下一步

### 成功条件

- 新操作者可直接恢复工作

### 失败模式

- 快照缺少 blockers 或 next steps

## `/wiki-update-from-diff`

### 目的

根据变更范围增量更新 wiki。

### 输入

- `git diff` 或 changed files
- 现有 module/flow/evidence docs

### 输出

- 被影响文档的局部更新
- 新增或更新的 review 记录
- 必要时更新 dashboard 和 snapshot

### 状态影响

- `progress.phase = incremental_updates`
- 更新 `last_diff_base`

### 成功条件

- 只更新受影响区域
- stale evidence 已处理

### 失败模式

- 影响范围不明却大面积改写文档

## `/wiki-status`

### 目的

刷新并输出当前运行状态总览。

### 输入

- `progress.json`
- `task-queue.json`
- 最新 snapshot
- `09-review/` 未解决项

### 输出

- 更新 `00-meta/status-dashboard.md`

### 状态影响

- 同步 dashboard

### 成功条件

- 读者能快速知道当前 phase、queue、blockers、next steps

### 失败模式

- dashboard 与状态文件明显不一致

## 状态语义

命令执行结果建议统一为以下语义：

- `success`: 达到当前命令目标且可推进
- `needs-review`: 产物已生成，但必须经过 review gate
- `blocked`: 缺信息、状态冲突或证据不足，无法继续
- `partial`: 完成部分输出，但仍需后续补全

补充约束：

- 当 `execution.mode = deferred-review` 时，优先使用 `needs-review` 而不是 `blocked`
- 当 `execution.mode = unattended` 时，`blocked` 仅用于硬阻塞

## 核心结论

`/wiki-*` 命令的本质不是“生成文档”，而是“推进一个可恢复、可校验的知识工作流”。
