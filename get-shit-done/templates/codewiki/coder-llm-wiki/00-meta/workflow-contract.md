# 工作流契约

## 目的

本文件定义 `coder-llm-wiki` 的标准工作流合同，用于统一分析任务的输入、输出、进入条件、退出条件、失败处理和下一步动作。

目标：
- 让不同操作者按同一套流程工作
- 让每个阶段的产物可以被下一阶段直接消费
- 让中断恢复和增量更新有稳定依据

## 全局规则

所有阶段都必须遵守以下规则：

1. 重要结论必须有 evidence 支撑。
2. 事实、推断、问题必须分开写。
3. 无法确认的内容进入 `开放问题`，不得伪装成事实。
4. 每次任务结束后都要更新状态文件。
5. 每次批量任务结束后都要写 snapshot。
6. 如阶段输出未达标，不得直接推进到下一阶段。

## 执行策略

为减少任务在运行中频繁等待人工响应，当前 run 应声明执行策略：

- `execution.mode`
  - `supervised`: 优先等待人工确认
  - `deferred-review`: 优先继续执行，把需要人工判断的内容转写到 `09-review/human-review.md`
  - `unattended`: 在不存在硬阻塞时持续执行，不主动等待人工回复
- `execution.ask_for_confirmation`
  - `true`: 遇到重要歧义时允许停下来问
  - `false`: 不主动请求下一步动作，优先记录并继续
- `execution.block_on_human_review`
  - `true`: 需要人工判断时可直接进入 `blocked`
  - `false`: 只在确实无法可靠推进时才 `blocked`
- `execution.max_auto_steps`
  - 单轮建议自动推进的最大任务数，用于在无人值守和人工复核之间做平衡

推荐策略：

- 日常人工协作：`supervised`
- 希望尽量连续跑完一批：`deferred-review`
- 后台批处理：`unattended`

执行策略只影响“是否暂停等待人”，不影响 evidence、quality gate 和状态更新要求。

## Phase 0: 初始化

### 目标

初始化本轮 wiki 分析工作上下文。

### 输入

- 仓库根目录
- `coder-llm-wiki/00-meta/project-charter.md`
- 当前 `progress.json`
- 当前 `task-queue.json`

### 必读文件

- `coder-llm-wiki/README.md`
- `coder-llm-wiki/00-meta/project-charter.md`
- `coder-llm-wiki/00-meta/opencode-dispatch-checklist.md`

### 输出

- 更新后的 `coder-llm-wiki/00-meta/progress.json`
- 更新后的 `coder-llm-wiki/00-meta/task-queue.json`
- 如需要，更新 `coder-llm-wiki/00-meta/glossary.md`

### 进入条件

- `coder-llm-wiki/` 已存在

### 退出条件

- `progress.json.phase` 已设置为当前阶段
- 首批任务已写入 queue
- 命名和范围约束已知

### 失败处理

- 如果 meta 文件缺失，先记录 blocker，再补齐缺失文件
- 如果已有历史状态冲突，写入 `09-review/human-review.md`
- 如果 `execution.mode != supervised` 且冲突不影响当前产物可靠性，允许先记录冲突并继续后续可独立任务

### 下一步

- 若仓库认知缺失，进入 `Inventory`
- 若 inventory 已完成，进入 `Index`

## Phase 1: Inventory

### 目标

建立仓库顶层认知地图和主要入口视图。

### 输入

- 根目录结构
- README、构建配置、部署配置、顶层脚本、入口文件

### 输出

- `01-inventory/repo-map.md`
- `01-inventory/tech-stack.md`
- `01-inventory/entrypoints.md`
- `01-inventory/module-candidates.json`

### 进入条件

- 尚未具备可靠的顶层仓库地图

### 退出条件

- 顶层目录职责已标注
- 主要运行入口已识别
- 模块候选集合可供切分任务

### 失败处理

