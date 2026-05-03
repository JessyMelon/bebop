# OpenCode 启动提示词

## 目的

本文件整理了一组可直接发给 OpenCode 的标准提示词，用于在任意仓库中按 `coder-llm-wiki` workflow 运行分析任务。

使用方式：
- 将 `coder-llm-wiki/` 放入目标仓库根目录
- 在 OpenCode 中打开该仓库
- 从下面选择对应阶段的提示词直接发送

建议先决定本轮执行模式：

- `supervised`: 保留同步人工确认
- `deferred-review`: 优先连续执行，把人工问题沉淀到 review 文档
- `unattended`: 尽量自主完成当前批次，仅在硬阻塞时停止

## 1. 标准启动提示词

```text
你现在要作为一个“基于 coder-llm-wiki 的仓库分析代理”工作。

执行参数：
- EXECUTION_MODE=<supervised|deferred-review|unattended>
- ASK_FOR_CONFIRMATION=<true|false>
- BLOCK_ON_HUMAN_REVIEW=<true|false>
- MAX_AUTO_STEPS=<number>

工作目标：
为当前仓库建立一个长期可维护、证据驱动、可恢复的知识库，所有产物写入 `coder-llm-wiki/` 目录。

先不要直接做自由发挥的总结，严格按 `coder-llm-wiki` 的 workflow 工作。

开始前必须先读取这些文件：
1. `coder-llm-wiki/README.md`
2. `coder-llm-wiki/00-meta/project-charter.md`
3. `coder-llm-wiki/00-meta/workflow-contract.md`
4. `coder-llm-wiki/00-meta/quality-gates.md`
5. `coder-llm-wiki/00-meta/command-contract.md`
6. `coder-llm-wiki/00-meta/review-rubric.md`
7. `coder-llm-wiki/00-meta/snapshot-format.md`
8. `coder-llm-wiki/00-meta/status-dashboard.md`
9. `coder-llm-wiki/00-meta/opencode-dispatch-checklist.md`
10. `coder-llm-wiki/00-meta/prompt-templates.md`
11. `coder-llm-wiki/00-meta/progress.json`
12. `coder-llm-wiki/00-meta/task-queue.json`

必须遵守的规则：
- 重要结论必须有源码、配置、测试或脚本 evidence 支撑
- 区分事实、推断、开放问题
- 不要重写整个 wiki，优先局部、增量、可恢复更新
- 每完成一个任务都更新状态文件
- 如果不能确认，不要猜，记录到 review 文档
- 产物未通过 quality gates 前，不要标记为 done

执行方式：
- 把当前工作当作 `/wiki-init` 开始
- 先检查并修正 `progress.json`、`task-queue.json`、`status-dashboard.md`
- 将执行参数写入 `progress.json.execution`
- 明确当前 phase、current_batch_id、blockers、next steps
- 然后根据当前状态决定下一步
- 如果是新仓库且尚未初始化内容，优先执行 `/wiki-inventory`
- inventory 完成后执行 `/wiki-index`
- 再进入 module queue、module analysis、flow analysis、review、snapshot
- 如果 `ASK_FOR_CONFIRMATION=false`，不要请求我提供“下一步动作”；请在当前批次内自行选择最合理的后续任务
- 如果 `BLOCK_ON_HUMAN_REVIEW=false`，把待人工判断项写入 `coder-llm-wiki/09-review/human-review.md`，不要因此停止可继续的工作
- 当达到 `MAX_AUTO_STEPS` 或当前批次完成时，再统一汇报结果并停止

你的输出要求：
- 不要只回复结论
- 直接在 `coder-llm-wiki/` 下写入或更新文件
- 每次操作后简要说明：
  - 更新了哪些文件
  - 当前 phase 是什么
  - 下一步建议做什么

如果当前是第一次运行，请按这个顺序执行：
1. `/wiki-init`
2. `/wiki-inventory`
3. `/wiki-index`
4. 更新 `status-dashboard.md`
5. 写一份 snapshot

如果当前已经有部分内容，请不要重置，基于现有状态继续推进。
```

### 推荐参数预设

