# OpenCode 分发检查清单

本文件是长期仓库分析任务的操作手册。

请与以下文件配套使用：
- `coder-llm-wiki/00-meta/workflow-contract.md`
- `coder-llm-wiki/00-meta/quality-gates.md`

`workflow-contract.md` 定义阶段边界。
`quality-gates.md` 定义什么产物可以算完成。

## Phase 0: 初始化
- 创建或检查 `coder-llm-wiki/` 目录树。
- 开始分析前先读取 `coder-llm-wiki/README.md` 和 `coder-llm-wiki/00-meta/project-charter.md`。
- 读取最新的 `progress.json`、`task-queue.json`，以及存在时的最新 snapshot。
- 更新 `coder-llm-wiki/00-meta/progress.json`，把 `phase` 设置为当前阶段。
- 清理或补齐 `coder-llm-wiki/00-meta/task-queue.json` 中的下一批任务。
- 将仓库专用命名规则记录到 `coder-llm-wiki/00-meta/glossary.md`。
- 如果开始新一轮运行，设置 `current_batch_id` 并初始化覆盖率计数。

## Phase 1: Inventory
- 全仓重新扫描前，先确认没有可信的 inventory 可复用。
- 读取根目录文档和顶层配置文件。
- 识别顶层 app、package、service、script 和数据目录。
- 识别运行时入口，如应用启动、CLI 命令、worker、scheduler 或 consumer。
- 写入 `coder-llm-wiki/01-inventory/repo-map.md`。
- 写入 `coder-llm-wiki/01-inventory/tech-stack.md`。
- 写入 `coder-llm-wiki/01-inventory/entrypoints.md`。
- 写入 `coder-llm-wiki/01-inventory/module-candidates.json`。
- 标记完成前先检查 quality gates。
- 更新 `progress.json`，将 `inventory` 标记为 `done`。

## Phase 2: Index
- 更新 `progress.json`，将 `phase` 设为 `index`。
- 基于真实入口建立 route 或 command 索引。
- 为核心 class、function 或 schema 建立 symbol 索引。
- 如果仓库存在 job、event 或后台任务，建立对应索引。
- 建立 test map，将重要代码关联到测试。
- 将产物写入 `coder-llm-wiki/02-index/`。
- 当运行时分发过于动态、无法可靠静态解析时，记录索引限制。
- 标记完成前先检查 index 文档是否通过 quality gates。
- 更新 `progress.json`，将 `index` 标记为 `done`。

## Phase 3: 准备模块队列
- 更新 `progress.json`，将 `phase` 设为 `prepare_module_queue`。
- Review `module-candidates.json`。
- 将仓库拆分为稳定的模块单元。
- 在 `task-queue.json` 中为每个模块创建一个队列项。
- 每个模块任务都应包含 scope、inputs、outputs、status、priority、depends_on 和 notes。
- 优先拆成可 review 的模块大小，不要做过宽的子系统倾倒。
- 标记下一批模块任务为 ready。

## Phase 4: 模块分析循环
- 更新 `progress.json`，将 `phase` 设为 `module_analysis`。
- 选择下一个 `status=pending` 的模块任务。
- 将任务标记为 `scanning`。
- 分析模块目录、相关入口点、配置和测试。
- 必要时读取上游调用方和下游影响，不要孤立记录模块。
- 基于模块模板写入 `coder-llm-wiki/03-modules/<module>.md`。
- 写入 `coder-llm-wiki/08-evidence/<module>.refs.md`，包含文件和行号引用。
- 将未解决缺口写入 `coder-llm-wiki/09-review/<module>.questions.md`。
- 工作推进时按 `summarizing`、`evidence-linked` 更新任务状态。
- 将任务标记为 `review-needed`。
- 重复直到当前批次完成。