- 如果入口无法判定，记录到 `09-review/open-questions.md`
- 如果仓库规模过大，允许按子系统拆 inventory 批次
- 如果 `execution.ask_for_confirmation = false`，不得因为“下一步选哪个子系统”而暂停；应选择风险最高或入口最明确的子系统继续

### 下一步

- 进入 `Index`

## Phase 2: Index

### 目标

建立后续分析复用的检索层，避免每次重新全局扫描。

### 输入

- Inventory 产物
- 真实入口、核心符号、测试目录

### 输出

- `02-index/routes.md`
- `02-index/symbols.md`
- `02-index/test-map.md`
- 如有必要，补充 `jobs.md` 或 `events.md`

### 进入条件

- Inventory 已完成，且可识别真实入口

### 退出条件

- 至少能从入口追到核心模块或测试
- 后续模块分析不再依赖重复全仓扫描

### 失败处理

- 如果路由或任务系统过于动态，明确标注“索引不完整的原因”
- 如果测试映射不足，标记为后续 review 风险

### 下一步

- 进入 `Prepare Module Queue`

## Phase 3: 准备模块队列

### 目标

将模块候选切分为稳定、可执行的小任务。

### 输入

- `01-inventory/module-candidates.json`
- `02-index/` 下索引文档

### 输出

- 更新后的 `00-meta/task-queue.json`

### 进入条件

- 已有模块候选列表

### 退出条件

- 每个模块任务都有 scope、outputs、status
- 当前批次任务数量可控，便于 review

### 失败处理

- 如果模块边界不稳定，先记录为候选分组，不强行定稿
- 如果任务过大，继续拆分而不是保留巨型模块任务
- 如果 `execution.ask_for_confirmation = false`，拆分策略优先选择最小可验证模块，不等待人工命名

### 下一步

- 进入 `Module Analysis`

## Phase 4: 模块分析

### 目标

沉淀单模块的职责、边界、依赖、数据交互和风险。

### 输入

- 模块任务 scope
- 相关入口、配置、测试、上游调用方

### 输出

- `03-modules/<module>.md`
- `08-evidence/<module>.refs.md`
- `09-review/<module>.questions.md`

### 进入条件

- 模块任务状态为 `pending`

### 退出条件

- 模块文档字段完整
- evidence 已链接
- unresolved gaps 已写入 review 文件
- 任务状态更新为 `review-needed`

### 失败处理

- 如果模块无法独立切分，记录边界问题并返回 queue 重拆
- 如果关键源码不可读或生成内容不可信，标记为 `blocked`
- 如果需要人工判断但不影响文档主体可靠性，写入 `09-review/<module>.questions.md` 和 `09-review/human-review.md`，继续处理下一个可执行任务

### 下一步

- 进入 `Lightweight Review`

## Phase 5: 轻量 Review

### 目标

对单模块产物执行最小审查，避免低质量内容进入已完成状态。

### 输入

- 模块文档
- evidence 文档
- question 文档

### 输出

- 更新后的 queue 状态
- 必要时修订模块文档或 evidence 文档

### 进入条件

- 任务状态为 `review-needed`

### 退出条件

- 通过则标记为 `done`
- 不通过则回退到 `pending` 或标记为 `blocked`

### 失败处理

- 如果 evidence 不足，退回补证据
- 如果结论与源码冲突，记录到 `09-review/conflict-log.md`
- 如果 `execution.block_on_human_review = false`，不要仅因存在待人工确认项而停止整个批次

### 下一步

- 当前批次未完成则回到 `Module Analysis`
- 批次完成则进入 `Flow Planning`

## Phase 6: 流程规划

### 目标

确定最值得文档化的关键流程。

### 输入

- 入口清单
- 模块文档
- 测试映射
- 风险区域

### 输出

- 更新后的 `00-meta/task-queue.json`

### 进入条件

- 已具备一定模块知识和入口索引

### 退出条件

- flow 任务已按业务价值或风险排序
- 每个 flow 任务有明确入口和预期输出

### 失败处理

- 如果流程边界不清晰，允许先建 exploratory flow 任务

### 下一步