```text
人工值守：
- EXECUTION_MODE=supervised
- ASK_FOR_CONFIRMATION=true
- BLOCK_ON_HUMAN_REVIEW=true
- MAX_AUTO_STEPS=1

半托管：
- EXECUTION_MODE=deferred-review
- ASK_FOR_CONFIRMATION=false
- BLOCK_ON_HUMAN_REVIEW=false
- MAX_AUTO_STEPS=5

无人值守批次：
- EXECUTION_MODE=unattended
- ASK_FOR_CONFIRMATION=false
- BLOCK_ON_HUMAN_REVIEW=false
- MAX_AUTO_STEPS=20
```

## 2. 模块分析提示词

```text
继续按照 `coder-llm-wiki` workflow 工作。

这次任务聚焦在 `/wiki-module` 阶段，不做全仓泛化总结。

开始前先读取：
1. `coder-llm-wiki/00-meta/workflow-contract.md`
2. `coder-llm-wiki/00-meta/quality-gates.md`
3. `coder-llm-wiki/00-meta/review-rubric.md`
4. `coder-llm-wiki/00-meta/prompt-templates.md`
5. `coder-llm-wiki/00-meta/progress.json`
6. `coder-llm-wiki/00-meta/task-queue.json`
7. `coder-llm-wiki/00-meta/status-dashboard.md`
8. `coder-llm-wiki/01-inventory/module-candidates.json`
9. `coder-llm-wiki/02-index/` 下已有索引文档

任务目标：
- 从 `task-queue.json` 中挑选下一个 `type=module` 且 `status=pending` 的任务
- 按 `/wiki-module <MODULE_NAME>` 模板执行
- 产出：
  - `coder-llm-wiki/03-modules/<MODULE_NAME>.md`
  - `coder-llm-wiki/08-evidence/<MODULE_NAME>.refs.md`
  - `coder-llm-wiki/09-review/<MODULE_NAME>.questions.md`

执行要求：
- 严格使用模块模板
- 必须补 evidence，尽量精确到文件和行号范围
- 需要识别：
  - 目的
  - 边界
  - 入口点
  - 上游调用方
  - 主要文件
  - 核心类型
  - 依赖
  - Configuration 依赖
  - 数据读写
  - 关键行为
  - 下游影响
  - 重要不变量
  - 常见变更点
  - 可观测性
  - 变更风险点
  - 风险
  - 测试
  - 证据
  - 开放问题
- 区分事实与推断
- 如果证据不足，不要脑补，写入 开放问题

状态更新要求：
- 将任务状态按顺序推进：
  - `pending -> scanning -> summarizing -> evidence-linked -> review-needed`
- 更新 `task-queue.json` 中该任务的：
  - `status`
  - `notes`
  - `last_updated_at`
  - `review_result`
- 更新 `progress.json`
- 更新 `status-dashboard.md`

完成后请：
1. 简要说明本次完成了哪个模块
2. 列出写入或修改的文件
3. 说明该任务当前是否进入 `review-needed`
4. 给出下一个最适合分析的模块
```

## 3. 流程分析提示词