## Phase 5: 轻量 Review 循环
- 更新 `progress.json`，将 `phase` 设为 `lightweight_review`。
- 对照 evidence 文档 review 新写入的模块文档。
- 检查模块文档是否说明 purpose、boundaries、dependencies、data interactions、risks、tests 和 open questions。
- 非平凡模块至少应有五条高价值 evidence 引用。
- 检查事实和推断是否分离。
- 检查与 index 文档的跨文档一致性。
- 模块文档可接受时，将任务标记为 `done`。
- 模块文档薄弱或不一致时，将任务标记为 `blocked`，或带说明退回 `pending`。

## Phase 6: 流程规划
- 更新 `progress.json`，将 `phase` 设为 `flow_planning`。
- 从入口点、模块和测试中识别最高价值流程。
- 在 `task-queue.json` 中为每个 flow 创建一个队列项。
- 优先选择业务关键、容易失败或集成较重的 flow。
- 每个 flow 任务应包含 entry files、related modules、expected outputs 和 dependency notes。

## Phase 7: 流程分析循环
- 更新 `progress.json`，将 `phase` 设为 `flow_analysis`。
- 选择下一个 `status=pending` 的 flow 任务。
- 将任务标记为 `scanning`。
- 从真实入口点开始追踪调用路径。
- 记录主路径、失败路径、状态变化和外部调用。
- 存在时记录退出条件、补偿或重试行为，以及用户可见失败。
- 写入 `coder-llm-wiki/04-flows/<flow>.md`。
- 按需新增或更新 `coder-llm-wiki/08-evidence/` 下的支撑证据文档。
- 工作推进时按 `summarizing`、`evidence-linked` 更新任务状态。
- 将 flow 任务标记为 `review-needed`。

## Phase 8: 交叉 Review
- 更新 `progress.json`，将 `phase` 设为 `review`。
- 对照相关模块文档检查 flow 文档。
- 对照 module/flow 文档检查 index 文档。
- 将事实冲突记录到 `coder-llm-wiki/09-review/conflict-log.md`。
- 将未解决缺口记录到 `coder-llm-wiki/09-review/open-questions.md`。
- 将需要人工判断的事项记录到 `coder-llm-wiki/09-review/human-review.md`。
- 修复薄弱文档，或把它们重新加入队列。
- 只有关键冲突已经解决或明确追踪后，才能将 `review` 标记为 `done`。

## Phase 9: Snapshot 和恢复
- 更新 `progress.json`，将 `phase` 设为 `snapshot`。
- 每个批次后，在 `coder-llm-wiki/10-snapshots/` 下写入检查点文件。
- 包含 batch id、已完成任务、当前阶段、写入产物、review 结果和剩余阻塞。
- 写入 snapshot 后更新 `progress.json.last_snapshot`。
- 重启后，先读取 `progress.json`、`task-queue.json` 和最新 snapshot，再恢复工作。

## Phase 10: 增量维护
- 针对新代码变更运行时，更新 `progress.json`，将 `phase` 设为 `incremental_updates`。
- 读取当前 git diff 或变更文件列表。
- 将代码变更映射到受影响模块和流程。
- 只更新受影响的 wiki 文档和 evidence 文件。
- 将新增不确定项追加到 review 文档。
- 旧 evidence 只有在仍匹配当前代码时才保留。
- 如果无法可靠映射变更影响，先修复 index 或 inventory，再编辑大量文档。

## 状态词汇
- `pending`: 未开始
- `scanning`: 正在发现源码
- `summarizing`: 正在写主体文档
- `evidence-linked`: evidence 文件已更新
- `review-needed`: 已准备好 review
- `done`: 当前已完成
- `blocked`: 缺少确认或冲突解决，无法继续

## 必需任务字段
- `id`
- `type`
- `scope`
- `status`
- `owner`
- `priority`
- `depends_on`
- `inputs`
- `outputs`
- `review_result`
- `notes`
- `last_updated_at`

## 操作说明
- evidence 未链接前，不要把生成文本视为最终结论。
- 低确定性内容不要把事实和解释混在同一段里。
- 优先重跑小任务，不要重写大批文档。
- 队列保持足够小，便于定期 review。
- 相关 quality gates 通过前，不要把任务标记为 `done`。
- 每个任务完成后立即更新 progress 和 queue，不要攒到批次结束。