- 进入 `Flow Analysis`

## Phase 7: 流程分析

### 目标

从真实入口出发，追踪主路径、失败路径和副作用。

### 输入

- flow 任务定义
- 入口文件
- 相关模块文档
- 相关测试

### 输出

- `04-flows/<flow>.md`
- 必要时补充 `08-evidence/*.md`

### 进入条件

- flow 任务状态为 `pending`

### 退出条件

- 主路径是顺序叙述，不是纯函数列表
- 失败路径、状态变化、外部调用已明确
- 任务状态更新为 `review-needed`

### 失败处理

- 如果流程包含大量动态分派，记录证据限制和推断边界
- 如果缺关键调用链，标记为 `blocked`

### 下一步

- 进入 `Cross Review`

## Phase 8: 交叉 Review

### 目标

跨模块、流程、索引文档做一致性和证据校验。

### 输入

- `03-modules/`
- `04-flows/`
- `08-evidence/`
- `02-index/`

### 输出

- `09-review/conflict-log.md`
- `09-review/open-questions.md`
- `09-review/human-review.md`

### 进入条件

- 已有一批模块或流程文档完成初稿

### 退出条件

- 关键冲突已修复或显式挂起
- 高风险缺口已被记录
- review 结论可指导下一轮补写或修订

### 失败处理

- 如果冲突无法仅靠代码解出，转入 human-review
- 如果多文档缺 evidence，整体回退到补证据批次

### 下一步

- 进入 `Snapshot`
 - 或继续下一轮 `Module Analysis` / `Flow Analysis`

## Phase 9: Snapshot

### 目标

记录当前批次的可恢复状态。

### 输入

- 最新 `progress.json`
- 最新 `task-queue.json`
- 当前批次产物和 blocker

### 输出

- `10-snapshots/<timestamp>-<batch>.md`

### 进入条件

- 当前批次完成、暂停或遇到明显阻塞

### 退出条件

- 已记录完成项、未完成项、阻塞项、下一步
- `progress.json.last_snapshot` 已更新

### 失败处理

- 如果状态不完整，至少写最小快照，不允许无记录中断

### 下一步

- 暂停
- 或继续下一批任务

## Phase 10: 增量更新

### 目标

在代码变化后，只更新受影响的 wiki 内容。

### 输入

- 当前 `git diff` 或 changed files
- 现有模块、流程、evidence 文档

### 输出

- 被影响文档的局部更新
- 新增 review 项
- 必要时新增 snapshot

### 进入条件

- 已存在基础 wiki 文档
- 有明确代码变化范围

### 退出条件

- 受影响的模块和流程已重审
- 陈旧 evidence 已修正
- 新不确定项已被登记

### 失败处理

- 如果无法建立 diff 到文档的映射，先进入 inventory/index 补索引
- 如果变化过大，允许退化为局部重建批次

### 下一步

- 返回 `Cross Review`
- 或进入 `Snapshot`

## 允许的阶段流转

推荐状态流转：

1. `Initialize -> Inventory -> Index -> Prepare Module Queue -> Module Analysis -> Lightweight Review`
2. `Lightweight Review -> Module Analysis`，直到模块批次完成
3. `Lightweight Review -> Flow Planning -> Flow Analysis -> Cross Review`
4. `Cross Review -> Snapshot`
5. 代码变更后：`Incremental Update -> Cross Review -> Snapshot`

## 完成定义

一次 wiki 分析批次只有在满足以下条件时才算完成：

1. 相关文档已经写入目标目录。
2. 关键结论已经附证据。
3. 不确定项已转入 review 文档。
4. 状态文件已更新。
5. 已写入 snapshot 或明确标注无需新快照。

## 操作说明

- 优先让 workflow 稳定，而不是追求一次覆盖所有仓库内容。
- 优先完成高价值模块和关键流程，而不是平均覆盖所有目录。
- review 文档不是失败产物，而是工作流的一部分。
- 如果需要自动化，先自动化状态更新和 gate 检查，再自动化全文生成。