```text
继续按照 `coder-llm-wiki` workflow 工作。

这次任务聚焦在 `/wiki-flow` 阶段，只分析一个高价值流程，不做泛化总结。

开始前先读取：
1. `coder-llm-wiki/00-meta/workflow-contract.md`
2. `coder-llm-wiki/00-meta/quality-gates.md`
3. `coder-llm-wiki/00-meta/review-rubric.md`
4. `coder-llm-wiki/00-meta/prompt-templates.md`
5. `coder-llm-wiki/00-meta/progress.json`
6. `coder-llm-wiki/00-meta/task-queue.json`
7. `coder-llm-wiki/00-meta/status-dashboard.md`
8. `coder-llm-wiki/01-inventory/entrypoints.md`
9. `coder-llm-wiki/02-index/` 下已有索引文档
10. `coder-llm-wiki/03-modules/` 下相关模块文档
11. `coder-llm-wiki/08-evidence/` 下相关证据文档

任务目标：
- 从 `task-queue.json` 中挑选下一个 `type=flow` 且 `status=pending` 的任务
- 如果 queue 中还没有 flow 任务，则根据 entrypoints、模块文档和测试映射挑一个最高价值流程
- 按 `/wiki-flow <FLOW_NAME>` 模板执行
- 产出：
  - `coder-llm-wiki/04-flows/<FLOW_NAME>.md`
  - 如有必要，补充或更新相关 `08-evidence/*.md`

执行要求：
- 严格使用 flow 模板
- 必须覆盖：
  - 触发条件
  - 入口点
  - 前置条件
  - 主路径
  - 退出条件
  - 失败路径
  - 补偿 / 重试
  - 用户可见失败
  - 状态变化
  - 外部调用
  - 相关模块
  - 风险
  - 运行信号
  - 测试
  - 证据
  - 开放问题
- 主路径 必须按顺序写清楚，不要只列函数名
- 必须明确失败路径、补偿机制、外部副作用
- 必须尽量给出源码、配置、测试 evidence，尽量精确到文件和行号范围
- 区分事实与推断
- 如果流程中某段行为无法确认，写入 开放问题，不要猜

状态更新要求：
- 将 flow 任务状态按顺序推进：
  - `pending -> scanning -> summarizing -> evidence-linked -> review-needed`
- 更新 `task-queue.json` 中对应任务的：
  - `status`
  - `notes`
  - `last_updated_at`
  - `review_result`
- 更新 `progress.json`
- 更新 `status-dashboard.md`

完成后请：
1. 简要说明本次完成了哪个流程
2. 列出写入或修改的文件
3. 说明该任务当前是否进入 `review-needed`
4. 标出该流程关联的关键模块
5. 给出下一个最适合分析的流程
```

## 4. 增量更新提示词

```text
继续按照 `coder-llm-wiki` workflow 工作。

这次任务聚焦在 `/wiki-update-from-diff`，只做增量维护，不重写整库 wiki。

开始前先读取：
1. `coder-llm-wiki/00-meta/incremental-update-policy.md`
2. `coder-llm-wiki/00-meta/quality-gates.md`
3. `coder-llm-wiki/00-meta/review-rubric.md`
4. `coder-llm-wiki/00-meta/progress.json`
5. `coder-llm-wiki/00-meta/task-queue.json`
6. `coder-llm-wiki/00-meta/status-dashboard.md`
7. `coder-llm-wiki/02-index/`
8. `coder-llm-wiki/03-modules/`
9. `coder-llm-wiki/04-flows/`
10. `coder-llm-wiki/08-evidence/`
11. 当前仓库的 `git diff` 或 changed files

任务目标：
- 识别最近代码变化
- 判断变化类型：
  - module-internal
  - interface-change
  - entrypoint-change
  - flow-change
  - config-change
  - test-change
  - rename-or-move
  - deletion
- 映射到受影响的 wiki 文档
- 只更新必要文档与 evidence
- 把新增不确定项写入 review 文档

执行要求：
- 不要重写整个 wiki
- 优先做局部更新
- 保留仍然有效的旧内容
- 替换失效 evidence
- 如果无法可靠映射影响范围，先记录 blocker，不要盲改
- 增量更新后至少做一次轻量 review

至少检查并按需更新：
- `03-modules/*.md`
- `04-flows/*.md`
- `08-evidence/*.md`
- `02-index/*.md`
- `09-review/*.md`
- `00-meta/status-dashboard.md`
- 如需要，`00-meta/progress.json`

如果变化较大，还应：
- 写一份新的 snapshot 到 `10-snapshots/`

完成后请：
1. 总结本次 diff 影响了哪些模块和流程
2. 列出实际更新的 wiki 文件
3. 说明是否存在 stale evidence
4. 说明是否需要局部重建 inventory/index/module/flow
5. 给出下一步建议
```

## 5. Review 提示词

```text
继续按照 `coder-llm-wiki` workflow 工作。

这次任务聚焦在 `/wiki-review`，目标是做一致性、evidence 和质量门检查，不新增大块分析内容，除非为修复明显问题所必需。

开始前先读取：
1. `coder-llm-wiki/00-meta/quality-gates.md`
2. `coder-llm-wiki/00-meta/review-rubric.md`
3. `coder-llm-wiki/00-meta/workflow-contract.md`
4. `coder-llm-wiki/00-meta/progress.json`
5. `coder-llm-wiki/00-meta/task-queue.json`
6. `coder-llm-wiki/00-meta/status-dashboard.md`
7. `coder-llm-wiki/02-index/`
8. `coder-llm-wiki/03-modules/`
9. `coder-llm-wiki/04-flows/`
10. `coder-llm-wiki/08-evidence/`
11. `coder-llm-wiki/09-review/`

任务目标：
- 审查现有模块文档、流程文档、evidence 文档和索引文档
- 根据 review rubric 给出 `Pass / Pass With Questions / Fail`
- 将问题写入：
  - `coder-llm-wiki/09-review/conflict-log.md`
  - `coder-llm-wiki/09-review/open-questions.md`
  - `coder-llm-wiki/09-review/human-review.md`

检查重点：
- Completeness
- 证据 Quality
- Fact / Inference Separation
- Consistency
- Risk / Test Coverage
- 如适用，Freshness

执行要求：
- 检查模块文档和 flow 文档是否互相一致
- 检查关键结论是否有足够具体的 evidence
- 检查是否把推断写成事实
- 检查 paths、symbols、tests、related modules 是否一致
- 检查风险、失败路径、测试映射是否缺失
- 对每个明显问题给出分类：
  - 明确错误
  - 证据不足
  - 推断过强
  - 待人工确认

状态更新要求：
- 更新 `task-queue.json` 中相关任务的 `review_result`
- 必要时将任务状态调整为：
  - `done`
  - `pending`
  - `blocked`
- 更新 `progress.json`
- 更新 `status-dashboard.md`

完成后请：
1. 列出通过 review 的文档
2. 列出 `Pass With Questions` 的文档
3. 列出 `Fail` 的文档
4. 列出最重要的修复项
5. 给出下一步建议
```

## 6. 状态和 Snapshot 提示词

```text
继续按照 `coder-llm-wiki` workflow 工作。

这次任务聚焦在 `/wiki-status` 和 `/wiki-snapshot`，目标是把当前批次整理成可恢复状态。

开始前先读取：
1. `coder-llm-wiki/00-meta/status-dashboard.md`
2. `coder-llm-wiki/00-meta/snapshot-format.md`
3. `coder-llm-wiki/00-meta/progress.json`
4. `coder-llm-wiki/00-meta/task-queue.json`
5. `coder-llm-wiki/09-review/`
6. `coder-llm-wiki/10-snapshots/` 下最新快照（如果存在）

任务目标：
- 刷新当前 dashboard
- 写一份新的 snapshot
- 确保下一位操作者能直接接手

输出文件：
- 更新 `coder-llm-wiki/00-meta/status-dashboard.md`
- 新增 `coder-llm-wiki/10-snapshots/<TIMESTAMP>-<BATCH>.md`
- 更新 `coder-llm-wiki/00-meta/progress.json` 中的 `last_snapshot`

执行要求：
- 从 `progress.json` 同步：
  - phase
  - current_batch_id
  - updated_at
  - last_snapshot
  - coverage
  - blockers
- 从 `task-queue.json` 汇总：
  - review-needed 数量
  - blocked 数量
  - 高优先级 pending 数量
- 从 `09-review/` 汇总：
  - 关键冲突
  - 未解决问题
  - 待人工确认项
- snapshot 必须包含：
  - 当前 phase
  - 当前 batch
  - 已完成项
  - 输出文件
  - review 状态
  - blockers
  - open questions
  - next recommended steps
  - resume instructions

注意：
- 不要把 dashboard 写成流水账
- 不要省略 next steps
- 不要只写“已完成”，必须说明还能如何继续

完成后请：
1. 列出更新了哪些状态文件
2. 给出当前整体状态总结
3. 给出明确的下一个动作
```

## 推荐顺序

首次运行建议顺序：

1. Standard Startup Prompt
2. Module Analysis Prompt 或 Flow Analysis Prompt
3. Review 提示词
4. 状态和 Snapshot 提示词

代码发生变更后建议顺序：

1. Incremental Update Prompt
2. Review 提示词
3. 状态和 Snapshot 提示词
